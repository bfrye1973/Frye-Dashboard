// src/pages/rows/RowChart/index.jsx
// RowChart — final (history + live stream via Streamer)
// - Seeds with getOHLC(limit=5000)
// - AZ time on hover + bottom axis
// - Volume histogram (bottom 20%)
// - Range 50/100 = last N bars; 200 = FULL (fitContent)
// - Live stream from REACT_APP_STREAM_BASE (/stream/agg?symbol=&tf=)
// - Single source of truth for symbols/timeframes = ./constants

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import { getOHLC } from "../../../lib/ohlcClient";
import { SYMBOLS, TIMEFRAMES } from "./constants";

// ---- LIVE STREAM CONFIG ----
const STREAM_BASE = process.env.REACT_APP_STREAM_BASE || "https://frye-market-backend-2.onrender.com";

function subscribeStream(symbol, tf, onBar) {
  const url = `${STREAM_BASE}/stream/agg?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
  const es = new EventSource(url);
  console.log("[STREAM] Subscribing to:", url);

  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg?.type === "bar" && msg?.bar) onBar(msg.bar);
    } catch {}
  };

  es.onerror = (err) => {
    console.warn("[STREAM] SSE error:", err);
  };

  return () => es.close();
}


const SEED_LIMIT = 5000;

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDown: "rgba(239,83,80,0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

// ---------------- Streamer (SSE) ----------------
const STREAM_BASE = (process.env.REACT_APP_STREAM_BASE || "").replace(/\/+$/, "");
function buildStreamUrl(symbol, timeframe) {
  if (!STREAM_BASE) return "";
  const s = encodeURIComponent(symbol);
  const tf = encodeURIComponent(timeframe);
  return `${STREAM_BASE}/stream/agg?symbol=${s}&tf=${tf}`;
}
function subscribeLive(symbol, timeframe, onBar) {
  const url = buildStreamUrl(symbol, timeframe);
  if (!url) return () => {};
  const es = new EventSource(url);

  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      // Streamer emits { ok:true, type:"bar", bar:{ time, ohlc, volume } }
      if (msg && msg.ok && msg.type === "bar" && msg.bar && Number.isFinite(msg.bar.time)) {
        onBar(msg.bar);
      }
    } catch {
      // ignore heartbeats / non-JSON
    }
  };
  es.onerror = () => {
    // let browser auto-reconnect; optional: console.warn for visibility
    // console.warn("[RowChart] SSE error; browser will reconnect");
  };
  return () => es.close();
}

// ---------------- Time formatting ----------------
function phoenixTime(ts, isDaily = false) {
  const seconds =
    typeof ts === "number"
      ? ts
      : ts && typeof ts.timestamp === "number"
      ? ts.timestamp
      : 0;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(isDaily
      ? { month: "short", day: "2-digit" }
      : { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(seconds * 1000));
}

export default function RowChart({
  apiBase = process.env.REACT_APP_API_BASE,
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
}) {
  // expose backend base for clients that read window.__API_BASE__
  useEffect(() => {
    if (typeof window !== "undefined" && apiBase) {
      window.__API_BASE__ = apiBase.replace(/\/+$/, "");
    }
  }, [apiBase]);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const roRef = useRef(null);

  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: 200,
    disabled: false,
  });

  // canonical symbols/timeframes (from ./constants)
  const symbols = useMemo(() => SYMBOLS, []);
  const timeframes = useMemo(() => TIMEFRAMES, []);

  // ---------- create chart once ----------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db" },
      grid: {
        vertLines: { color: DEFAULTS.gridColor },
        horzLines: { color: DEFAULTS.gridColor },
      },
      rightPriceScale: {
        borderColor: DEFAULTS.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: { borderColor: DEFAULTS.border, timeVisible: true, minimumHeight: 20 },
      localization: {
        timezone: "America/Phoenix",
        timeFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: DEFAULTS.upColor,
      downColor: DEFAULTS.downColor,
      wickUpColor: DEFAULTS.upColor,
      wickDownColor: DEFAULTS.downColor,
      borderUpColor: DEFAULTS.upColor,
      borderDownColor: DEFAULTS.downColor,
    });
    seriesRef.current = series;

    const vol = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    chart.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
    });

    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return;
      chartRef.current.resize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    });
    ro.observe(el);
    roRef.current = ro;

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { chartRef.current?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- timeframe axis when timeframe changes ----------
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      timeVisible: state.timeframe !== "1d",
    });
  }, [state.timeframe]);

  // ---------- seed (history) on symbol/timeframe change ----------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        if (cancelled) return;

        const asc = (Array.isArray(seed) ? seed : [])
          .slice()
          .sort((a, b) => a.time - b.time);

        barsRef.current = asc;
        setBars(asc);

        if (typeof window !== "undefined") {
          const first = asc[0]?.time ?? 0;
          const last = asc[asc.length - 1]?.time ?? 0;
          const spanDays =
            first && last ? Math.round((last - first) / 86400) : 0;
          window.__ROWCHART_INFO__ = {
            tf: state.timeframe,
            bars: asc.length,
            spanDays,
            source: "api/v1/ohlc",
          };
          if (showDebug) console.log("[ROWCHART seed]", window.__ROWCHART_INFO__);
        }
      } catch (e) {
        if (showDebug) console.error("[ROWCHART] load error:", e);
        barsRef.current = [];
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [state.symbol, state.timeframe, showDebug]);

  // ---------- render + viewport ----------
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !series) return;

    series.setData(bars);
    if (vol) {
      vol.setData(
        bars.map((b) => ({
          time: b.time,
          value: Number(b.volume ?? 0),
          color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        }))
      );
    }

    requestAnimationFrame(() => {
      const ts = chart.timeScale();
      const r = state.range;
      const len = bars.length;
      if (!r || r === 200 || !len) {
        ts.fitContent();
      } else {
        const to = len - 1;
        const from = Math.max(0, to - (r - 1));
        ts.setVisibleLogicalRange({ from, to });
      }
    });
  }, [bars, state.range]);

  // ---------- live stream (SSE via Streamer) ----------
  useEffect(() => {
    // For "1d" we usually skip live (provider sends 1m final bars).
    if (state.timeframe === "1d") return;
    // If no Streamer base configured, skip silently.
    if (!STREAM_BASE) return;

    let disposed = false;
    const unsubscribe = subscribeLive(state.symbol, state.timeframe, (bar) => {
      if (disposed || !bar || bar.time == null) return;

      // update OHLC series
      seriesRef.current?.update(bar);
      // update volume series
      if (volSeriesRef.current) {
        volSeriesRef.current.update({
          time: bar.time,
          value: Number(bar.volume || 0),
          color: bar.close >= bar.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        });
      }
      // maintain local cache
      barsRef.current = mergeBar(barsRef.current, bar);
      // trigger UI update incrementally (don’t rebuild whole array)
      setBars((prev) => mergeBar(prev, bar));
    });

    return () => {
      disposed = true;
      try { unsubscribe?.(); } catch {}
    };
  }, [state.symbol, state.timeframe]);

  // ---------- handlers ----------
  const applyRange = (nextRange) => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const list = barsRef.current;
    const len = list.length;
    if (!nextRange || nextRange === 200 || !len) {
      ts.fitContent();
      return;
    }
    const to = len - 1;
    const from = Math.max(0, to - (nextRange - 1));
    ts.setVisibleLogicalRange({ from, to });
  };

  const handleControlsChange = (patch) =>
    setState((s) => ({ ...s, ...patch }));

  const handleTest = async () => {
    try {
      const x = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
      alert(`Fetched ${x.length} bars from /api/v1/ohlc`);
    } catch {
      alert("Fetch failed");
    }
  };

  // ---------- render ----------
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${DEFAULTS.border}`,
        borderRadius: 8,
        overflow: "hidden",
        background: DEFAULTS.bg,
      }}
    >
      <Controls
        symbols={symbols}
        timeframes={timeframes}
        value={state}
        onChange={handleControlsChange}
        onRange={applyRange}
        onTest={showDebug ? handleTest : null}
      />

      {/* Indicators tab / toggles */}
      <IndicatorsToolbar
        symbol={state.symbol}
        timeframe={state.timeframe}
      />

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 520,
          minHeight: 360,
          background: DEFAULTS.bg,
        }}
      />
    </div>
  );
}

// ---------- helpers ----------
function mergeBar(prev, bar) {
  if (!Array.isArray(prev) || prev.length === 0) return [bar];
  const last = prev[prev.length - 1];
  if (last && last.time === bar.time) {
    const next = prev.slice(0, -1);
    next.push(bar);
    return next;
  }
  return [...prev, bar];
}
