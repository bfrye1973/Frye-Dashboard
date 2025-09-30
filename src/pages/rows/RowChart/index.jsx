// src/pages/rows/RowChart/index.jsx
// RowChart — final, no-slice version
// - Deep seed from /api/v1/ohlc (limit=1500) in EPOCH SECONDS
// - AZ time on hover + bottom axis (same chart instance)
// - Volume histogram (bottom 20%)
// - Fixed height = 520 (no layout changes)
// - Range 50/100 = last N bars (viewport only), 200 = FULL TIMELINE (fitContent)
// - Debug: window.__ROWCHART_INFO__ = { tf, bars, spanDays, source }

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { fetchOHLCResilient } from "../../../lib/ohlcClient";

const SEED_LIMIT = 1500;

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38, 166, 154, 0.5)",
  volDown: "rgba(239, 83, 80, 0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

// Works with number seconds or { timestamp }
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
  // expose API base for client utils that read window.__API_BASE__
  useEffect(() => {
    if (typeof window !== "undefined" && apiBase) {
      window.__API_BASE__ = apiBase.replace(/\/+$/, "");
    }
  }, [apiBase]);

  // refs
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const roRef = useRef(null);

  // data/state
  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: 200, // 🔸 default = FULL TIMELINE
    disabled: false,
  });

  const symbols = useMemo(() => ["SPY", "QQQ", "IWM"], []);
  const timeframes = useMemo(() => ["10m", "1h", "4h", "1d"], []);

  // create chart once
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const chart = createChart(host, {
      width: host.clientWidth,
      height: host.clientHeight,
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

    // resize only the host (avoid loops)
    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return;
      chartRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    });
    ro.observe(host);
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

  // update axis label style when timeframe changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      timeVisible: state.timeframe !== "1d",
    });
  }, [state.timeframe]);

  // fetch seed on symbol/timeframe change — NO slicing
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

        // ensure ascending by time
        const asc = (Array.isArray(bars) ? bars : []).slice().sort((a, b) => a.time - b.time);
        barsRef.current = asc;
        setBars(asc);

        // lightweight debug so we can confirm depth without guessing
        if (typeof window !== "undefined") {
          const first = asc[0]?.time ?? 0;
          const last  = asc[asc.length - 1]?.time ?? 0;
          const spanDays = first && last ? Math.round((last - first) / 86400) : 0;
          window.__ROWCHART_INFO__ = { tf: state.timeframe, bars: asc.length, first, last, spanDays, source };
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

  // RENDER: always set FULL data, then apply viewport preset (no slicing)
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !series) return;

    // ✅ always give the full array to the series
    series.setData(bars);

    if (vol) {
      const volData = bars.map((b) => ({
        time: b.time,
        value: Number(b.volume ?? 0),
        color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
      }));
      vol.setData(volData);
    }

    // Viewport: 200 = FULL, 50/100 = last N bars
    requestAnimationFrame(() => {
      const ts = chart.timeScale();
      const r = state.range;
      const len = bars.length;
      const wantFull = !r || r === 200;
      if (wantFull || !len) {
        ts.fitContent();
        if (showDebug) console.log("[ROWCHART viewport] FULL (fitContent)");
      } else {
        const to = len - 1;
        const from = Math.max(0, to - (r - 1));
        ts.setVisibleLogicalRange({ from, to });
        if (showDebug) console.log(`[ROWCHART viewport] last ${r} bars (from ${from} to ${to})`);
      }
    });
  }, [bars, state.range, showDebug]);

  // viewport-only (used by Controls)
  const applyRange = (nextRange) => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const list = barsRef.current;
    const len = list.length;
    const wantFull = !nextRange || nextRange === 200;
    if (wantFull || !len) {
      ts.fitContent();
      if (showDebug) console.log("[ROWCHART viewport] FULL (via Controls)");
      return;
    }
    const to = len - 1;
    const from = Math.max(0, to - (nextRange - 1));
    ts.setVisibleLogicalRange({ from, to });
    if (showDebug) console.log(`[ROWCHART viewport] last ${nextRange} (via Controls)`);
  };

  // Controls change handler (symbol/timeframe + UI highlight)
  const handleControlsChange = (patch) => {
    setState((s) => ({ ...s, ...patch }));
  };

  // optional test button
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

      {/* DO NOT CHANGE DIMENSIONS */}
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
