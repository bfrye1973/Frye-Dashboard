// src/pages/rows/RowChart/index.jsx
// ============================================================
// RowChart — seed + live 1m aggregation + indicators & overlays
// - AZ timezone on axis + tooltip
// - Range support ("ALL" fits once; no auto-fit on every tick)
// - IndicatorsToolbar: EMA10/20/50, Volume, MoneyFlow, RightProfile,
//   SessionShading (luxSr), SwingLiquidity
// - fullScreen=true → fills parent (FullChart); false → 520px (dashboard)
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import { getOHLC, subscribeStream } from "../../../lib/ohlcClient";
import { SYMBOLS, TIMEFRAMES } from "./constants"; // ← use constants for menus

// Overlays (optional; attach gracefully)
import MoneyFlowOverlay from "../../../components/overlays/MoneyFlowOverlay";
import RightProfileOverlay from "../../../components/overlays/RightProfileOverlay";
import SessionShadingOverlay from "../../../components/overlays/SessionShadingOverlay";
import SwingLiquidityOverlay from "../../../components/overlays/SwingLiquidityOverlay";

/* ------------------------------ Config ------------------------------ */
const SEED_LIMIT = 6000; // deeper seed window

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDown: "rgba(239,83,80,0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

const TF_SEC = {
  "1m": 60, "5m": 300, "10m": 600, "15m": 900, "30m": 1800,
  "1h": 3600, "4h": 14400, "1d": 86400,
};
const LIVE_TF = "1m";

/* --------------------------- AZ time utils --------------------------- */
function phoenixTime(ts, isDaily = false) {
  const seconds = typeof ts === "number" ? ts : (ts && (ts.timestamp ?? ts.time)) || 0;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(isDaily ? { month: "short", day: "2-digit" } : { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(seconds * 1000));
}

function makeTickFormatter(tf) {
  const showSeconds = tf === "1m";
  const isDailyTF = tf === "1d";

  const fmtTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour: "numeric",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
  });

  const fmtBoundary = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    ...(showSeconds ? { minute: "2-digit" } : {}),
  });

  const fmtDaily = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "2-digit",
  });

  return (t) => {
    const seconds = typeof t === "number" ? t : (t?.timestamp ?? t?.time ?? 0);
    const d = new Date(seconds * 1000);
    if (isDailyTF) return fmtDaily.format(d);
    const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;
    const onHour = d.getMinutes() === 0;
    return (isMidnight || onHour) ? fmtBoundary.format(d) : fmtTime.format(d);
  };
}

/* ------------------------------ Helpers ----------------------------- */
function calcEMA(barsAsc, length) {
  if (!Array.isArray(barsAsc) || !barsAsc.length || !Number.isFinite(length) || length <= 1) return [];
  const k = 2 / (length + 1);
  const out = [];
  let ema;
  for (let i = 0; i < barsAsc.length; i++) {
    const c = Number(barsAsc[i].close);
    if (!Number.isFinite(c)) continue;
    ema = ema === undefined ? c : c * k + ema * (1 - k);
    out.push({ time: barsAsc[i].time, value: ema });
  }
  return out;
}

// Attach overlay that might be a class, factory, or {attach()}
function attachOverlay(Module, args) {
  try {
    if (!Module) return null;
    try { const inst = new Module(args); if (inst && (inst.update || inst.destroy)) return inst; } catch {}
    try { const inst = Module(args); if (inst && (inst.update || inst.destroy)) return inst; } catch {}
    if (typeof Module.attach === "function") return Module.attach(args);
  } catch {}
  return { update() {}, destroy() {} };
}

/* ------------------------------ Component --------------------------- */
export default function RowChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
  fullScreen = false, // FullChart passes true
}) {
  // DOM / series refs
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);
  const roRef = useRef(null);

  // Overlay refs
  const moneyFlowRef = useRef(null);
  const rightProfileRef = useRef(null);
  const sessionShadeRef = useRef(null);
  const swingLiqRef = useRef(null);

  // Data
  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  // Guards
  const didFitOnceRef = useRef(false);
  const userInteractedRef = useRef(false);

  // UI State
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: "ALL",
    disabled: false,

    showEma: true,
    ema10: true,
    ema20: true,
    ema50: true,
    volume: true,
    moneyFlow: false,
    luxSr: false,
    swingLiquidity: false,
  });

  // Use constants for menus (keeps your file logic; no parent changes)
  const symbols = useMemo(() => SYMBOLS, []);
  const timeframes = useMemo(() => TIMEFRAMES, []);

  /* -------------------------- Mount / Resize ------------------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight, // parent controls height (dashboard=520px; full=100%)
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db" },
      grid: { vertLines: { color: DEFAULTS.gridColor }, horzLines: { color: DEFAULTS.gridColor } },
      rightPriceScale: { borderColor: DEFAULTS.border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: {
        borderColor: DEFAULTS.border,
        timeVisible: true,
        secondsVisible: state.timeframe === "1m",
        tickMarkFormatter: makeTickFormatter(state.timeframe),
      },
      localization: { timeFormatter: (t) => phoenixTime(t, state.timeframe === "1d") },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const price = chart.addCandlestickSeries({
      upColor: DEFAULTS.upColor,
      downColor: DEFAULTS.downColor,
      wickUpColor: DEFAULTS.upColor,
      wickDownColor: DEFAULTS.downColor,
      borderUpColor: DEFAULTS.upColor,
      borderDownColor: DEFAULTS.downColor,
    });
    seriesRef.current = price;

    const vol = chart.addHistogramSeries({ priceScaleId: "", priceFormat: { type: "volume" } });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    const markInteract = () => { userInteractedRef.current = true; };
    el.addEventListener("wheel", markInteract, { passive: true });
    el.addEventListener("mousedown", markInteract);

    const ro = new ResizeObserver(() => {
      try { chart.resize(el.clientWidth, el.clientHeight); } catch {}
    });
    ro.observe(el);
    roRef.current = ro;

    return () => {
      try { ro.disconnect(); } catch {}
      try { el.removeEventListener("wheel", markInteract); el.removeEventListener("mousedown", markInteract); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
      ema10Ref.current = ema20Ref.current = ema50Ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullScreen]);

  /* ---------------------- TF / AZ format updates --------------------- */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const tf = state.timeframe;
    chart.applyOptions({
      timeScale: {
        tickMarkFormatter: makeTickFormatter(tf),
        secondsVisible: tf === "1m",
      },
      localization: { timeFormatter: (t) => phoenixTime(t, tf === "1d") },
    });
    didFitOnceRef.current = false; // allow one fit after next seed
  }, [state.timeframe]);

  /* ---------------------------- Seed (fit once) ---------------------- */
  useEffect(() => {
    let cancelled = false;

    async function loadSeed() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        if (cancelled) return;

        const asc = (Array.isArray(seed) ? seed : []).slice().sort((a, b) => a.time - b.time);
        barsRef.current = asc;
        setBars(asc);

        const chart = chartRef.current;
        if (chart && state.range === "ALL" && !didFitOnceRef.current && !userInteractedRef.current) {
          chart.timeScale().fitContent();
          didFitOnceRef.current = true;
        }

        if (showDebug) {
          console.log("[RowChart] Seed:", {
            tf: state.timeframe, count: asc.length, first: asc[0], last: asc[asc.length - 1],
          });
        }
      } catch (e) {
        console.error("[RowChart] OHLC seed error:", e);
        barsRef.current = [];
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }

    loadSeed();
    return () => { cancelled = true; };
  }, [state.symbol, state.timeframe, state.range, showDebug]);

  /* -------------------------- Render + Range ------------------------- */
  useEffect(() => {
    const chart = chartRef.current;
    const price = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !price) return;

    price.setData(bars);

    if (vol) {
      vol.applyOptions({ visible: !!state.volume });
      if (state.volume) {
        vol.setData(
          bars.map((b) => ({
            time: b.time,
            value: Number(b.volume || 0),
            color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
          }))
        );
      } else {
        vol.setData([]);
      }
    }

    const ts = chart.timeScale();
    const len = bars.length;
    if (!len) return;

    if (state.range === "ALL") {
      if (!didFitOnceRef.current && !userInteractedRef.current) {
        ts.fitContent();
        didFitOnceRef.current = true;
      }
    } else if (typeof state.range === "number") {
      const to = len - 1;
      const from = Math.max(0, to - (state.range - 1));
      ts.setVisibleLogicalRange({ from, to });
      didFitOnceRef.current = true;
    }
  }, [bars, state.range, state.volume]);

  /* --------------- Live 1m stream → selected TF aggregation ---------- */
  useEffect(() => {
    if (!seriesRef.current || !volSeriesRef.current) return;

    const tfSec = TF_SEC[state.timeframe] ?? TF_SEC["10m"];
    const floorToBucket = (tSec) => Math.floor(tSec / tfSec) * tfSec;

    let bucketStart = null;
    let rolling = null;

    const lastSeed = barsRef.current[barsRef.current.length - 1] || null;
    if (lastSeed) {
      bucketStart = floorToBucket(lastSeed.time);
      rolling = { ...lastSeed };
    }

    const unsub = subscribeStream(state.symbol, LIVE_TF, (oneMin) => {
      const t = Number(oneMin.time);
      if (!Number.isFinite(t)) return;

      // 1m TF: push minute bar
      if (tfSec === TF_SEC["1m"]) {
        seriesRef.current.update(oneMin);
        if (state.volume) {
          volSeriesRef.current.update({
            time: oneMin.time,
            value: Number(oneMin.volume || 0),
            color: oneMin.close >= oneMin.open ? DEFAULTS.volUp : DEFAULTS.volDown,
          });
        }

        const prev = barsRef.current[barsRef.current.length - 1];
        if (!prev || oneMin.time > prev.time) {
          const next = [...barsRef.current, oneMin];
          barsRef.current = next;
          setBars(next);
        } else {
          const next = [...barsRef.current];
          next[next.length - 1] = oneMin;
          barsRef.current = next;
          setBars(next);
        }
        return;
      }

      // Aggregated TFs
      const start = floorToBucket(t);

      // bucket rollover: commit closed bar
      if (bucketStart === null || start > bucketStart) {
        if (rolling && (!lastSeed || rolling.time >= lastSeed.time)) {
          seriesRef.current.update(rolling);
          if (state.volume) {
            volSeriesRef.current.update({
              time: rolling.time,
              value: Number(rolling.volume || 0),
              color: rolling.close >= rolling.open ? DEFAULTS.volUp : DEFAULTS.volDown,
            });
          }
          const next = [...barsRef.current];
          const last = next[next.length - 1];
          if (!last || rolling.time > last.time) next.push(rolling);
          else next[next.length - 1] = rolling;
          barsRef.current = next;
          setBars(next);
        }

        // start new bucket
        bucketStart = start;
        rolling = {
          time: start,
          open: oneMin.open,
          high: oneMin.high,
          low: oneMin.low,
          close: oneMin.close,
          volume: Number(oneMin.volume || 0),
        };
      } else {
        // update current open bucket
        rolling.high = Math.max(rolling.high, oneMin.high);
        rolling.low = Math.min(rolling.low, oneMin.low);
        rolling.close = oneMin.close;
        rolling.volume = Number(rolling.volume || 0) + Number(oneMin.volume || 0);
      }

      // paint open bucket
      seriesRef.current.update(rolling);
      if (state.volume) {
        volSeriesRef.current.update({
          time: rolling.time,
          value: Number(rolling.volume || 0),
          color: rolling.close >= rolling.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        });
      }
    });

    return () => unsub?.();
  }, [state.symbol, state.timeframe, state.volume]);

  /* ---------------------------- EMA lines ----------------------------- */
  useEffect(() => {
    const chart = chartRef.current;
    const price = seriesRef.current;
    if (!chart || !price) return;

    const ensureLine = (ref, color) => {
      if (!ref.current) {
        ref.current = chart.addLineSeries({
          color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      return ref.current;
    };

    // Hide all first
    if (ema10Ref.current) ema10Ref.current.applyOptions({ visible: false });
    if (ema20Ref.current) ema20Ref.current.applyOptions({ visible: false });
    if (ema50Ref.current) ema50Ref.current.applyOptions({ visible: false });

    if (!state.showEma || bars.length === 0) return;

    if (state.ema10) {
      const l = ensureLine(ema10Ref, "#f59e0b");
      l.setData(calcEMA(bars, 10));
      l.applyOptions({ visible: true });
    }
    if (state.ema20) {
      const l = ensureLine(ema20Ref, "#3b82f6");
      l.setData(calcEMA(bars, 20));
      l.applyOptions({ visible: true });
    }
    if (state.ema50) {
      const l = ensureLine(ema50Ref, "#10b981");
      l.setData(calcEMA(bars, 50));
      l.applyOptions({ visible: true });
    }
  }, [bars, state.showEma, state.ema10, state.ema20, state.ema50]);

  /* ----------------------------- Overlays ---------------------------- */
  useEffect(() => {
  const chart = chartRef.current;
  const price = seriesRef.current;
  if (!chart || !price) return;

  if (state.moneyFlow) {
    // create once
    if (!moneyFlowRef.current) {
      moneyFlowRef.current = attachOverlay(MoneyFlowOverlay, {
        chartContainer: containerRef.current,
      });
    }
    // update on every bars change
    try {
      moneyFlowRef.current?.update?.(bars);
    } catch (e) {
      console.warn("[MoneyFlow] update failed:", e);
    }
  } else {
    // toggle off → clean up
    try {
      moneyFlowRef.current?.destroy?.();
    } catch (e) {
      console.warn("[MoneyFlow] destroy failed:", e);
    }
    moneyFlowRef.current = null;
  }
}, [state.moneyFlow, bars]);


   // Right Profile (tie to Volume for now)
 useEffect(() => {
   const chart = chartRef.current; const price = seriesRef.current;
   if (!chart || !price) return;

   if (state.volume) {
     if (!rightProfileRef.current) {
       rightProfileRef.current = attachOverlay(RightProfileOverlay, {
         chartContainer: containerRef.current,   // << pass container
      });
    }
    try { rightProfileRef.current.update?.(bars); } catch {}
  } else {
    try { rightProfileRef.current?.destroy?.(); } catch {}
    rightProfileRef.current = null;
  }
}, [state.volume, bars]);

  // Lux S/R → Session shading
 useEffect(() => {
   const chart = chartRef.current; const price = seriesRef.current;
   if (!chart || !price) return;

   if (state.luxSr) {
     if (!sessionShadeRef.current) {
       sessionShadeRef.current = attachOverlay(SessionShadingOverlay, {
         chartContainer: containerRef.current,   // << container
      });
    }
    try {
      sessionShadeRef.current.update?.(bars, { timeframe: state.timeframe });
    } catch {}
  } else {
    try { sessionShadeRef.current?.destroy?.(); } catch {}
    sessionShadeRef.current = null;
  }
}, [state.luxSr, state.timeframe, bars]);


  // Swing Liquidity (pivots)
 useEffect(() => {
   const chart = chartRef.current; const price = seriesRef.current;
   if (!chart || !price) return;

   if (state.swingLiquidity) {
    if (!swingLiqRef.current) {
       swingLiqRef.current = attachOverlay(SwingLiquidityOverlay, {
         chart,                    // << pass chart instance
      });
    }
    try { swingLiqRef.current.update?.(bars); } catch {}
  } else {
    try { swingLiqRef.current?.destroy?.(); } catch {}
    swingLiqRef.current = null;
  }
}, [state.swingLiquidity, bars]);

  /* ----------------------------- Handlers ---------------------------- */
  const handleControlsChange = (patch) => setState((s) => ({ ...s, ...patch }));

  const applyRange = (nextRange) => {
    const chart = chartRef.current;
    if (!chart) return;

    setState((s) => ({ ...s, range: nextRange }));

    const ts = chart.timeScale();
    const list = barsRef.current;
    const len = list.length;
    if (!len) return;

    if (nextRange === "ALL") {
      ts.fitContent();
      didFitOnceRef.current = true;
      userInteractedRef.current = true;
      return;
    }
    const r = Number(nextRange);
    if (!Number.isFinite(r) || r <= 0) {
      ts.fitContent();
      didFitOnceRef.current = true;
      userInteractedRef.current = true;
      return;
    }
    const to = len - 1;
    const from = Math.max(0, to - (r - 1));
    ts.setVisibleLogicalRange({ from, to });
    didFitOnceRef.current = true;
    userInteractedRef.current = true;
  };

  const toolbarProps = {
    showEma: state.showEma,
    ema10: state.ema10, ema20: state.ema20, ema50: state.ema50,
    volume: state.volume,
    moneyFlow: state.moneyFlow, luxSr: state.luxSr, swingLiquidity: state.swingLiquidity,
    onChange: handleControlsChange, // toolbar sends patches with the exact keys above
    onReset: () =>
      setState((s) => ({
        ...s,
        showEma: true, ema10: true, ema20: true, ema50: true,
        volume: true, moneyFlow: false, luxSr: false, swingLiquidity: false,
      })),
  };

  /* ------------------------------ Render ----------------------------- */
  // Wrapper: fullscreen fills parent; dashboard keeps border chrome
  const wrapperStyle = useMemo(() => {
    return fullScreen
      ? {
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          background: DEFAULTS.bg,
        }
      : {
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${DEFAULTS.border}`,
          borderRadius: 8,
          overflow: "hidden",
          background: DEFAULTS.bg,
        };
  }, [fullScreen]);

  // Chart container: dashboard fixed 520px; FullChart = 100%
  const containerStyle = useMemo(() => {
    return fullScreen
      ? {
          width: "100%",
          height: "100%",
          minHeight: 0,
          maxHeight: "none",
          flex: "1 1 auto",
          overflow: "hidden",
          background: DEFAULTS.bg,
          position: "relative",  
        }
      : {
          width: "100%",
          height: "520px",
          minHeight: 520,
          maxHeight: 520,
          flex: "0 0 auto",
          overflow: "hidden",
          background: DEFAULTS.bg,
          position: "relative", 
        };
  }, [fullScreen]);

  return (
    <div style={wrapperStyle}>
      <Controls
        symbols={symbols}
        timeframes={timeframes}
        value={state}
        onChange={handleControlsChange}
        onRange={applyRange}
      />

      <IndicatorsToolbar {...toolbarProps} />

      {/* Chart container – parent determines height */}
      <div ref={containerRef} style={containerStyle} />
    </div>
  );
}
