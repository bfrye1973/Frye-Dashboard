// src/pages/rows/RowChart/index.jsx
// RowChart — deep seed + live polling (no WS needed)
// - Dropdowns from ./constants (full lists)
// - Seed: /api/v1/ohlc (limit=5000) → full array (seconds)
// - Live: 5s poll /api/v1/ohlc?limit=2 → update/append last candle
// - AZ time axis + bottom volume histogram
// - Fixed height 520
// - Range 50/100 = last N bars (viewport only); 200 = fit all

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { getOHLC } from "../../../lib/ohlcClient";
import { SYMBOLS, TIMEFRAMES } from "./constants";

const SEED_LIMIT = 5000; // client cap (backend still clamps ≤ 5000)

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDown: "rgba(239,83,80,0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

// ---------- helpers ----------
const isMs = (t) => typeof t === "number" && t > 1e12;
const toSec = (t) => (isMs(t) ? Math.floor(t / 1000) : t);
const num = (n, d = NaN) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : d;
};
const normBar = (b) => ({
  time: toSec(num(b.time ?? b.t ?? b.ts ?? b.timestamp)),
  open: num(b.open ?? b.o),
  high: num(b.high ?? b.h),
  low: num(b.low ?? b.l),
  close: num(b.close ?? b.c),
  volume: num(b.volume ?? b.v ?? 0),
});

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

// ---------- component ----------
export default function RowChart({
  apiBase = "https://frye-market-backend-1.onrender.com",
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  showDebug = false,
}) {
  // Expose the same base to any helper that looks for it
  useEffect(() => {
    if (typeof window !== "undefined" && apiBase) {
      window.__API_BASE__ = String(apiBase).replace(/\/+$/, "");
    }
  }, [apiBase]);

  // chart refs
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const roRef = useRef(null);

  // stream/polling
  const pollIdRef = useRef(null);

  // data state
  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  // UI state
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: 200, // 200 = fit all
    disabled: false,
  });

  // create chart once
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
      rightPriceScale: { borderColor: DEFAULTS.border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: DEFAULTS.border, timeVisible: true },
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
      minimumHeight: 20,
    });

    // observe size of host only (no feedback loops)
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
      try { clearInterval(pollIdRef.current); } catch {}
      try { roRef.current?.disconnect(); } catch {}
      try { chartRef.current?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update axis labels when timeframe changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      timeVisible: state.timeframe !== "1d",
    });
  }, [state.timeframe]);

  // ----- live polling (simple, robust) -----
  const stopPolling = () => {
    if (pollIdRef.current) {
      clearInterval(pollIdRef.current);
      pollIdRef.current = null;
    }
  };

  const startPolling = (symbol, timeframe) => {
    stopPolling();
    const API = (window.__API_BASE__ || apiBase || "").replace(/\/+$/, "");
    const base =
      `${API}/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}` +
      `&timeframe=${encodeURIComponent(timeframe)}`;

    const tick = async () => {
      try {
        const url = `${base}&limit=2&_=${Date.now()}`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json().catch(() => null);
        const raw = Array.isArray(j) ? j
          : Array.isArray(j?.bars) ? j.bars
          : Array.isArray(j?.data) ? j.data
          : [];
        if (!raw.length) return;
        const last = normBar(raw[raw.length - 1]);
        if (!Number.isFinite(last.time)) return;

        const list = barsRef.current;
        if (!list.length) return;

        const prev = list[list.length - 1];
        if (last.time === prev.time) {
          // update last bar
          const next = list.slice(0, -1).concat(last);
          barsRef.current = next;
          setBars(next);
          seriesRef.current?.update(last);
          volSeriesRef.current?.update({
            time: last.time,
            value: last.volume,
            color: last.close >= last.open ? DEFAULTS.volUp : DEFAULTS.volDown,
          });
        } else if (last.time > prev.time) {
          // append new bar
          const next = list.concat(last);
          barsRef.current = next;
          setBars(next);
          seriesRef.current?.update(last);
          volSeriesRef.current?.update({
            time: last.time,
            value: last.volume,
            color: last.close >= last.open ? DEFAULTS.volUp : DEFAULTS.volDown,
          });
        }

        if (showDebug && typeof window !== "undefined") {
          window.__STREAM_INFO__ = {
            t: last.time,
            iso: new Date(last.time * 1000).toISOString(),
          };
        }
      } catch {
        // keep polling
      }
    };

    // immediate tick + 5s cadence
    tick();
    pollIdRef.current = setInterval(tick, 5000);
  };

  // ----- seed on symbol/timeframe change -----
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((s) => ({ ...s, disabled: true }));
      stopPolling();

      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        if (cancelled) return;

        const asc = (Array.isArray(seed) ? seed : [])
          .map(normBar)
          .filter((b) =>
            Number.isFinite(b.time) &&
            Number.isFinite(b.open) &&
            Number.isFinite(b.high) &&
            Number.isFinite(b.low) &&
            Number.isFinite(b.close)
          )
          .sort((a, b) => a.time - b.time);

        barsRef.current = asc;
        setBars(asc);

        // debug: how much history did we get?
        if (typeof window !== "undefined") {
          const first = asc[0]?.time ?? 0;
          const last = asc[asc.length - 1]?.time ?? 0;
          const spanDays = first && last ? Math.round((last - first) / 86400) : 0;
          window.__ROWCHART_INFO__ = {
            tf: state.timeframe,
            bars: asc.length,
            spanDays,
            source: "/api/v1/ohlc",
          };
          if (showDebug) console.log("[ROWCHART seed]", window.__ROWCHART_INFO__);
        }

        // start live polling
        startPolling(state.symbol, state.timeframe);
      } catch (e) {
        if (showDebug) console.error("[ROWCHART] seed error:", e);
        barsRef.current = [];
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.symbol, state.timeframe, showDebug]);

  // ----- render to series + apply viewport -----
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !series) return;

    // set full candles
    series.setData(bars);

    // set volume series (color by direction)
    if (vol) {
      const volData = bars.map((b) => ({
        time: b.time,
        value: Number(b.volume ?? 0),
        color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
      }));
      vol.setData(volData);
    }

    // viewport
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

  // camera only
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

  const handleControlsChange = (patch) => setState((s) => ({ ...s, ...patch }));

  const handleTest = async () => {
    try {
      const got = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
      alert(`Fetched ${Array.isArray(got) ? got.length : 0} bars from /api/v1/ohlc`);
    } catch {
      alert("Fetch failed");
    }
  };

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
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
        value={state}
        onChange={handleControlsChange}
        onRange={applyRange}     // viewport-only
        onTest={showDebug ? handleTest : null}
      />

      <div
        ref={containerRef}
        style={{ width: "100%", height: 520, minHeight: 360, background: DEFAULTS.bg }}
      />
    </div>
  );
}
