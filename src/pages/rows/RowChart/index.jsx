// src/pages/rows/RowChart/index.jsx
// RowChart — deep seed from /api/v1/ohlc + SSE live stream from /stream/agg
// Guards invalid times (null/0) so we don't update off-screen.

import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { getOHLC } from "../../../lib/ohlcClient";
import { SYMBOLS, TIMEFRAMES } from "./constants";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  "https://frye-market-backend-1.onrender.com";

const SEED_LIMIT = 5000;

const STYLE = {
  up: "#26a69a",
  dn: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDn: "rgba(239,83,80,0.5)",
  grid: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

function fmt(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const d = new Date(sec * 1000);
  return d.toLocaleString("en-US", { hour12: true });
}

export default function RowChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
}) {
  // refs
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);

  // state
  const [bars, setBars] = useState([]);
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: 200,
  });

  // status UI (instrumentation)
  const [sseStatus, setSseStatus] = useState({
    connected: false,
    lastEventAt: null,
    lastBarTime: null,
    lastPrice: null,
    error: null,
  });

  // create chart once
  useEffect(() => {
    const el = containerRef.current;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: 520,
      layout: { background: { color: STYLE.bg }, textColor: "#d1d5db" },
      grid: { vertLines: { color: STYLE.grid }, horzLines: { color: STYLE.grid } },
      rightPriceScale: { borderColor: STYLE.border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: STYLE.border, timeVisible: true },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: STYLE.up,
      downColor: STYLE.dn,
      wickUpColor: STYLE.up,
      wickDownColor: STYLE.dn,
      borderUpColor: STYLE.up,
      borderDownColor: STYLE.dn,
    });
    seriesRef.current = series;

    const vol = chart.addHistogramSeries({ priceScaleId: "", priceFormat: { type: "volume" } });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    // responsive width
    const ro = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth || el.clientWidth;
      if (w && chartRef.current) chartRef.current.resize(w, 520);
    });
    ro.observe(el);

    return () => {
      try { ro.disconnect(); } catch {}
      chart.remove();
    };
  }, []);

  // seed history
  useEffect(() => {
    (async () => {
      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        const asc = (Array.isArray(seed) ? seed : []).sort((a, b) => a.time - b.time);
        setBars(asc);

        seriesRef.current?.setData(asc);
        volSeriesRef.current?.setData(
          asc.map((b) => ({
            time: b.time,
            value: Number(b.volume || 0),
            color: b.close >= b.open ? STYLE.volUp : STYLE.volDn,
          }))
        );

        chartRef.current?.timeScale().fitContent();
      } catch (e) {
        console.error("[RowChart seed] error:", e);
      }
    })();
  }, [state.symbol, state.timeframe]);

  // SSE live stream (instant updates) + guard invalid times
  useEffect(() => {
    if (state.timeframe === "1d") return; // skip daily
    if (!seriesRef.current) return;

    const url =
      `${API_BASE.replace(/\/+$/, "")}/stream/agg` +
      `?symbol=${encodeURIComponent(state.symbol)}` +
      `&tf=${encodeURIComponent(state.timeframe)}`;

    const es = new EventSource(url);

    es.onopen = () => {
      setSseStatus((s) => ({ ...s, connected: true, error: null }));
    };

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg?.ok || !msg?.bar) return;

        const tRaw = msg.bar?.time;
        // Hard guard: require a valid 10-digit seconds epoch (> 1e9)
        const tSec = Number(tRaw);
        if (!Number.isFinite(tSec) || tSec < 1_000_000_000) {
          // ignore null/0/ms/nonsense
          return;
        }

        const live = {
          time: tSec,
          open: Number(msg.bar.open),
          high: Number(msg.bar.high),
          low:  Number(msg.bar.low),
          close:Number(msg.bar.close),
          volume: Number(msg.bar.volume || 0),
        };

        // status
        setSseStatus({
          connected: true,
          lastEventAt: Date.now(),
          lastBarTime: live.time,
          lastPrice: live.close,
          error: null,
        });

        // update series on screen
        seriesRef.current.update(live);
        volSeriesRef.current?.update({
          time: live.time,
          value: live.volume,
          color: live.close >= live.open ? STYLE.volUp : STYLE.volDn,
        });

        // keep local bars list
        setBars((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return [live];
          const last = prev[prev.length - 1];
          if (last.time === live.time) {
            const next = prev.slice();
            next[next.length - 1] = live;
            return next;
          }
          if (live.time > last.time) return [...prev, live];
          return prev;
        });
      } catch (e) {
        console.error("[RowChart SSE] parse error:", e);
      }
    };

    es.onerror = () => {
      setSseStatus((s) => ({ ...s, connected: false, error: "SSE error" }));
      // allow auto-reconnect
    };

    return () => es.close();
  }, [state.symbol, state.timeframe]);

  return (
    <div style={{ border: `1px solid ${STYLE.border}`, borderRadius: 8, background: STYLE.bg, position: "relative" }}>
      {/* Status strip */}
      <div style={{
        position: "absolute",
        right: 8,
        top: 8,
        zIndex: 5,
        background: "rgba(0,0,0,0.5)",
        color: "#d1d5db",
        fontSize: 12,
        padding: "6px 8px",
        border: "1px solid #2b2b2b",
        borderRadius: 6,
      }}>
        <div><strong>SSE:</strong> {sseStatus.connected ? "connected" : "disconnected"}</div>
        <div><strong>Last SSE:</strong> {sseStatus.lastEventAt ? new Date(sseStatus.lastEventAt).toLocaleTimeString() : "—"}</div>
        <div><strong>Bar time:</strong> {fmt(sseStatus.lastBarTime)}</div>
        <div><strong>Last price:</strong> {sseStatus.lastPrice ?? "—"}</div>
        {sseStatus.error && <div style={{ color: "#f87171" }}>{sseStatus.error}</div>}
      </div>

      <Controls
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
        value={state}
        onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
      />
      <div ref={containerRef} style={{ width: "100%", height: 520 }} />
    </div>
  );
}
