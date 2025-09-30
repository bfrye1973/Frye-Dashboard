// src/pages/rows/RowChart/index.jsx
// RowChart — final minimal path (no slicing)
// - Seeds with getOHLC(limit=1500) → full array
// - AZ time on hover + bottom axis
// - Volume histogram (bottom 20%)
// - Fixed height = 520
// - Range 50/100 = last N bars (viewport only), 200 = FULL TIMELINE (fitContent)
// - window.__ROWCHART_INFO__ set on each seed so we can see bars/spanDays

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { getOHLC } from "../../../lib/ohlcClient";

const SEED_LIMIT = 1500;

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDown: "rgba(239,83,80,0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

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
  apiBase = "https://frye-market-backend-1.onrender.com",
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  showDebug = false,
}) {
  // Make sure lib client sees the same base
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
    range: 200, // 200 = FULL timeline
    disabled: false,
  });

  const symbols = useMemo(() => ["SPY", "QQQ", "IWM"], []);
  const timeframes = useMemo(() => ["10m", "1h", "4h", "1d"], []);

  // Create chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db" },
      grid: { vertLines: { color: DEFAULTS.gridColor }, horzLines: { color: DEFAULTS.gridColor } },
      rightPriceScale: { borderColor: DEFAULTS.border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: DEFAULTS.border, timeVisible: true },
      localization: { timezone: "America/Phoenix", timeFormatter: (t) => phoenixTime(t, state.timeframe === "1d") },
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

    const vol = chart.addHistogramSeries({ priceScaleId: "", priceFormat: { type: "volume" } });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    chart.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      minimumHeight: 20,
    });

    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return;
      chartRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    });
    ro.observe(el);
    roRef = ro;

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update bottom axis when timeframe changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      timeVisible: state.timeframe !== "1d",
    });
  }, [state.timeframe]);

  // Seed on symbol/timeframe change — NO slicing
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        if (cancelled) return;

        const asc = (Array.isArray(seed) ? seed : []).slice().sort((a, b) => a.time - b.time);
        barsRef.current = asc;
        setBars(asc);

        if (typeof window !== "undefined") {
          const first = asc[0]?.time ?? 0;
          const last = asc[asc.length - 1]?.time ?? 0;
          const spanDays = first && last ? Math.round((last - first) / 86400) : 0;
          window.__ROWCHART_INFO__ = { tf: state.timeframe, bars: asc.length, spanDays, source: "api/v1/ohlc" };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.symbol, state.timeframe, showDebug]);

  // Render full data + apply viewport preset
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !series) return;

    // Always set FULL data
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

    // Viewport: 200 = fit all; 50/100 = last N bars
    requestAnimationFrame(() => {
      const ts = chart.timeScale();
      const r = state.range;
      const len = bars.length;
      if (!r || r === 200 || !len) {
        ts.fitContent();
        if (showDebug) console.log("[ROWCHART viewport] FULL (fitContent)");
      } else {
        const to = len - 1;
        const from = Math.max(0, to - (r - 1));
        ts.setVisibleLogicalRange({ from, to });
        if (showDebug) console.log(`[ROWCHART viewport] last ${r} bars`);
      }
    });
  }, [bars, state.range, showDebug]);

  // Camera only
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
      const bars = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
      alert(`Fetched ${bars.length} bars from /api/v1/ohlc`);
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
        symbols={symbols}
        timeframes={timeframes}
        value={state}
        onChange={handleControlsChange}
        onRange={applyRange}
        onTest={showDebug ? handleTest : null}
      />
      <div
        ref={containerRef}
        style={{ width: "100%", height: 520, minHeight: 360, background: DEFAULTS.bg }}
      />
    </div>
  );
}
