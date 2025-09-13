// src/pages/rows/RowChart/index.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import TimelineOverlay from "./TimelineOverlay";
import useOhlc from "./useOhlc";
import useLwcChart from "./useLwcChart";
import { SYMBOLS, TIMEFRAMES, resolveApiBase } from "./constants";
import { createEmaOverlay } from "../../../indicators/ema/overlay"; // <-- path from RowChart to indicators

export default function RowChart({
  apiBase,
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  height = 520,
  onStatus,
  showDebug = false, // set true to show Test Fetch + debug badge
}) {
  // UI state
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: null,
  });

  // Indicator toggles
  const [ind, setInd] = useState({
    showEma: true,
    ema10: true,
    ema20: true,
    ema50: true,
  });

  // Theme for lightweight-charts
  const theme = useMemo(
    () => ({
      layout: { background: { type: "solid", color: "#0a0a0a" }, textColor: "#e5e7eb" },
      grid: { vertLines: { color: "#1e1e1e" }, horzLines: { color: "#1e1e1e" } },
      rightPriceScale: { borderColor: "#2b2b2b" },
      timeScale: { borderColor: "#2b2b2b", rightOffset: 6, barSpacing: 8, fixLeftEdge: true },
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

  // Main chart + data
  const { containerRef, chart, setData } = useLwcChart({ height, theme });
  const { bars, loading, error, refetch } = useOhlc({
    apiBase,
    symbol: state.symbol,
    timeframe: state.timeframe,
  });

  // Status callback (optional)
  useEffect(() => {
    onStatus &&
      onStatus(loading ? "loading" : error ? "error" : bars.length ? "ready" : "idle");
  }, [loading, error, bars, onStatus]);

  // Fetch immediately on mount
  useEffect(() => {
    void refetch(true);
  }, []); // mount only

  // Refetch when symbol/timeframe change
  useEffect(() => {
    void refetch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.symbol, state.timeframe]);

  // Push bars into base candle series (respect range buttons)
  useEffect(() => {
    const data =
      state.range && bars.length > state.range ? bars.slice(-state.range) : bars;
    setData(data);
  }, [bars, state.range, setData]);

  // ---------- EMA overlays ----------
  const emaOverlaysRef = useRef({}); // { e10, e20, e50 }

  // Create / remove overlays when chart is ready or toggles change
  useEffect(() => {
    if (!chart) return;

    const removeAll = () => {
      Object.values(emaOverlaysRef.current).forEach((o) => o?.remove?.());
      emaOverlaysRef.current = {};
    };

    removeAll();

    if (ind.showEma) {
      if (ind.ema10) emaOverlaysRef.current.e10 = createEmaOverlay({ chart, period: 10, color: "#60a5fa" }); // blue
      if (ind.ema20) emaOverlaysRef.current.e20 = createEmaOverlay({ chart, period: 20, color: "#f59e0b" }); // amber
      if (ind.ema50) emaOverlaysRef.current.e50 = createEmaOverlay({ chart, period: 50, color: "#34d399" }); // green
    }

    return () => removeAll();
  }, [chart, ind.showEma, ind.ema10, ind.ema20, ind.ema50]);

  // Feed bars to overlays
  useEffect(() => {
    const overlays = emaOverlaysRef.current;
    Object.values(overlays).forEach((o) => o?.setBars?.(bars));
  }, [bars]);

  const baseShown = resolveApiBase(apiBase);

  return (
    <div
      style={{
        height,
        overflow: "hidden",
        background: "#0a0a0a",
        border: "1px solid #2b2b2b",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top controls */}
      <Controls
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
        value={{
          symbol: state.symbol,
          timeframe: state.timeframe,
          range: state.range,
          disabled: loading,
        }}
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

      {/* Indicators toolbar (EMA toggles) */}
      <IndicatorsToolbar
        showEma={ind.showEma}
        ema10={ind.ema10}
        ema20={ind.ema20}
        ema50={ind.ema50}
        onChange={(patch) => setInd((s) => ({ ...s, ...patch }))}
      />

      {/* Debug badge (optional) */}
      {showDebug && (
        <div
          style={{
            padding: "6px 12px",
            color: "#9ca3af",
            fontSize: 12,
            borderBottom: "1px solid #2b2b2b",
          }}
        >
          debug • base: {baseShown || "MISSING"} • symbol: {state.symbol} • tf: {state.timeframe} • bars: {bars.length}
        </div>
      )}

      {/* Main chart canvas host */}
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        {loading && <Overlay>Loading bars…</Overlay>}
        {!loading && !error && bars.length === 0 && <Overlay>No data returned</Overlay>}
        {error && <Overlay>Error: {error}</Overlay>}
        {/* If you kept TimelineOverlay.jsx, this renders the hour/date rows */}
        <TimelineOverlay chart={chart} container={containerRef.current} />
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
