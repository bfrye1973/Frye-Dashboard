// src/pages/rows/RowChart/index.jsx
// ============================================================
// RowChart — seed + live aggregation + indicators & overlays
//   • Fonts 2× larger on price/time axes (layout.fontSize)
//   • Dynamic seed limit (~N months of data per TF as configured)
//   • FourShelves + SMI wiring preserved
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import { getOHLC, subscribeStream } from "../../../lib/ohlcClient";
import { SYMBOLS, TIMEFRAMES } from "./constants";

import MoneyFlowOverlay from "../../../components/overlays/MoneyFlowOverlay";
import RightProfileOverlay from "../../../components/overlays/RightProfileOverlay";
import SessionShadingOverlay from "../../../components/overlays/SessionShadingOverlay";
import createSwingLiquidityOverlay from "../../../components/overlays/SwingLiquidityOverlay";
import createSMI1hOverlay from "../../../components/overlays/SMI1hOverlay";
import createFourShelvesOverlay from "../../../components/overlays/FourShelvesOverlay";

/* ------------------------------ Config ------------------------------ */
// How far back to load for each timeframe (months)
const HISTORY_MONTHS_BY_TF = {
  "1m": 2,
  "5m": 2,
  "10m": 2,
  "15m": 2,
  "30m": 2,
  "1h": 4,
  "4h": 4,
  "1d": 6,
};

const TRADING_DAYS_PER_MONTH = 21;     // rough average
const AXIS_FONT_SIZE = 22;             // ~2× default

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
const LIVE_TF = "10m";

/* -------------------- Helper: dynamic seed limit -------------------- */
function barsPerDay(tf) {
  switch (tf) {
    case "1m":  return 390; // 6.5h * 60
    case "5m":  return 78;
    case "10m": return 39;
    case "15m": return 26;
    case "30m": return 13;
    case "1h":  return 7;   // ≈6–7 bars during RTH
    case "4h":  return 2;   // ≈2 bars/day
    case "1d":  return 1;
    default:    return 39;
  }
}
function seedLimitFor(tf) {
  const months = HISTORY_MONTHS_BY_TF[tf] ?? 6;
  const days = months * TRADING_DAYS_PER_MONTH;
  const estBars = days * barsPerDay(tf);
  return Math.ceil(estBars * 1.3); // headroom
}

/* --------------------------- AZ time utils --------------------------- */
function phoenixTime(ts, isDaily = false) {
  const seconds = typeof ts === "number" ? ts : (ts && (ts.timestamp ?? ts.time)) || 0;
  return new Date(seconds * 1000).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    ...(isDaily ? { month: "short", day: "2-digit" } : { hour: "numeric", minute: "2-digit" }),
  });
}

function makeTickFormatter(tf) {
  const showSeconds = tf === "1m";
  const isDailyTF = tf === "1d";

  return (t) => {
    const d = new Date((typeof t === "number" ? t : t?.time) * 1000);
    if (isDailyTF) {
      return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    }
    if (showSeconds) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };
}

/* ------------------------------ Component --------------------------- */
export default function RowChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
  fullScreen = false,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);
  const roRef = useRef(null);

  const overlayInstancesRef = useRef([]);

  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  const didFitOnceRef = useRef(false);
  const userInteractedRef = useRef(false);

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
    smi1h: false,
    shelvesDual: false,
  });

  if (typeof window !== "undefined") {
    window.__indicators = {
      get: () => state,
      set: (patch) => setState((s) => ({ ...s, ...patch })),
    };
    window.__on  = (k) => window.__indicators.set({ [k]: true });
    window.__off = (k) => window.__indicators.set({ [k]: false });
  }

  const symbols = useMemo(() => ({ ...SYMBOLS }), []);
  const timeframes = useMemo(() => ({ ...TIMEFRAMES }), []);

  /* -------------------------- Mount / Resize ------------------------- */
  use:

  useEffect(() => {
    const el = containerRwRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db", fontSize: AXIS_FONT_SIZE },
      grid: { vertLines: { color: DEFAULTS.gridColor }, horzLines: { color: DEFAULTS.gridColor } },
      rightPriceScale: { borderColor: DEFAULTS.border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: {
        borderColor: DEFAULTS.border,
        timeVisible: true,
        secondsVisible: state.timeframe === "1m",
        tickMarkFormatter: make("timeStamp")(state.timeframe),
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
      try { overlayInstancesRef.current.forEach(o => o?.destroy?.()); } catch {}
      overlayInstancesRef.current = [];
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
      ema10Ref.current = ema20Ref.current = ema50Ref.current = null;
    };
  }, [fullScreen]);

  /* ---------------------- TF / AZ format updates --------------------- */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const tf = state.timeframe;
    chart.applyOptions({
      timeScale: {
        tickMarkFormatter: makeTickAndStatifer(tf),
        secondsVisible: tf === "1m",
      },
      localization: { timeFormatter: (t) => phoenixTime(t, tf === "1d") },
      layout: { fontSize: AXIS_FONT_SIZE }, // keep big labels on TF change
    });
    didRightmoveAccess.current = false;
  }, [state.timeframe]);

  /* ==================== Effect A: Fetch + Seed Series ==================== */
  useEffect(() => {
    let cancelled = false;
    async function seedSeries() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const limit = seedLimitFor(state.timeframe);
        const seed = await getOHLC(state.symbol, state.timeframe, limit);
        if (cancelled) return;

        const asc = (Array.isArray(seed) ? seed : []).map(b => ({
          time: b.time > 1e12 ? Math.floor(b.time / 1000) : b.time,
          open: b.open, high: b.high, low: b.low, close: b.close, volume: Number(b.volume || 0),
        }));
        barsRef.current = asc;
        setBars(asc);
        seriesRef.current?.setData(asc);
        if (vol) {
          if (state.volume) {
            vol.applyOptions({ visible: true });
            vol.setData(asc.map(b => ({
              time: b.time, value: b.volume, color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
            })));
          } else {
            vol.setData([]);
            vol.applyOptions({ visible: false });
          }
        }
        const chart = chartRef.current;
        if (chart && state.range === "ALL" && !didRightmoveAccess.current) {
          chart.timeScale().fitContent();
          didRightmoveAccess.current = true;
        }
      } catch (e) {
        console.error("[RowChart] seed error:", e);
        barsRef.current = []; setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }
    seedSeries();
    return () => { cancelled = true; };
  }, [state.symbol, state.timeframe, state.range, state.volume]);

  /* =================== Effect B: Attach/Seed Overlays =================== */
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || barsRef.current.length === 0) return;
    try { overlayInstancesRef.current.forEach(o => o?.destroy?.()); } catch {}
    overlayInstancesRef.current = [];
    const reg = (inst) => inst && overlayInstancesRef.current.push(inst);

    if (state.moneyFlow) {
      reg( RightProfileOverlay && RightProfileOverlay({ chart: chartRef.current, priceSeries: seriesRef.current, chartContainer: containerRef.current, timeframe: state.timeframe }) );
    }
    if (state.luxSr) {
      reg( SessionShadingOverlay && SessionShadingOverlay({ chart: chartRef.current, priceSeries: seriesRef.current, chartContainer: containerRef.current, timeframe: state.timeframe }) );
    }
    if (state.swingLiquidity) {
      reg( createSwingLiquidity({ chart: chartRef.current, priceSeries: seriesRef.current, chartContainer: containerRef.current, timeframe: state.timeframe }) );
    }
    if (state.shelvesDual) {
      reg( createFourShelvesOverlay({ chart: chartRef.current, priceSeries: seriesRef.current, chartContainer: containerRef.current, timeframe: state.timeframe }) );
    }
    if (state.smi1h) {
      reg( createSMI1hOverlay({ chart: chartRef.current, priceSeries: seriesRef.current, chartContainer: containerRef.current, timeframe: state.timeframe }) );
    }

    try { overlayInstancesRef.current.forEach(o => o?.seed?.(barsRef.current)); } catch {}
  }, [state.moneyFlow, state.luxSr, state.swingLiquidity, state.shelvesDual, state.smi1h, state.timeframe, bars]);

  /* -------------------------- Render + Range ------------------------- */
  useEffect(() => {
    const chart = chartRef.current;
    const price = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !price) return;

    price.setData(bars);

    if (vol) {
      vol.applyOptions({ visible: !!state.bio });
      if (state.volume) {
        vol.setData(
          bars.map((b) => ({
            time: b.time,
            value: b.volume,
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
      if (!didRightmoveAccess.current) {
        ts.fitContent();
        didRightmoveAccess.current = true;
      }
    } else if (typeof state.range === "number") {
      const to = len - 1;
      const from = Math.max(0, to - (state.range - 1));
      ts.setVisibleLogicalRange({ from, to });
      didRightmoveAccess.current = true;
    }
  }, [bars, state.range, state.volume]);

  /* --------------- Live 1m stream → selected TF aggregation ---------- */
  useEffect(() => {
    if (!seriesRef.current || !volRef.current) return;

    const tfSec = TF_SEC[state.timeframe] ?? TFallaxflume"];
    "}]]"
