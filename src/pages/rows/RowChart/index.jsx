// src/pages/rows/RowChart/index.jsx
// RowChart: seeds deep history from /api/v1/ohlc, renders Lightweight Charts,
// keeps AZ time on hover + axis, adds a bottom volume histogram,
// and makes Range 50/100 viewport-only (last N bars) while Range 200 = FULL TIMELINE (fitContent).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { fetchOHLCResilient } from "../../../lib/ohlcClient";

// ---- constants ------------------------------------------------------------
const SEED_LIMIT = 1500; // deep seed for 10m/1h; server still clamps to ≤5000

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38, 166, 154, 0.5)",
  volDown: "rgba(239, 83, 80, 0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

// ---- helpers --------------------------------------------------------------
const isMs = (t) => typeof t === "number" && t > 1e12;
const toSec = (t) => (isMs(t) ? Math.floor(t / 1000) : t);

// Phoenix (America/Phoenix) time formatter that works for numbers or {timestamp}
function phoenixTime(ts, forDaily = false) {
  const seconds =
    typeof ts === "number"
      ? ts
      : ts && typeof ts.timestamp === "number"
      ? ts.timestamp
      : 0;
  const d = new Date(seconds * 1000);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(forDaily
      ? { month: "short", day: "2-digit" }
      : { hour: "numeric", minute: "2-digit" }),
  }).format(d);
}

// ---- component ------------------------------------------------------------
export default function RowChart({
  apiBase = "https://frye-market-backend-1.onrender.com",
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  showDebug = false,
}) {
  // Allow the lib client to pick up the backend base
  useEffect(() => {
    if (typeof window !== "undefined" && apiBase) {
      window.__API_BASE__ = apiBase.replace(/\/+$/, "");
    }
  }, [apiBase]);

  // chart refs
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const resizeObsRef = useRef(null);

  // data state
  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: 200, // 🔸 default to FULL timeline (we treat 200 as fitContent)
    disabled: false,
  });

  // options
  const symbols = useMemo(() => ["SPY", "QQQ", "IWM"], []);
  const timeframes = useMemo(() => ["10m", "1h", "4h", "1d"], []);

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
      crosshair: { mode: 0 }, // Normal
    });
    chartRef.current = chart;

    // Candles
    const series = chart.addCandlestickSeries({
      upColor: DEFAULTS.upColor,
      downColor: DEFAULTS.downColor,
      wickUpColor: DEFAULTS.upColor,
      wickDownColor: DEFAULTS.downColor,
      borderUpColor: DEFAULTS.upColor,
      borderDownColor: DEFAULTS.downColor,
    });
    seriesRef.current = series;

    // Volume (bottom histogram on its own scale)
    const volSeries = chart.addHistogramSeries({
      priceScaleId: "", // separate scale at the bottom
      priceFormat: { type: "volume" },
    });
    // push volume to the bottom 20% of the pane
    volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = volSeries;

    chart.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      minimumHeight: 20,
    });

    // resize observer
    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return;
      chartRef.current.resize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    });
    ro.observe(el);
    resizeObsRef.current = ro;

    return () => {
      try { resizeObsRef.current?.disconnect(); } catch {}
      try { chartRef.current?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // create once

  // update axis formatter when timeframe changes (daily vs intraday labels)
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      timeVisible: state.timeframe !== "1d",
    });
  }, [state.timeframe]);

  // fetch seed on symbol/timeframe change (deep, independent of Range)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const { source, bars } = await fetchOHLCResilient({
          symbol: state.symbol,
          timeframe: state.timeframe,
          limit: SEED_LIMIT,
        });
        if (cancelled) return;
        // Ensure ascending time order
        const asc = (Array.isArray(bars) ? bars : []).slice().sort((a, b) => a.time - b.time);
        barsRef.current = asc;
        setBars(asc);
        if (showDebug && typeof window !== "undefined") {
          console.log("[RowChart] seed", state.timeframe, asc.length, "source:", source);
        }
      } catch (e) {
        if (showDebug) console.error("[RowChart] load error:", e);
        barsRef.current = [];
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [state.symbol, state.timeframe, showDebug]);

  // render bars to series (always the full dataset), then apply viewport preset
  useEffect(() => {
    const series = seriesRef.current;
    const volSeries = volSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    // Candles
    series.setData(bars);

    // Volume (color by candle direction)
    if (volSeries) {
      const volData = bars.map((b) => ({
        time: b.time,
        value: Number(b.volume ?? 0),
        color: (b.close >= b.open) ? DEFAULTS.volUp : DEFAULTS.volDown,
      }));
      volSeries.setData(volData);
    }

    // Viewport: Range 200 = FULL TIMELINE (fit), 50/100 = last N bars
    requestAnimationFrame(() => {
      const ts = chart.timeScale();
      const r = state.range;
      const len = bars.length;
      const wantFull = !r || r === 200; // 🔸 treat 200 as FULL
      if (wantFull || !len) {
        ts.fitContent();
      } else {
        const to = len - 1;
        const from = Math.max(0, to - (r - 1));
        ts.setVisibleLogicalRange({ from, to });
      }
    });
  }, [bars, state.range]);

  // viewport-only applyRange (used by Controls.onRange)
  const applyRange = (nextRange) => {
    const chart = chartRef.current;
    if (!chart) return;
    const len = barsRef.current.length;
    const ts = chart.timeScale();
    const wantFull = !nextRange || nextRange === 200; // 🔸 200 => FULL
    if (wantFull || !len) {
      ts.fitContent();
      return;
    }
    const to = len - 1;
    const from = Math.max(0, to - (nextRange - 1));
    ts.setVisibleLogicalRange({ from, to });
  };

  // Controls change handler (state drives symbol/timeframe + UI highlight)
  const handleControlsChange = (patch) => {
    setState((s) => ({ ...s, ...patch }));
    // Note: viewport moves via applyRange (Controls.onRange) or via effect above.
  };

  // Optional: a quick fetch tester for the button
  const handleTest = async () => {
    try {
      const { source, bars } = await fetchOHLCResilient({
        symbol: state.symbol,
        timeframe: state.timeframe,
        limit: SEED_LIMIT,
      });
      alert(`Fetched ${bars.length} bars from ${source}`);
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
        onRange={applyRange}        // viewport-only (no reseed/trim)
        onTest={showDebug ? handleTest : null}
      />

      {/* NOTE: Dimensions preserved — fixed height 520 like before */}
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
