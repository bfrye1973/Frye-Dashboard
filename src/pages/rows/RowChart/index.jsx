// src/pages/rows/RowChart/index.jsx
// ============================================================
// RowChart — seed + live aggregation + indicators & overlays
// TURBO MODE:
//  - 1m + 5m history capped to 2 months (faster zoom/pan)
//  - React state updates throttled (no re-render spam)
//  - Overlays attach/seed only after seeding (not on every live tick)
//  - SSE subscription stable (no thrash)
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";

import { getOHLC, subscribeStream } from "../../../lib/ohlcClient";
import { getChartOverlay } from "../../../lib/chartOverlayClient";
import { SYMBOLS, TIMEFRAMES } from "./constants";

import MoneyFlowOverlay from "../../../components/overlays/MoneyFlowOverlay";
import RightProfileOverlay from "../../../components/overlays/RightProfileOverlay";
import SessionShadingOverlay from "../../../components/overlays/SessionShadingOverlay";
import createSwingLiquidityOverlay from "../../../components/overlays/SwingLiquidityOverlay";
import createSMI1hOverlay from "../../../components/overlays/SMI1hOverlay";
import createFourShelvesOverlay from "../../../components/overlays/FourShelvesOverlay";

import SMZNegotiatedOverlay from "./overlays/SMZNegotiatedOverlay";
import Engine17Overlay from "./overlays/Engine17Overlay";
import Engine17Badges from "./overlays/Engine17Badges";
import Engine17DecisionTimeline from "./overlays/Engine17DecisionTimeline";

import createSmartMoneyZonesOverlay from "../../../components/overlays/SmartMoneyZonesOverlay";
import SmartMoneyZonesPanel from "../../../components/smz/SmartMoneyZonesPanel";

import SMZLevelsOverlay from "./overlays/SMZLevelsOverlay";
import SMZShelvesOverlay from "./overlays/SMZShelvesOverlay";
import AccDistZonesPanel from "../../../components/smz/AccDistZonesPanel";

import FibLevelsOverlay from "./overlays/FibLevelsOverlay";

// ✅ NEW: Professional TradingView-like drawings system (left toolbar + engine)
import DrawingsToolbar from "../../../features/drawings/DrawingsToolbar";
import { createDrawingsEngine } from "../../../features/drawings/createDrawingsEngine";

/* ------------------------------ Config ------------------------------ */

const HISTORY_MONTHS = 6;
const FAST_MONTHS_INTRADAY = 2; // ✅ Turbo: 1m + 5m only
const TRADING_DAYS_PER_MONTH = 21;
const AXIS_FONT_SIZE = 22;

// ✅ Turbo UI sync: chart updates every tick; React updates only every 1s
const UI_SYNC_MS = 1000;

// ✅ Hard cap to prevent memory bloat on long sessions
const MAX_KEEP_BARS = 25000;

// ✅ LIVE indicator rules
const LIVE_STALE_MS = 30_000; // red if we haven't received ANY SSE json msg (diag/snapshot/bar) in 30s

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
  "1m": 60,
  "5m": 300,
  "10m": 600,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

const LIVE_TF = "1m";

/* -------------------- Helper: dynamic seed limit -------------------- */

function barsPerDay(tf) {
  switch (tf) {
    case "1m":
      return 390;
    case "5m":
      return 78;
    case "10m":
      return 39;
    case "15m":
      return 26;
    case "30m":
      return 13;
    case "1h":
      return 7;
    case "4h":
      return 2;
    case "1d":
      return 1;
    default:
      return 39;
  }
}

function seedLimitFor(tf, months = HISTORY_MONTHS) {
  // ✅ Turbo: cap 1m + 5m to 2 months
  const effectiveMonths =
    tf === "1m" || tf === "5m" ? FAST_MONTHS_INTRADAY : months;

  const days = effectiveMonths * TRADING_DAYS_PER_MONTH;
  const estimate = days * barsPerDay(tf);
  return Math.ceil(estimate * 1.3);
}

/* --------------------------- AZ time utils --------------------------- */

function phoenixTime(ts, isDaily = false) {
  const seconds =
    typeof ts === "number" ? ts : (ts && (ts.timestamp ?? ts.time)) || 0;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(isDaily
      ? { month: "short", day: "2-digit" }
      : { hour: "numeric", minute: "2-digit" }),
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
    const seconds =
      typeof t === "number" ? t : (t?.timestamp ?? t?.time ?? 0);
    const d = new Date(seconds * 1000);
    if (isDailyTF) return fmtDaily.format(d);
    const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;
    const onHour = d.getMinutes() === 0;
    return isMidnight || onHour ? fmtBoundary.format(d) : fmtTime.format(d);
  };
}

/* ------------------------------ Helpers ----------------------------- */

function calcEMA(barsAsc, length) {
  if (!Array.isArray(barsAsc) || barsAsc.length === 0 || length <= 1) return [];
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

function attachOverlay(Module, args) {
  try {
    if (!Module) return null;
    try {
      const inst = new Module(args);
      if (inst && (inst.update || inst.destroy || inst.seed)) return inst;
    } catch {}
    try {
      const inst = Module(args);
      if (inst && (inst.update || inst.destroy || inst.seed)) return inst;
    } catch {}
    if (typeof Module.attach === "function") return Module.attach(args);
  } catch {}
  return { attach() {}, seed() {}, update() {}, destroy() {} };
}

function makeFibStyle(color, fontPx, lineWidth, showExtensions = true) {
  return {
    color,
    fontPx,
    lineWidth,
    showExtensions,
    showRetrace: true,
    showAnchors: true,

    showWaveLabels: false,
    showWaveLines: false,
    waveLabelColor: color,
    waveLabelFontPx: fontPx,
    waveLineColor: color,
    waveLineWidth: lineWidth,
  };
}

function engine17Timeframe(tf) {
  const t = String(tf || "30m").toLowerCase();
  if (t === "10m" || t === "30m") return t;
  return "30m";
}

/* ------------------------------ Component --------------------------- */

export default function RowChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
  fullScreen = false,
}) {
  // Chart host element used by lightweight-charts
  const containerRef = useRef(null);

  // Wrapper used to mount drawings canvas + toolbar (must be position:relative)
  const chartWrapRef = useRef(null);

  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);
  const roRef = useRef(null);

  const overlayInstancesRef = useRef([]);
  const overlayPollRef = useRef(null);

  // ✅ Bars live in ref (fast). React state updates are throttled.
  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  const didFitOnceRef = useRef(false);
  const userInteractedRef = useRef(false);

  const [chartReady, setChartReady] = useState(false);

  // ✅ Used to re-seed overlays only when we load history (not on every tick)
  const [seedToken, setSeedToken] = useState(0);

  // 🔒 stream unsubscribe stored here to prevent thrash
  const streamUnsubRef = useRef(null);

  // ✅ Turbo UI sync controller
  const lastUiSyncRef = useRef(0);
  const uiTimerRef = useRef(null);

  // ✅ LIVE indicator state/refs
  const [liveStatus, setLiveStatus] = useState("CONNECTING"); // CONNECTING | LIVE | STALE
  const lastAliveRef = useRef(0);
  const liveTimerRef = useRef(null);

  // ✅ NEW: drawings engine + UI state
  const drawingsEngineRef = useRef(null);
  const [drawingsUi, setDrawingsUi] = useState({
    mode: "select",
    count: 0,
    selectedId: null,
  });

  // ✅ Engine 17 data state
  const [engine17Data, setEngine17Data] = useState(null);
  const [engine17Loading, setEngine17Loading] = useState(false);
  const [engine17Error, setEngine17Error] = useState("");

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

    institutionalZonesAuto: false,
    smzShelvesAuto: false,

    fibPrimary: false,
    fibIntermediate: false,
    fibMinor: false,
    fibMinute: false,

    fibPrimaryStyle: makeFibStyle("#ff5ad6", 18, 3.5, true),
    fibIntermediateStyle: makeFibStyle("#ffd54a", 18, 3.5, true),
    fibMinorStyle: makeFibStyle("#22c55e", 16, 3.0, true),
    fibMinuteStyle: makeFibStyle("#60a5fa", 14, 2.5, true),

    accDistLevels: false,
    wickPaZones: false,

    // ✅ Professional overlay stack
    engine17Overlay: false,

    liquidityZones: true,
    marketStructure: true,
    strategyDiagnostics: false,
    signals: true,
    decisionTimeline: false,

    regimeBackground: false,
    confidenceStack: true,
    signalProvenance: false,
    forwardRiskMap: false,
    replaySyncedState: false,
  });

  // quick debug controls
  if (typeof window !== "undefined") {
    window.__indicators = {
      get: () => state,
      set: (patch) => setState((s) => ({ ...s, ...patch })),
    };
  }

  const symbols = useMemo(() => SYMBOLS, []);
  const timeframes = useMemo(() => TIMEFRAMES, []);

  /* -------------------------- Mount / Resize ------------------------- */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setChartReady(false);

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { color: DEFAULTS.bg },
        textColor: "#d1d5db",
        fontSize: AXIS_FONT_SIZE,
      },
      grid: {
        vertLines: { color: DEFAULTS.gridColor },
        horzLines: { color: DEFAULTS.gridColor },
      },
      rightPriceScale: {
        borderColor: DEFAULTS.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: DEFAULTS.border,
        timeVisible: true,
        secondsVisible: state.timeframe === "1m",
        tickMarkFormatter: makeTickFormatter(state.timeframe),
      },
      localization: {
        timeFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      },
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

    const vol = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    setChartReady(true);

    const markInteract = () => {
      userInteractedRef.current = true;
    };
    el.addEventListener("wheel", markInteract, { passive: true });
    el.addEventListener("mousedown", markInteract);

    const ro = new ResizeObserver(() => {
      try {
        chart.resize(el.clientWidth, el.clientHeight);
      } catch {}
    });
    ro.observe(el);
    roRef.current = ro;

    return () => {
      setChartReady(false);

      try {
        streamUnsubRef.current?.();
      } catch {}
      streamUnsubRef.current = null;

      try {
        if (overlayPollRef.current) clearInterval(overlayPollRef.current);
      } catch {}
      overlayPollRef.current = null;

      try {
        if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
      } catch {}
      uiTimerRef.current = null;

      try {
        if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      } catch {}
      liveTimerRef.current = null;

      try {
        ro.disconnect();
      } catch {}
      try {
        el.removeEventListener("wheel", markInteract);
        el.removeEventListener("mousedown", markInteract);
      } catch {}

      try {
        overlayInstancesRef.current.forEach((o) => o?.destroy?.());
      } catch {}
      overlayInstancesRef.current = [];

      try {
        drawingsEngineRef.current?.destroy?.();
      } catch {}
      drawingsEngineRef.current = null;

      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
      ema10Ref.current = ema20Ref.current = ema50Ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullScreen, state.timeframe]);

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
      localization: {
        timeFormatter: (t) => phoenixTime(t, tf === "1d"),
      },
      layout: { fontSize: AXIS_FONT_SIZE },
    });
    didFitOnceRef.current = false;
  }, [state.timeframe]);

  /* ---------------------- LIVE: status timer ---------------------- */

  useEffect(() => {
    try {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    } catch {}
    liveTimerRef.current = setInterval(() => {
      const now = Date.now();
      const last = lastAliveRef.current || 0;

      if (!last) {
        setLiveStatus("CONNECTING");
        return;
      }

      const age = now - last;
      if (age > LIVE_STALE_MS) setLiveStatus("STALE");
      else setLiveStatus("LIVE");
    }, 1000);

    return () => {
      try {
        if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      } catch {}
      liveTimerRef.current = null;
    };
  }, []);

  /* ---------------------- TURBO: UI sync helper ---------------------- */

  const forceUiSync = () => {
    if (barsRef.current.length > MAX_KEEP_BARS) {
      barsRef.current = barsRef.current.slice(-MAX_KEEP_BARS);
    }
    setBars([...barsRef.current]);
    lastUiSyncRef.current = Date.now();
  };

  const scheduleUiSync = (force = false) => {
    if (force) {
      try {
        if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
      } catch {}
      uiTimerRef.current = null;
      forceUiSync();
      return;
    }

    const now = Date.now();
    const elapsed = now - (lastUiSyncRef.current || 0);

    if (elapsed >= UI_SYNC_MS) {
      forceUiSync();
      return;
    }

    if (!uiTimerRef.current) {
      const due = Math.max(50, UI_SYNC_MS - elapsed);
      uiTimerRef.current = setTimeout(() => {
        uiTimerRef.current = null;
        forceUiSync();
      }, due);
    }
  };

  /* ==================== Effect A: Fetch + Seed Series ==================== */

  useEffect(() => {
    let cancelled = false;

    async function seedSeries() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const limit = seedLimitFor(state.timeframe);
        const seed = await getOHLC(state.symbol, state.timeframe, limit);
        if (cancelled) return;

        const asc = (Array.isArray(seed) ? seed : [])
          .map((b) => ({
            ...b,
            time: b.time > 1e12 ? Math.floor(b.time / 1000) : b.time,
          }))
          .sort((a, b) => a.time - b.time);

        barsRef.current = asc;

        seriesRef.current?.setData(
          asc.map((b) => ({
            time: b.time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          }))
        );

        if (volSeriesRef.current) {
          if (state.volume) {
            volSeriesRef.current.applyOptions({ visible: true });
            volSeriesRef.current.setData(
              asc.map((b) => ({
                time: b.time,
                value: Number(b.volume || 0),
                color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
              }))
            );
          } else {
            volSeriesRef.current.applyOptions({ visible: false });
            volSeriesRef.current.setData([]);
          }
        }

        setBars(asc);
        lastUiSyncRef.current = Date.now();

        setSeedToken((x) => x + 1);

        const chart = chartRef.current;
        if (
          chart &&
          state.range === "ALL" &&
          !didFitOnceRef.current &&
          !userInteractedRef.current
        ) {
          chart.timeScale().fitContent();
          didFitOnceRef.current = true;
        }
      } catch (e) {
        console.error("[RowChart] seed error:", e);
        barsRef.current = [];
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }

    seedSeries();
    return () => {
      cancelled = true;
    };
  }, [state.symbol, state.timeframe, state.range, state.volume]);

  /* ================== Effect A.5: Engine 17 Overlay Fetch ================== */

  useEffect(() => {
    try {
      if (overlayPollRef.current) clearInterval(overlayPollRef.current);
    } catch {}
    overlayPollRef.current = null;

    if (!state.engine17Overlay) {
      setEngine17Data(null);
      setEngine17Loading(false);
      setEngine17Error("");
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        if (!cancelled) {
          setEngine17Loading(true);
          setEngine17Error("");
        }

        const data = await getChartOverlay(
          state.symbol,
          engine17Timeframe(state.timeframe)
        );

        if (!cancelled) {
          setEngine17Data(data);
        }
      } catch (err) {
        if (!cancelled) {
          setEngine17Error(err?.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setEngine17Loading(false);
        }
      }
    };

    load();
    overlayPollRef.current = setInterval(load, 15000);

    return () => {
      cancelled = true;
      try {
        if (overlayPollRef.current) clearInterval(overlayPollRef.current);
      } catch {}
      overlayPollRef.current = null;
    };
  }, [state.engine17Overlay, state.symbol, state.timeframe]);

  /* =================== Effect B: Attach/Seed Overlays =================== */

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || barsRef.current.length === 0)
      return;

    try {
      overlayInstancesRef.current.forEach((o) => o?.destroy?.());
    } catch {}
    overlayInstancesRef.current = [];

    const reg = (inst) => inst && overlayInstancesRef.current.push(inst);

    const engine1On = !!state.institutionalZonesAuto;
    const shelvesOn = !!state.smzShelvesAuto || engine1On;

    if (engine1On) {
      reg(
        attachOverlay(SMZLevelsOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );

      reg(
        attachOverlay(SMZNegotiatedOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );
    }

    if (shelvesOn) {
      reg(
        attachOverlay(SMZShelvesOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );
    }

    if (state.engine17Overlay && engine17Data?.ok) {
      reg(
        attachOverlay(Engine17Overlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          overlayData: engine17Data,

          showLiquidityZones: !!state.liquidityZones,
          showMarketStructure: !!state.marketStructure,
          showSignals: !!state.signals,
          showSignalProvenance: !!state.signalProvenance,
          showForwardRiskMap: !!state.forwardRiskMap,
          showRegimeBackground: !!state.regimeBackground,
        })
      );
    }

    if (state.fibPrimary) {
      reg(
        attachOverlay(FibLevelsOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          enabled: true,
          degree: "primary",
          tf: "1d",
          style: state.fibPrimaryStyle,
        })
      );
    }

    if (state.fibIntermediate) {
      reg(
        attachOverlay(FibLevelsOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          enabled: true,
          degree: "intermediate",
          tf: "1h",
          style: state.fibIntermediateStyle,
        })
      );
    }

    if (state.fibMinor) {
      reg(
        attachOverlay(FibLevelsOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          enabled: true,
          degree: "minor",
          tf: "1h",
          style: state.fibMinorStyle,
        })
      );
    }

    if (state.fibMinute) {
      reg(
        attachOverlay(FibLevelsOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          enabled: true,
          degree: "minute",
          tf: "10m",
          style: state.fibMinuteStyle,
        })
      );
    }

    try {
      overlayInstancesRef.current.forEach((o) => o?.seed?.(barsRef.current));
    } catch {}
  }, [
    seedToken,
    state.institutionalZonesAuto,
    state.smzShelvesAuto,
    state.engine17Overlay,
    state.liquidityZones,
    state.marketStructure,
    state.signals,
    state.signalProvenance,
    state.forwardRiskMap,
    state.regimeBackground,
    state.fibPrimary,
    state.fibIntermediate,
    state.fibMinor,
    state.fibMinute,
    state.fibPrimaryStyle,
    state.fibIntermediateStyle,
    state.fibMinorStyle,
    state.fibMinuteStyle,
    state.timeframe,
    state.symbol,
    engine17Data,
    showDebug,
  ]);

  /* =================== Drawings Engine (ONE TIME) =================== */

  useEffect(() => {
    if (!chartReady) return;

    const chart = chartRef.current;
    const priceSeries = seriesRef.current;
    const hostEl = chartWrapRef.current; // relative wrapper for canvas
    if (!chart || !priceSeries || !hostEl) return;

    try {
      drawingsEngineRef.current?.destroy?.();
    } catch {}
    drawingsEngineRef.current = null;

    drawingsEngineRef.current = createDrawingsEngine({
      chart,
      priceSeries,
      hostEl,
      symbol: state.symbol,
      tf: state.timeframe,
      onState: (s) => setDrawingsUi((prev) => ({ ...prev, ...s })),
    });

    return () => {
      try {
        drawingsEngineRef.current?.destroy?.();
      } catch {}
      drawingsEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady]);

  useEffect(() => {
    drawingsEngineRef.current?.setContext?.({
      symbol: state.symbol,
      tf: state.timeframe,
    });
  }, [state.symbol, state.timeframe]);

  /* =================== Effect C: LIVE STREAM (STABLE + TURBO) =================== */

  useEffect(() => {
    if (!chartReady || !seriesRef.current) return;

    lastAliveRef.current = 0;
    setLiveStatus("CONNECTING");

    // close any previous stream first
    try {
      streamUnsubRef.current?.();
    } catch {}
    streamUnsubRef.current = null;

    const tfSec = TF_SEC[state.timeframe] ?? TF_SEC["10m"];
    const floorToBucket = (tSec) => Math.floor(tSec / tfSec) * tfSec;

    let bucketStart = null;
    let rolling = null;
    let isCurrent = true;

    const lastSeed = barsRef.current[barsRef.current.length - 1] || null;
    if (lastSeed) {
      bucketStart = floorToBucket(lastSeed.time);
      rolling = { ...lastSeed };
    }

    const onAlive = () => {
      if (!isCurrent) return;
      lastAliveRef.current = Date.now();
    };

    const unsub = subscribeStream(
      state.symbol,
      LIVE_TF,
      (oneMin) => {
        if (!isCurrent) return;

        const tSec = Number(
          oneMin.time > 1e12 ? Math.floor(oneMin.time / 1000) : oneMin.time
        );
        if (!Number.isFinite(tSec)) return;

        if (tfSec === TF_SEC["1m"]) {
          const bar = { ...oneMin, time: tSec };

          seriesRef.current?.update(bar);

          if (state.volume && volSeriesRef.current) {
            volSeriesRef.current.update({
              time: bar.time,
              value: Number(bar.volume || 0),
              color: bar.close >= bar.open ? DEFAULTS.volUp : DEFAULTS.volDown,
            });
          }

          const prev = barsRef.current[barsRef.current.length - 1];
          if (!prev || bar.time > prev.time) {
            barsRef.current = [...barsRef.current, bar];
            scheduleUiSync(true);
          } else if (bar.time === prev.time) {
            const next = [...barsRef.current];
            next[next.length - 1] = bar;
            barsRef.current = next;
            scheduleUiSync(false);
          }

          try {
            overlayInstancesRef.current.forEach((o) => o?.update?.(bar));
          } catch {}
          return;
        }

        const start = floorToBucket(tSec);

        if (bucketStart === null || start > bucketStart) {
          if (rolling) {
            seriesRef.current?.update(rolling);

            if (state.volume && volSeriesRef.current) {
              volSeriesRef.current.update({
                time: rolling.time,
                value: Number(rolling.volume || 0),
                color:
                  rolling.close >= rolling.open
                    ? DEFAULTS.volUp
                    : DEFAULTS.volDown,
              });
            }

            const next = [...barsRef.current];
            const last = next[next.length - 1];
            if (!last || rolling.time > last.time) next.push(rolling);
            else next[next.length - 1] = rolling;

            barsRef.current = next;
            scheduleUiSync(true);

            try {
              overlayInstancesRef.current.forEach((o) => o?.update?.(rolling));
            } catch {}
          }

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
          rolling.high = Math.max(rolling.high, oneMin.high);
          rolling.low = Math.min(rolling.low, oneMin.low);
          rolling.close = oneMin.close;
          rolling.volume =
            Number(rolling.volume || 0) + Number(oneMin.volume || 0);
          scheduleUiSync(false);
        }

        seriesRef.current?.update(rolling);

        if (state.volume && volSeriesRef.current) {
          volSeriesRef.current.update({
            time: rolling.time,
            value: Number(rolling.volume || 0),
            color:
              rolling.close >= rolling.open
                ? DEFAULTS.volUp
                : DEFAULTS.volDown,
          });
        }

        try {
          overlayInstancesRef.current.forEach((o) => o?.update?.(rolling));
        } catch {}
      },
      onAlive
    );

    // store only this stream
    streamUnsubRef.current = () => {
      if (!isCurrent) return;
      isCurrent = false;
      try {
        unsub?.();
      } catch {}
    };

    return () => {
      isCurrent = false;
      try {
        unsub?.();
      } catch {}
      if (streamUnsubRef.current) {
        streamUnsubRef.current = null;
      }
    };
  }, [chartReady, state.symbol, state.timeframe, state.volume]);

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

  const handleControlsChange = (patch) => setState((s) => ({ ...s, ...patch }));

  const applyRange = (nextRange) => {
    const chart = chartRef.current;
    if (!chart) return;
    setState((s) => ({ ...s, range: nextRange }));

    const tsLocal = chart.timeScale();
    const list = barsRef.current;
    const len = list.length;
    if (!len) return;

    if (nextRange === "ALL") {
      tsLocal.fitContent();
      didFitOnceRef.current = true;
      userInteractedRef.current = true;
      return;
    }
    const r = Number(nextRange);
    if (!Number.isFinite(r) || r <= 0) {
      tsLocal.fitContent();
      didFitOnceRef.current = true;
      userInteractedRef.current = true;
      return;
    }
    const to = len - 1;
    const from = Math.max(0, to - (r - 1));
    tsLocal.setVisibleLogicalRange({ from, to });
    didFitOnceRef.current = true;
    userInteractedRef.current = true;
  };

  const toolbarProps = {
    showEma: state.showEma,
    ema10: state.ema10,
    ema20: state.ema20,
    ema50: state.ema50,
    volume: state.volume,

    institutionalZonesAuto: state.institutionalZonesAuto,
    smzShelvesAuto: state.smzShelvesAuto,

    engine17Overlay: state.engine17Overlay,
    liquidityZones: state.liquidityZones,
    marketStructure: state.marketStructure,
    strategyDiagnostics: state.strategyDiagnostics,
    signals: state.signals,
    decisionTimeline: state.decisionTimeline,
    regimeBackground: state.regimeBackground,
    confidenceStack: state.confidenceStack,
    signalProvenance: state.signalProvenance,
    forwardRiskMap: state.forwardRiskMap,
    replaySyncedState: state.replaySyncedState,

    fibPrimary: state.fibPrimary,
    fibIntermediate: state.fibIntermediate,
    fibMinor: state.fibMinor,
    fibMinute: state.fibMinute,

    fibPrimaryStyle: state.fibPrimaryStyle,
    fibIntermediateStyle: state.fibIntermediateStyle,
    fibMinorStyle: state.fibMinorStyle,
    fibMinuteStyle: state.fibMinuteStyle,

    onChange: handleControlsChange,
    onReset: () =>
      setState((s) => ({
        ...s,
        showEma: true,
        ema10: true,
        ema20: true,
        ema50: true,
        volume: true,
        institutionalZonesAuto: false,
        smzShelvesAuto: false,

        engine17Overlay: false,
        liquidityZones: true,
        marketStructure: true,
        strategyDiagnostics: false,
        signals: true,
        decisionTimeline: false,
        regimeBackground: false,
        confidenceStack: true,
        signalProvenance: false,
        forwardRiskMap: false,
        replaySyncedState: false,

        fibPrimary: false,
        fibIntermediate: false,
        fibMinor: false,
        fibMinute: false,
      })),
  };

  const wrapperStyle = useMemo(
    () =>
      fullScreen
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
          },
    [fullScreen]
  );

  const containerStyle = useMemo(
    () =>
      fullScreen
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
          },
    [fullScreen]
  );

  const badge = (() => {
    if (liveStatus === "LIVE")
      return { text: "LIVE", bg: "rgba(16,185,129,0.92)" };
    if (liveStatus === "STALE")
      return { text: "STALE", bg: "rgba(239,68,68,0.92)" };
    return { text: "CONNECTING", bg: "rgba(245,158,11,0.92)" };
  })();

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

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: fullScreen ? "100%" : undefined,
        }}
      >
        {/* ✅ IMPORTANT: wrapper div holds drawings + badge + chart container */}
        <div
          ref={chartWrapRef}
          style={{
            ...containerStyle,
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* ✅ LEFT Drawing toolbar (TradingView style) */}
          <DrawingsToolbar
            mode={drawingsUi.mode}
            onMode={(m) => drawingsEngineRef.current?.setMode?.(m)}
            onDelete={() => drawingsEngineRef.current?.deleteSelected?.()}
          />

          {/* ✅ LIVE badge */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 60, // leave space for left toolbar
              zIndex: 90,
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0.7,
              color: "#0b0b14",
              background: badge.bg,
              boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
              userSelect: "none",
            }}
            title={
              liveStatus === "LIVE"
                ? "Stream healthy (receiving messages)"
                : liveStatus === "STALE"
                ? "No stream messages received in 30s"
                : "Connecting to live stream…"
            }
          >
            {badge.text}
          </div>

          {/* ✅ Engine 17 fetch status */}
          {state.engine17Overlay && (
            <div
              style={{
                position: "absolute",
                top: 46,
                left: 60,
                zIndex: 90,
                padding: "5px 9px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                color: "#e5e7eb",
                background: engine17Error
                  ? "rgba(239,68,68,0.88)"
                  : engine17Loading
                  ? "rgba(245,158,11,0.88)"
                  : "rgba(59,130,246,0.88)",
                boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
                userSelect: "none",
              }}
              title={engine17Error || "Engine 17 overlay"}
            >
              {engine17Error
                ? "E17 ERROR"
                : engine17Loading
                ? "E17 LOADING"
                : "E17 READY"}
            </div>
          )}

          {/* ✅ Engine 17 badges */}
          <Engine17Badges
            overlayData={engine17Data}
            visible={state.engine17Overlay}
            showConfidenceStack={state.confidenceStack}
            showReplaySyncedState={state.replaySyncedState}
          />

          {/* ✅ Engine 17 decision timeline */}
          <Engine17DecisionTimeline
            overlayData={engine17Data}
            visible={state.engine17Overlay && state.decisionTimeline}
          />

          {/* Chart host element */}
          <div
            ref={containerRef}
            style={{
              position: "absolute",
              inset: 0,
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 230,
            maxWidth: 260,
          }}
        >
          <SmartMoneyZonesPanel />
          <AccDistZonesPanel />
        </div>
      </div>
    </div>
  );
}
