// src/pages/rows/RowChart/index.jsx
// v3.8 — EMA + Volume + Money Flow Profile (toggles working)

import React, { useMemo, useState, useEffect, useRef } from "react";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import useOhlc from "./useOhlc";
import useLwcChart from "./useLwcChart";
import { SYMBOLS, TIMEFRAMES, resolveApiBase } from "./constants";
import { createEmaOverlay } from "../../../indicators/ema/overlay";
import { createVolumeOverlay } from "../../../indicators/volume";
import MoneyFlowOverlay from "../../../components/overlays/MoneyFlowOverlay";

export default function RowChart({
  apiBase,
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  height = 520,
  onStatus,
  showDebug = false,
}) {
  // symbol/timeframe state
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: null,
  });

  // indicator toggles
  const [ind, setInd] = useState({
    showEma: true,
    ema10: true,
    ema20: true,
    ema50: true,
    volume: true,
    moneyFlow: false,
  });

  // chart theme
  const theme = useMemo(() => ({
    layout: { background: { type:"solid", color:"#0a0a0a" }, textColor:"#ffffff" },
    grid: { vertLines: { color:"#1e1e1e" }, horzLines: { color:"#1e1e1e" } },
    rightPriceScale: { borderColor:"#2b2b2b", scaleMargins:{ top:0.06, bottom:0.03 } },
    timeScale: { borderVisible:true, borderColor:"#2b2b2b", rightOffset:6, barSpacing:12, fixLeftEdge:true, timeVisible:true, secondsVisible:false },
    crosshair: { mode:0 },
    upColor:"#16a34a", downColor:"#ef4444", wickUpColor:"#16a34a", wickDownColor:"#ef4444", borderUpColor:"#16a34a", borderDownColor:"#ef4444",
  }), []);

  // chart mount hook
  const { containerRef, chart, setData } = useLwcChart({ theme });

  // OHLC data hook
  const { bars, loading, error, refetch } = useOhlc({
    apiBase, symbol: state.symbol, timeframe: state.timeframe,
  });

  // status
  useEffect(() => {
    if (!onStatus) return;
    if (loading) onStatus("loading");
    else if (error) onStatus("error");
    else if (bars.length) onStatus("ready");
    else onStatus("idle");
  }, [loading, error, bars, onStatus]);

  // fetch data on mount + symbol/timeframe change
  useEffect(() => { void refetch(true); }, []);
  useEffect(() => { void refetch(true); }, [state.symbol, state.timeframe]);

  // set bars into chart
  useEffect(() => {
    const data = state.range && bars.length > state.range ? bars.slice(-state.range) : bars;
    setData(data);
  }, [bars, state.range, setData]);

  // EMA overlays
  const emaRef = useRef({});
  useEffect(() => {
    if (!chart) return;
    const removeAll = () => {
      Object.values(emaRef.current).forEach(o => o?.remove?.());
      emaRef.current = {};
    };
    removeAll();
    if (ind.showEma) {
      if (ind.ema10) emaRef.current.e10 = createEmaOverlay({ chart, period:10, color:"#60a5fa" });
      if (ind.ema20) emaRef.current.e20 = createEmaOverlay({ chart, period:20, color:"#f59e0b" });
      if (ind.ema50) emaRef.current.e50 = createEmaOverlay({ chart, period:50, color:"#34d399" });
    }
    Object.values(emaRef.current).forEach(o => o?.setBars?.(bars));
    return () => removeAll();
  }, [chart, ind.showEma, ind.ema10, ind.ema20, ind.ema50, bars]);

  // Volume overlay
  const volRef = useRef(null);
  useEffect(() => {
    if (!chart) return;
    if (volRef.current) { volRef.current.remove(); volRef.current = null; }
    if (ind.volume) {
      volRef.current = createVolumeOverlay({ chart });
      volRef.current.setBars(bars);
    }
    return () => { volRef.current?.remove(); volRef.current = null; };
  }, [chart, ind.volume, bars]);

  useEffect(() => {
    if (ind.volume && volRef.current) {
      volRef.current.setBars(bars);
    }
  }, [bars, ind.volume]);

  const baseShown = resolveApiBase(apiBase);

  return (
    <div
      style={{
        flex: 1, minHeight: 0, overflow: "hidden",
        background: "#0a0a0a", border: "1px solid #2b2b2b", borderRadius: 12,
        display:"flex", flexDirection:"column"
      }}
    >
      <Controls
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
        value={{ symbol: state.symbol, timeframe: state.timeframe, range: state.range, disabled: loading }}
        onChange={(patch) => setState(s => ({ ...s, ...patch }))}
        onTest={ showDebug ? async () => {
          const r = await refetch(true);
          alert(r.ok ? `Fetched ${r.count||0} bars` : `Error: ${r.error||"unknown"}`);
        } : undefined }
      />

      <IndicatorsToolbar
        showEma={ind.showEma}
        ema10={ind.ema10}
        ema20={ind.ema20}
        ema50={ind.ema50}
        volume={ind.volume}
        moneyFlow={ind.moneyFlow}
        onChange={(patch) => setInd(s => ({ ...s, ...patch }))}
      />

      <div style={{ flex:"0 0 auto", display:"flex", justifyContent:"flex-end", padding:"6px 12px", borderBottom:"1px solid #2b2b2b" }}>
        <button
          onClick={() => window.open(`/chart?symbol=${state.symbol}&tf=${state.timeframe}`, "_blank", "noopener")}
          style={{ background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b", borderRadius:8, padding:"6px 10px", fontWeight:600, cursor:"pointer" }}
        >
          Open Full Chart ↗
        </button>
      </div>

      {showDebug && (
        <div style={{ padding:"6px 12px", color:"#9ca3af", fontSize:12, borderBottom:"1px solid #2b2b2b" }}>
          debug • base: {baseShown || "MISSING"} • symbol: {state.symbol} • tf: {state.timeframe} • bars: {bars.length}
        </div>
      )}

      {/* Chart host */}
      <div className="chart-shell" style={{ flex:"1 1 auto", minHeight:0, display:"flex", flexDirection:"column" }}>
        <div
          ref={containerRef}
          className="tv-lightweight-charts"
          style={{ position:"relative", width:"100%", height:"100%", minHeight:0, flex:1 }}
          data-cluster-host
        >
          {ind.moneyFlow && (
            <MoneyFlowOverlay
              chartContainer={containerRef.current}
              candles={bars}
            />
          )}
        </div>
      </div>
    </div>
  );
}
