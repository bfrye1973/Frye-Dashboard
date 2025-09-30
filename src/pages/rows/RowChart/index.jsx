// src/pages/rows/RowChart/index.jsx
// Hook-based RowChart (uses your useLwcChart) with deep seed and correct viewport logic.
// - Deep seed from /api/v1/ohlc (limit=1500) in EPOCH SECONDS
// - AZ time on hover + axis via the SAME chart instance (hook handles this)
// - Volume preserved
// - Fixed height = 520px (no layout changes)
// - Range 50/100 = last N bars (viewport only)
// - Range 200 = FULL timeline (fitContent)
// - Debug: window.__ROWCHART_INFO__ shows bars count + span days

import React, { useEffect, useMemo, useRef, useState } from "react";
import Controls from "./Controls";
import useLwcChart from "./useLwcChart";
import { SYMBOLS, TIMEFRAMES, resolveApiBase } from "./constants";
import { fetchOHLCResilient } from "../../../lib/ohlcClient";

const SEED_LIMIT = 1500;

const THEME = {
  // chart appearance for the hook
  layout: { background: { color: "#0b0b14" }, textColor: "#d1d5db" },
  grid: {
    vertLines: { color: "rgba(255,255,255,0.06)" },
    horzLines: { color: "rgba(255,255,255,0.06)" },
  },
  rightPriceScale: { borderColor: "#1f2a44" },
  timeScale: { borderColor: "#1f2a44", timeVisible: true },
  crosshair: { mode: 0 },
  // series colors consumed by the hook
  upColor: "#26a69a",
  downColor: "#ef5350",
  borderUpColor: "#26a69a",
  borderDownColor: "#ef5350",
  wickUpColor: "#26a69a",
  wickDownColor: "#ef5350",
};

export default function RowChart({
  apiBase = "https://frye-market-backend-1.onrender.com",
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  showDebug = false,
}) {
  // resolve API base used by lib client and put it on window for consistency
  const API_BASE = resolveApiBase(apiBase);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__API_BASE__ = API_BASE.replace(/\/+$/, "");
    }
  }, [API_BASE]);

  // use your hook for the actual chart + series
  const { containerRef, chart, setData } = useLwcChart({ theme: THEME });

  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: 200,   // 🔸 default to FULL timeline
    disabled: false,
  });

  const barsRef = useRef([]);

  const symbols = useMemo(() => SYMBOLS, []);
  const timeframes = useMemo(() => TIMEFRAMES, []);

  // seed on symbol/timeframe change (never slice)
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

        const asc = (Array.isArray(bars) ? bars : []).slice().sort((a, b) => a.time - b.time);
        barsRef.current = asc;
        setData(asc); // hook will fitContent() initially

        if (typeof window !== "undefined") {
          const first = asc[0]?.time ?? 0;
          const last  = asc[asc.length - 1]?.time ?? 0;
          const days  = first && last ? Math.round((last - first) / 86400) : 0;
          window.__ROWCHART_INFO__ = {
            tf: state.timeframe,
            bars: asc.length,
            first,
            last,
            spanDays: days,
            source,
          };
          if (showDebug) {
            console.log("[ROWCHART] seed", state.timeframe, "bars:", asc.length, "spanDays:", days, "source:", source);
          }
        }

        // after the hook's fit, apply our viewport preset (below)
        applyViewport(state.range, asc);
      } catch (e) {
        if (showDebug) console.error("[ROWCHART] load error:", e);
        barsRef.current = [];
        setData([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.symbol, state.timeframe, showDebug]);

  // viewport logic: Range 200 = FULL timeline; 50/100 = last N bars
  const applyViewport = (r, list = barsRef.current) => {
    if (!chart) return;
    const ts = chart.timeScale?.();
    if (!ts) return;

    const wantFull = !r || r === 200;
    if (wantFull || !Array.isArray(list) || list.length === 0) {
      ts.fitContent();
      if (showDebug) console.log("[ROWCHART] viewport FULL (fitContent)");
      return;
    }

    const to = list.length - 1;
    const from = Math.max(0, to - (r - 1));
    ts.setVisibleLogicalRange({ from, to });
    if (showDebug) console.log(`[ROWCHART] viewport last ${r} bars (from ${from} to ${to})`);
  };

  // when Range button changes, move the camera (no reseed, no slice)
  useEffect(() => {
    applyViewport(state.range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, state.range]);

  const handleControlsChange = (patch) => {
    setState((s) => ({ ...s, ...patch }));
  };

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
        border: "1px solid #1f2a44",
        borderRadius: 8,
        overflow: "hidden",
        background: "#0b0b14",
      }}
    >
      <Controls
        symbols={symbols}
        timeframes={timeframes}
        value={state}
        onChange={handleControlsChange}
        onRange={(r) => {
          setState((s) => ({ ...s, range: r }));
          applyViewport(r);
        }}
        onTest={showDebug ? handleTest : null}
      />

      {/* Fixed height (no layout changes) */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 520,
          minHeight: 360,
          background: "#0b0b14",
        }}
      />
    </div>
  );
}
