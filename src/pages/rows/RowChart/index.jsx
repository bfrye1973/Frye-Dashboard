// src/pages/rows/RowChart/index.jsx
// v4.3 — Clean defaults: EMAs + Volume ON; all other indicators OFF.
//        SMI is still gated to Full Chart, but defaults OFF there too.

import React, { useMemo, useState, useEffect, useRef } from "react";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import useOhlc from "./useOhlc";
import useLwcChart from "./useLwcChart";
import { SYMBOLS, TIMEFRAMES, resolveApiBase } from "./constants";

// Link-only (env-flagged) mode
import LinkOnly from "./LinkOnly";
const LINK_ONLY = process.env.REACT_APP_CHART_LINK_ONLY === "1";

// Overlays / panes
import { createEmaOverlay } from "../../../indicators/ema/overlay";
import { createVolumeOverlay } from "../../../indicators/volume";
import MoneyFlowOverlay from "../../../components/overlays/MoneyFlowOverlay";
import { createLuxSrOverlay } from "../../../indicators/srLux";
import SwingLiquidityOverlay from "../../../components/overlays/SwingLiquidityOverlay";
import { createSmiOverlay } from "../../../indicators/smi";

export default function RowChart({
  apiBase,
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  height = 520,
  onStatus,
  showDebug = false,
}) {
  // If env flag is set, render a link-only panel and exit early
  if (LINK_ONLY) {
    return (
      <LinkOnly
        defaultSymbol={defaultSymbol}
        defaultTimeframe={defaultTimeframe}
        label="Open Full Chart ↗"
      />
    );
  }

  // Detect Full Chart route (so SMI only runs there)
  const isFullChart =
    typeof window !== "undefined" &&
    (window.location.pathname === "/chart" ||
      window.location.pathname.startsWith("/chart"));

  // symbol / timeframe / optional range
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: null,
  });

  // ---- Defaults: EMAs + Volume ON; everything else OFF ----
  const DEFAULT_IND = {
    // EMA
    showEma: true,
    ema10: true,
    ema20: true,
    ema50: true,

    // panes
    volume: true,
    smi: false, // gated to Full Chart, but default OFF

    // overlays
    moneyFlow: false,
    luxSr: false,
    swingLiquidity: false,
  };

  // indicator toggles
  const [ind, setInd] = useState(DEFAULT_IND);

  // theme
  const theme = useMemo(
    () => ({
      layout: { background: { type: "solid", color: "#0a0a0a" }, textColor: "#ffffff" },
      grid: { vertLines: { color: "#1e1e1e" }, horzLines: { color: "#1e1e1e" } },
      rightPriceScale: { borderColor: "#2b2b2b", scaleMargins: { top: 0.06, bottom: 0.08 } },
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
    }),
    []
  );

  // chart mount
  const { containerRef, chart, setData } = useLwcChart({ theme });

  // data feed
  const { bars, loading, error, refetch } = useOhlc({
    apiBase,
    symbol: state.symbol,
    timeframe: state.timeframe,
  });

  // status
  useEffect(() => {
    if (!onStatus) return;
    if (loading) onStatus("loading");
    else if (error) onStatus("error");
    else if (bars.length) onStatus("ready");
    else onStatus("idle");
  }, [loading, error, bars, onStatus]);

  // fetch data
  useEffect(() => {
    void refetch(true);
  }, []); // mount
  useEffect(() => {
    void refetch(true);
  }, [state.symbol, state.timeframe]);

  // set price bars
  useEffect(() => {
    const data = state.range && bars.length > state.range ? bars.slice(-state.range) : bars;
    setData(data);
  }, [bars, state.range, setData]);

  // =========================
  // EMA overlays (on price)
  // =========================
  const emaRef = useRef({});
  useEffect(() => {
    if (!chart) return;
    const removeAll = () => {
      Object.values(emaRef.current).forEach((o) => o?.remove?.());
      emaRef.current = {};
    };
    removeAll();

    if (ind.showEma) {
      if (ind.ema10) emaRef.current.e10 = createEmaOverlay({ chart, period: 10, color: "#60a5fa" });
      if (ind.ema20) emaRef.current.e20 = createEmaOverlay({ chart, period: 20, color: "#f59e0b" });
      if (ind.ema50) emaRef.current.e50 = createEmaOverlay({ chart, period: 50, color: "#34d399" });
    }
    Object.values(emaRef.current).forEach((o) => o?.setBars?.(bars));

    return () => removeAll();
  }, [chart, ind.showEma, ind.ema10, ind.ema20, ind.ema50, bars]);

  // =========================
  // Volume pane (bottom)
  // =========================
  const volRef = useRef(null);
  useEffect(() => {
    if (!chart) return;
    if (volRef.current) {
      volRef.current.remove();
      volRef.current = null;
    }
    if (ind.volume) {
      volRef.current = createVolumeOverlay({ chart });
      volRef.current.setBars(bars);
    }
    return () => {
      volRef.current?.remove();
      volRef.current = null;
    };
  }, [chart, ind.volume, bars]);
  useEffect(() => {
    if (ind.volume && volRef.current) volRef.current.setBars(bars);
  }, [bars, ind.volume]);

  // =========================
  // SMI pane (gated to Full Chart)
  // =========================
  const smiRef = useRef(null);
  useEffect(() => {
    if (!chart || !isFullChart) return; // gate here
    if (smiRef.current) {
      smiRef.current.remove();
      smiRef.current = null;
    }
    if (ind.smi) {
      smiRef.current = createSmiOverlay({
        chart,
        kLen: 12,
        dLen: 7,
        emaLen: 5,
      });
      smiRef.current.setBars(bars);
    }
    return () => {
      smiRef.current?.remove();
      smiRef.current = null;
    };
  }, [chart, ind.smi, bars, isFullChart]);
  useEffect(() => {
    if (isFullChart && ind.smi && smiRef.current) smiRef.current.setBars(bars);
  }, [bars, ind.smi, isFullChart]);

  // =========================
  // Lux S/R (lines + breaks)
  // =========================
  const luxRef = useRef(null);
  useEffect(() => {
    if (!chart) return;
    if (luxRef.current) {
      luxRef.current.remove();
      luxRef.current = null;
    }
    if (ind.luxSr) {
      luxRef.current = createLuxSrOverlay({
        chart,
        leftBars: 15,
        rightBars: 15,
        volumeThresh: 20,
        pivotLeftRight: 5,
        minSeparationPct: 0.25,
        maxLevels: 10,
        lookbackBars: 800,
        markersLookback: 300,
      });
      luxRef.current.setBars(bars);
    }
    return () => {
      luxRef.current?.remove();
      luxRef.current = null;
    };
  }, [chart, ind.luxSr, bars]);
  useEffect(() => {
    if (ind.luxSr && luxRef.current) luxRef.current.setBars(bars);
  }, [bars, ind.luxSr]);

  const baseShown = resolveApiBase(apiBase);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        background: "#0a0a0a",
        border: "1px solid #2b2b2b",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
      }}
    >
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

      <IndicatorsToolbar
        // EMA
        showEma={ind.showEma}
        ema10={ind.ema10}
        ema20={ind.ema20}
        ema50={ind.ema50}
        // Panes
        volume={ind.volume}
        smi={isFullChart ? ind.smi : false}
        showSmiToggle={isFullChart} // only show toggle in Full Chart
        // Overlays
        moneyFlow={ind.moneyFlow}
        luxSr={ind.luxSr}
        swingLiquidity={ind.swingLiquidity}
        // Change handler
        onChange={(patch) => setInd((s) => ({ ...s, ...patch }))}
        // Reset button (optional but handy)
        onReset={() => setInd(DEFAULT_IND)}
      />

      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          justifyContent: "flex-end",
          padding: "6px 12px",
          borderBottom: "1px solid "#2b2b2b",
        }}
      >
        <button
          onClick={() =>
            window.open(`/chart?symbol=${state.symbol}&tf=${state.timeframe}`, "_blank", "noopener")
          }
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

      {showDebug && (
        <div
          style={{
            padding: "6px 12px",
            color: "#9ca3af",
            fontSize: 12,
            borderBottom: "1px solid #2b2b2b",
          }}
        >
          debug • base: {baseShown || "MISSING"} • symbol: {state.symbol} • tf: {state.timeframe} •
          bars: {bars.length}
        </div>
      )}

      {/* Chart host */}
      <div
        className="chart-shell"
        style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <div
          ref={containerRef}
          className="tv-lightweight-charts"
          style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, flex: 1 }}
          data-cluster-host
        >
          {/* Canvas/profile overlays */}
          {ind.moneyFlow && (
            <MoneyFlowOverlay chartContainer={containerRef.current} candles={bars} />
          )}

          {/* Swing Liquidity segments */}
          {ind.swingLiquidity && chart && (
            <SwingLiquidityOverlay
              chart={chart}
              candles={bars}
              leftBars={15}
              rightBars={10}
              volPctGate={0.65}
              extendUntilFilled={true}
              hideFilled={false}
              lookbackBars={800}
              maxOnScreen={80}
            />
          )}
        </div>
      </div>
    </div>
  );
}
