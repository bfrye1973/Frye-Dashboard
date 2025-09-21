// src/pages/rows/RowChart/index.jsx
// v3.5 — mounts MoneyFlowOverlay (absolute layer), white labels, flexible height

import React, { useMemo, useState, useEffect, useRef } from "react";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import useOhlc from "./useOhlc";
import useLwcChart from "./useLwcChart";
import { SYMBOLS, TIMEFRAMES, resolveApiBase } from "./constants";
import { createEmaOverlay } from "../../../indicators/ema/overlay";

// NEW: visual overlay (draws on its own canvas; no pointer intercepts)
import MoneyFlowOverlay from "../../../components/overlays/MoneyFlowOverlay";

export default function RowChart({
  apiBase,
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  height = 520,          // fallback only; CSS controls final height
  onStatus,
  showDebug = false,
}) {
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: null,
  });

  const [ind, setInd] = useState({
    showEma: true,
    ema10: true,
    ema20: true,
    ema50: true,
    // future: showMoneyFlowProfile toggle can live here
  });

  const theme = useMemo(() => ({
    layout: { background: { type: "solid", color: "#0a0a0a" }, textColor: "#ffffff" },
    grid: { vertLines: { color: "#1e1e1e" }, horzLines: { color: "#1e1e1e" } },
    rightPriceScale: { borderColor: "#2b2b2b", scaleMargins: { top: 0.06, bottom: 0.03 } },
    timeScale: {
      borderVisible: true,
      borderColor: "#2b2b2b",
      rightOffset: 6,
      barSpacing: 12,
      fixLeftEdge: true,
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: { mode: 0 },
    upColor: "#16a34a",
    downColor: "#ef4444",
    wickUpColor: "#16a34a",
    wickDownColor: "#ef4444",
    borderUpColor: "#16a34a",
    borderDownColor: "#ef4444",
  }), []);

  // Chart mount
  const { containerRef, chart, setData } = useLwcChart({ theme });

  // Data feed
  const { bars, loading, error, refetch } = useOhlc({
    apiBase, symbol: state.symbol, timeframe: state.timeframe,
  });

  // Status upcalls
  useEffect(() => {
    if (!onStatus) return;
    if (loading) onStatus("loading");
    else if (error) onStatus("error");
    else if (bars.length) onStatus("ready");
    else onStatus("idle");
  }, [loading, error, bars, onStatus]);

  // First fetch + refetch on symbol/tf change
  useEffect(() => { void refetch(true); }, []); // mount
  useEffect(() => { void refetch(true); }, [state.symbol, state.timeframe]);

  // Feed bars to chart (with optional range window)
  useEffect(() => {
    const data = state.range && bars.length > state.range ? bars.slice(-state.range) : bars;
    setData(data);
  }, [bars, state.range, setData]);

  // EMA overlays (keep as-is)
  const emaOverlaysRef = useRef({});
  useEffect(() => {
    if (!chart) return;
    const removeAll = () => {
      Object.values(emaOverlaysRef.current).forEach(o => o?.remove?.());
      emaOverlaysRef.current = {};
    };
    removeAll();
    if (ind.showEma) {
      if (ind.ema10) emaOverlaysRef.current.e10 = createEmaOverlay({ chart, period: 10, color: "#60a5fa" });
      if (ind.ema20) emaOverlaysRef.current.e20 = createEmaOverlay({ chart, period: 20, color: "#f59e0b" });
      if (ind.ema50) emaOverlaysRef.current.e50 = createEmaOverlay({ chart, period: 50, color: "#34d399" });
    }
    Object.values(emaOverlaysRef.current).forEach(o => o?.setBars?.(bars));
    return () => removeAll();
  }, [chart, ind.showEma, ind.ema10, ind.ema20, ind.ema50, bars]);

  useEffect(() => {
    Object.values(emaOverlaysRef.current).forEach(o => o?.setBars?.(bars));
  }, [bars, ind.showEma, ind.ema10, ind.ema20, ind.ema50]);

  const baseShown = resolveApiBase(apiBase);

  return (
    <div
      /* FLEX (no fixed height here; CSS/grid controls row size) */
      style={{
        flex: 1, minHeight: 0, overflow: "hidden",
        background: "#0a0a0a", border: "1px solid #2b2b2b", borderRadius: 12,
        display: "flex", flexDirection: "column"
      }}
    >
      <Controls
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
        value={{ symbol: state.symbol, timeframe: state.timeframe, range: state.range, disabled: loading }}
        onChange={(patch) => setState(s => ({ ...s, ...patch }))}
        onTest={showDebug ? async () => {
          const r = await refetch(true);
          alert(r.ok ? `Fetched ${r.count || 0} bars` : `Error: ${r.error || "unknown"}`);
        } : undefined}
      />

      <IndicatorsToolbar
        showEma={ind.showEma}
        ema10={ind.ema10} ema20={ind.ema20} ema50={ind.ema50}
        onChange={(patch) => setInd(s => ({ ...s, ...patch }))}
      />

      <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "flex-end", padding: "6px 12px", borderBottom: "1px solid #2b2b2b" }}>
        <button
          onClick={() => window.open(`/chart?symbol=${state.symbol}&tf=${state.timeframe}`, "_blank", "noopener")}
          style={{ background: "#0b0b0b", color: "#e5e7eb", border: "1px solid #2b2b2b", borderRadius: 8, padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
        >
          Open Full Chart ↗
        </button>
      </div>

      {showDebug && (
        <div style={{ padding: "6px 12px", color: "#9ca3af", fontSize: 12, borderBottom: "1px solid #2b2b2b" }}>
          debug • base: {baseShown || "MISSING"} • symbol: {state.symbol} • tf: {state.timeframe} • bars: {bars.length}
        </div>
      )}

      {/* Chart host (fills remainder) */}
      <div className="chart-shell" style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          ref={containerRef}
          className="tv-lightweight-charts"
          style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, flex: 1 }}
          data-cluster-host
        >
          {/* Absolute overlay canvas (visual-only) */}
          <MoneyFlowOverlay
            chartContainer={containerRef.current}
            candles={bars}
          />
        </div>
      </div>
    </div>
  );
}
