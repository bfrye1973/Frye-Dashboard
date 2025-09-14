// src/pages/rows/RowChart/index.jsx  (v3.0 — precise height, no overlay)
import React, { useMemo, useState, useEffect, useRef } from "react";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import useOhlc from "./useOhlc";
import useLwcChart from "./useLwcChart";
import { SYMBOLS, TIMEFRAMES, resolveApiBase } from "./constants";
import { createEmaOverlay } from "../../../indicators/ema/overlay";

export default function RowChart({
  apiBase,
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  height = 520,                // 👈 explicit pixel height from parent
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
  });

  const theme = useMemo(
    () => ({
      layout: { background: { type: "solid", color: "#0a0a0a" }, textColor: "#e5e7eb" },
      grid:   { vertLines: { color: "#1e1e1e" }, horzLines: { color: "#1e1e1e" } },
      rightPriceScale: { borderColor: "#2b2b2b" },
      timeScale: {
        borderColor: "#2b2b2b",
        rightOffset: 6,
        barSpacing: 8,
        fixLeftEdge: true,
        timeVisible: true,       // 👈 render time labels inside the canvas
        secondsVisible: false,
      },
      crosshair: { mode: 0 },
      upColor: "#16a34a",
      downColor: "#ef4444",
      wickUpColor: "#16a34a",
      wickDownColor: "#ef4444",
      borderUpColor: "#16a34a",
      borderDownColor: "#ef4444",
    }),
    []
  );

  // Main chart gets the exact height provided by the parent
  const { containerRef, chart, setData } = useLwcChart({ height, theme });

  const { bars, loading, error, refetch } = useOhlc({
    apiBase,
    symbol: state.symbol,
    timeframe: state.timeframe,
  });

  // status
  useEffect(() => {
    onStatus && onStatus(loading ? "loading" : error ? "error" : bars.length ? "ready" : "idle");
  }, [loading, error, bars, onStatus]);

  // fetch on mount + when symbol/tf changes
  useEffect(() => { void refetch(true); }, []);
  useEffect(() => { void refetch(true); }, [state.symbol, state.timeframe]);

  // candles → chart
  useEffect(() => {
    const data = state.range && bars.length > state.range ? bars.slice(-state.range) : bars;
    setData(data);
  }, [bars, state.range, setData]);

  // ---------- EMA overlays ----------
  const emaOverlaysRef = useRef({}); // { e10, e20, e50 }

  useEffect(() => {
    if (!chart) return;

    const removeAll = () => {
      Object.values(emaOverlaysRef.current).forEach((o) => o?.remove?.());
      emaOverlaysRef.current = {};
    };

    removeAll();

    if (ind.showEma) {
      if (ind.ema10) emaOverlaysRef.current.e10 = createEmaOverlay({ chart, period: 10, color: "#60a5fa" });
      if (ind.ema20) emaOverlaysRef.current.e20 = createEmaOverlay({ chart, period: 20, color: "#f59e0b" });
      if (ind.ema50) emaOverlaysRef.current.e50 = createEmaOverlay({ chart, period: 50, color: "#34d399" });
    }

    // feed current bars so EMA lines appear immediately
    Object.values(emaOverlaysRef.current).forEach((o) => o?.setBars?.(bars));

    return () => removeAll();
  }, [chart, ind.showEma, ind.ema10, ind.ema20, ind.ema50, bars]);

  // re-feed on bars/toggles change
  useEffect(() => {
    Object.values(emaOverlaysRef.current).forEach((o) => o?.setBars?.(bars));
  }, [bars, ind.showEma, ind.ema10, ind.ema20, ind.ema50]);

  const baseShown = resolveApiBase(apiBase);

  return (
    <div
      style={{
        height,                       // 👈 wrapper matches the explicit height
        overflow: "hidden",
        background: "#0a0a0a",
        border: "1px solid #2b2b2b",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Controls */}
      <Controls
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
        value={{ symbol: state.symbol, timeframe: state.timeframe, range: state.range, disabled: loading }}
        onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
        onTest={
          showDebug
            ? async () => {
                const r = await refetch(true);
                alert(r.ok ? `Fetched ${r.count || 0} bars` : `Error: ${r.error || "unknown"}`);
              }
            : undefined
        }
      />

      {/* Indicators */}
      <IndicatorsToolbar
        showEma={ind.showEma}
        ema10={ind.ema10}
        ema20={ind.ema20}
        ema50={ind.ema50}
        onChange={(patch) => setInd((s) => ({ ...s, ...patch }))}
      />

      {/* Optional debug */}
      {showDebug && (
        <div style={{ padding: "6px 12px", color: "#9ca3af", fontSize: 12, borderBottom: "1px solid #2b2b2b" }}>
          debug • base: {baseShown || "MISSING"} • symbol: {state.symbol} • tf: {state.timeframe} • bars: {bars.length}
        </div>
      )}

      {/* Chart host at exact pixel height — no padding, no overlay */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div ref={containerRef} style={{ position: "relative", height }}>
          {loading && <Overlay>Loading bars…</Overlay>}
          {!loading && !error && bars.length === 0 && <Overlay>No data returned</Overlay>}
          {error && <Overlay>Error: {error}</Overlay>}
        </div>
      </div>

      {/* Full chart link */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 12px", borderTop: "1px solid #2b2b2b" }}>
        <button
          onClick={() => {
            const url = `/chart?symbol=${state.symbol}&tf=${state.timeframe}`;
            window.open(url, "_blank", "noopener");
          }}
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            padding: "6px 10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open Full Chart ↗
        </button>
      </div>
    </div>
  );
}

function Overlay({ children }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9ca3af",
        background: "transparent",
        pointerEvents: "none",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}
