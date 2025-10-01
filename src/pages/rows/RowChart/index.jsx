// src/pages/rows/RowChart/index.jsx
// RowChart — deep seed from /api/v1/ohlc + SSE live stream (/stream/agg)

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
    })();
  }, [state.symbol, state.timeframe]);

  // SSE live stream (instant last-candle updates)
  useEffect(() => {
    if (state.timeframe === "1d") return; // skip daily
    if (!seriesRef.current) return;

    const url =
      `${API_BASE.replace(/\/+$/, "")}/stream/agg` +
      `?symbol=${encodeURIComponent(state.symbol)}` +
      `&tf=${encodeURIComponent(state.timeframe)}`;

    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg?.ok || !msg?.bar) return;

        const b = msg.bar;
        const live = {
          time: Number(b.time),           // seconds epoch (bucket start)
          open: Number(b.open),
          high: Number(b.high),
          low:  Number(b.low),
          close:Number(b.close),
          volume: Number(b.volume || 0),
        };
        if (!Number.isFinite(live.time)) return;

        // update chart
        seriesRef.current.update(live);
        volSeriesRef.current?.update({
          time: live.time,
          value: live.volume,
          color: live.close >= live.open ? STYLE.volUp : STYLE.volDn,
        });

        // keep local bars if other UI needs it
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
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      // let EventSource auto-reconnect
    };

    return () => es.close();
  }, [state.symbol, state.timeframe]);

  return (
    <div style={{ border: `1px solid ${STYLE.border}`, borderRadius: 8, background: STYLE.bg }}>
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
