// src/pages/rows/RowChart/index.jsx
// ============================================================
// RowChart — seed + live aggregation + indicators & overlays
// ENGINE 17 UPDATE:
// - visible chart truth now comes from /api/v1/dashboard-snapshot
// - raw /api/v1/morning-fib is diagnostics only
// - chart/cards/strategies page now share the same language
// - Premarket Fibs are separate optional indicator
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

import SMZNegotiatedOverlay from "./overlays/SMZNegotiatedOverlay";
import createSmartMoneyZonesOverlay from "../../../components/overlays/SmartMoneyZonesOverlay";
import SmartMoneyZonesPanel from "../../../components/smz/SmartMoneyZonesPanel";

import SMZLevelsOverlay from "./overlays/SMZLevelsOverlay";
import SMZShelvesOverlay from "./overlays/SMZShelvesOverlay";
import AccDistZonesPanel from "../../../components/smz/AccDistZonesPanel";

import FibLevelsOverlay from "./overlays/FibLevelsOverlay";
import PremarketFibOverlay from "./overlays/PremarketFibOverlay";

import DrawingsToolbar from "../../../features/drawings/DrawingsToolbar";
import { createDrawingsEngine } from "../../../features/drawings/createDrawingsEngine";

import Engine17Overlay from "./overlays/Engine17Overlay";
import Engine17DecisionTimeline from "./overlays/Engine17DecisionTimeline";
import Engine17Badges from "./overlays/Engine17Badges";
import Engine17StateOverlay from "./overlays/Engine17StateOverlay";

/* ------------------------------ Config ------------------------------ */

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const HISTORY_MONTHS = 6;
const FAST_MONTHS_INTRADAY = 2;
const TRADING_DAYS_PER_MONTH = 21;
const AXIS_FONT_SIZE = 22;

const UI_SYNC_MS = 1000;
const MAX_KEEP_BARS = 25000;
const LIVE_STALE_MS = 30_000;

const SNAPSHOT_POLL_MS = 15000;

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

async function getDashboardSnapshot(symbol = "SPY") {
  const url =
    `${API_BASE.replace(/\/+$/, "")}/api/v1/dashboard-snapshot?symbol=` +
    `${encodeURIComponent(symbol)}&includeContext=1`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`dashboard-snapshot ${r.status}`);
  return r.json();
}

async function getMorningFibDebug(symbol = "SPY", tf = "10m") {
  const url =
    `${API_BASE.replace(/\/+$/, "")}/api/v1/morning-fib?symbol=` +
    `${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`morning-fib ${r.status}`);
  return r.json();
}

function buildTriggerFromComposed(engine16) {
  const waveShortPrep = !!engine16?.waveShortPrep;
  const waveLongPrep = !!engine16?.waveLongPrep;

  const sessionStructure = engine16?.sessionStructure || {};
  const anchors = engine16?.anchors || {};
  const dayRange = engine16?.dayRange || {};

  if (waveShortPrep) {
    const level =
      sessionStructure?.regularSessionLow ??
      anchors?.sessionLow ??
      dayRange?.currentDayLow ??
      null;

    return Number.isFinite(level)
      ? {
          side: "SHORT",
          level,
          label: "BREAK BELOW = SHORT TRIGGER",
          lineLabel: "SHORT TRIGGER BELOW",
        }
      : null;
  }

  if (waveLongPrep) {
    const level =
      sessionStructure?.regularSessionHigh ??
      anchors?.sessionHigh ??
      dayRange?.currentDayHigh ??
      null;

    return Number.isFinite(level)
      ? {
          side: "LONG",
          level,
          label: "BREAK ABOVE = LONG TRIGGER",
          lineLabel: "LONG TRIGGER ABOVE",
        }
      : null;
  }

  return null;
}

function mapSnapshotToEngine17Overlay(snapshot) {
  const scalp = snapshot?.strategies?.["intraday_scalp@10m"]?.engine16 || null;
  const swing = snapshot?.strategies?.["minor_swing@1h"]?.engine16 || null;
  const engine15Decision =
    snapshot?.strategies?.["intraday_scalp@10m"]?.engine15Decision || null;

  if (!scalp) {
    return {
      ok: false,
      error: "SNAPSHOT_ENGINE16_MISSING",
      fib: {},
      anchors: [],
      signals: [],
      badges: [],
      meta: {
        source: "DASHBOARD_SNAPSHOT",
        missingSections: ["snapshot_engine16"],
        sourceEnginesUsed: ["SNAPSHOT_ENGINE16"],
      },
    };
  }

  const trigger = buildTriggerFromComposed(scalp);

  const waveContext = scalp?.waveContext || {};
  const waveState = waveContext?.waveState || scalp?.waveState || "UNKNOWN";
  const macroBias = waveContext?.macroBias || scalp?.macroBias || "NONE";

  const readiness = scalp?.readinessLabel || "WAIT";
  const strategyType = scalp?.strategyType || "NONE";

  const anchors = [
    {
      kind: "PREMARKET_LOW",
      price: scalp?.anchors?.premarketLow,
      label: "PM Low",
    },
    {
      kind: "PREMARKET_HIGH",
      price: scalp?.anchors?.premarketHigh,
      label: "PM High",
    },
    {
      kind: "SESSION_HIGH",
      price: scalp?.anchors?.sessionHigh,
      label: "Session High",
    },
    {
      kind: "SESSION_LOW",
      price: scalp?.anchors?.sessionLow,
      label: "Session Low",
    },
    {
      kind: "FIB_ANCHOR_A",
      price: scalp?.anchors?.anchorA,
      label: "Fib A",
    },
    {
      kind: "FIB_ANCHOR_B",
      price: scalp?.anchors?.anchorB,
      label: "Fib B",
    },
  ].filter((a) => Number.isFinite(a?.price));

  const signals = [];

  if (scalp?.continuationWatchShort) {
    signals.push({
      kind: "CONTINUATION_WATCH_SHORT",
      price:
        trigger?.level ??
        scalp?.anchors?.sessionLow ??
        scalp?.anchors?.anchorB ??
        null,
      label: "Continuation Watch Short",
      time:
        scalp?.signalTimes?.continuationWatchTime ||
        scalp?.signalTimes?.continuationTime ||
        null,
    });
  }

  if (scalp?.continuationTriggerShort) {
    signals.push({
      kind: "CONTINUATION_TRIGGER_SHORT",
      price:
        trigger?.level ??
        scalp?.anchors?.sessionLow ??
        scalp?.anchors?.anchorB ??
        null,
      label: "Continuation Trigger Short",
      time:
        scalp?.signalTimes?.continuationTriggerTime ||
        scalp?.signalTimes?.continuationTime ||
        null,
    });
  }

  if (scalp?.exhaustionEarlyShort) {
    signals.push({
      kind: "EXHAUSTION_EARLY_SHORT",
      price:
        scalp?.exhaustionBarPrice ??
        scalp?.anchors?.sessionHigh ??
        scalp?.anchors?.anchorB ??
        null,
      label: "Exhaustion Early Short",
      time: scalp?.signalTimes?.exhaustionEarlyTime || null,
    });
  }

  if (scalp?.exhaustionTriggerShort) {
    signals.push({
      kind: "EXHAUSTION_TRIGGER_SHORT",
      price:
        scalp?.exhaustionBarPrice ??
        scalp?.anchors?.sessionHigh ??
        scalp?.anchors?.anchorB ??
        null,
      label: "Exhaustion Trigger Short",
      time:
        scalp?.signalTimes?.exhaustionTriggerTime ||
        scalp?.signalTimes?.exhaustionTime ||
        scalp?.exhaustionBarTime ||
        null,
    });
  }

  if (scalp?.continuationWatchLong) {
    signals.push({
      kind: "CONTINUATION_WATCH_LONG",
      price:
        trigger?.level ??
        scalp?.anchors?.sessionHigh ??
        scalp?.anchors?.anchorB ??
        null,
      label: "Continuation Watch Long",
      time:
        scalp?.signalTimes?.continuationWatchTime ||
        scalp?.signalTimes?.continuationTime ||
        null,
    });
  }

  if (scalp?.continuationTriggerLong) {
    signals.push({
      kind: "CONTINUATION_TRIGGER_LONG",
      price:
        trigger?.level ??
        scalp?.anchors?.sessionHigh ??
        scalp?.anchors?.anchorB ??
        null,
      label: "Continuation Trigger Long",
      time:
        scalp?.signalTimes?.continuationTriggerTime ||
        scalp?.signalTimes?.continuationTime ||
        null,
    });
  }

  if (scalp?.exhaustionEarlyLong) {
    signals.push({
      kind: "EXHAUSTION_EARLY_LONG",
      price:
        scalp?.exhaustionBarPrice ??
        scalp?.anchors?.sessionLow ??
        scalp?.anchors?.anchorA ??
        null,
      label: "Exhaustion Early Long",
      time: scalp?.signalTimes?.exhaustionEarlyTime || null,
    });
  }

  if (scalp?.exhaustionTriggerLong) {
    signals.push({
      kind: "EXHAUSTION_TRIGGER_LONG",
      price:
        scalp?.exhaustionBarPrice ??
        scalp?.anchors?.sessionLow ??
        scalp?.anchors?.anchorA ??
        null,
      label: "Exhaustion Trigger Long",
      time:
        scalp?.signalTimes?.exhaustionTriggerTime ||
        scalp?.signalTimes?.exhaustionTime ||
        scalp?.exhaustionBarTime ||
        null,
    });
  }

  const badges = [
    { kind: "CONTEXT", value: scalp?.context || "NONE" },
    { kind: "STATE", value: scalp?.state || "UNKNOWN" },
    {
      kind: "PHASE",
      value: waveState,
    },
    {
      kind: "BIAS",
      value: macroBias,
    },
  ];

  if (readiness && readiness !== "WAIT") {
    badges.unshift({
      kind: "READINESS",
      value: readiness,
    });
  }

  if (strategyType && strategyType !== "NONE") {
    badges.unshift({
      kind: "STRATEGY",
      value: strategyType,
    });
  }

  const nextFocus =
    engine15Decision?.lifecycle?.nextFocus ||
    engine15Decision?.nextFocus ||
    null;

  return {
    ok: true,
    source: "DASHBOARD_SNAPSHOT_COMPOSED_TRUTH",
    zones: [],
    anchors,
    dayRange: scalp?.dayRange || null,
    sessionStructure: scalp?.sessionStructure || null,
    signals,
    badges,
    fib: {
      context: scalp?.context || "NONE",
      state: scalp?.state || "UNKNOWN",
      waveContext,
      waveState,
      macroBias,

      readinessLabel: readiness,
      strategyType,

      nextFocus,

      waveShortPrep: !!scalp?.waveShortPrep,
      waveLongPrep: !!scalp?.waveLongPrep,

      continuationWatchShort: !!scalp?.continuationWatchShort,
      continuationTriggerShort: !!scalp?.continuationTriggerShort,
      exhaustionEarlyShort: !!scalp?.exhaustionEarlyShort,
      exhaustionTriggerShort: !!scalp?.exhaustionTriggerShort,

      continuationWatchLong: !!scalp?.continuationWatchLong,
      continuationTriggerLong: !!scalp?.continuationTriggerLong,
      exhaustionEarlyLong: !!scalp?.exhaustionEarlyLong,
      exhaustionTriggerLong: !!scalp?.exhaustionTriggerLong,

      waveReasonCodes: Array.isArray(scalp?.waveReasonCodes)
        ? scalp.waveReasonCodes
        : [],

      trigger,
      signalTimes: scalp?.signalTimes || {},

      marketRegime: scalp?.marketRegime || null,
      macroRoadblock: scalp?.macroRoadblock || null,

      anchors: scalp?.anchors || {},
      anchorLabels: scalp?.anchorLabels || {},
      anchorDebug: scalp?.anchorDebug || {},

      fib: scalp?.fib || {},
      levels: scalp?.fib || {},
      primaryZone: scalp?.pullbackZone || null,
      secondaryZone: scalp?.secondaryZone || null,

      impulseVolumeConfirmed: !!scalp?.impulseVolumeConfirmed,
      volumeContext: scalp?.volumeContext || {},

      rawComposedMinorSwing: swing || null,
    },
    meta: {
      sourceEnginesUsed: ["SNAPSHOT_ENGINE16"],
      missingSections: [],
    },
  };
}

function Engine17DebugPanel({
  visible = false,
  composedData,
  rawData,
}) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        zIndex: 120,
        width: 520,
        maxWidth: "42%",
        display: "grid",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 12,
          background: "rgba(7,10,18,0.88)",
          padding: 12,
          color: "#e5e7eb",
          backdropFilter: "blur(4px)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>
          RAW ENGINE 16 — DEBUG ONLY
        </div>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            fontSize: 11,
            lineHeight: 1.35,
            maxHeight: 180,
            overflow: "hidden",
            color: "#cbd5e1",
          }}
        >
          {JSON.stringify(rawData || {}, null, 2)}
        </pre>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 12,
          background: "rgba(7,10,18,0.88)",
          padding: 12,
          color: "#e5e7eb",
          backdropFilter: "blur(4px)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>
          COMPOSED STRATEGY TRUTH
        </div>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            fontSize: 11,
            lineHeight: 1.35,
            maxHeight: 180,
            overflow: "hidden",
            color: "#cbd5e1",
          }}
        >
          {JSON.stringify(composedData || {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/* ------------------------------ Component --------------------------- */

export default function RowChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
  fullScreen = false,
}) {
  const containerRef = useRef(null);
  const chartWrapRef = useRef(null);

  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);
  const ema200Ref = useRef(null);
  const roRef = useRef(null);

  const overlayInstancesRef = useRef([]);

  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  const didFitOnceRef = useRef(false);
  const userInteractedRef = useRef(false);

  const [chartReady, setChartReady] = useState(false);
  const [seedToken, setSeedToken] = useState(0);

  const streamUnsubRef = useRef(null);

  const lastUiSyncRef = useRef(0);
  const uiTimerRef = useRef(null);

  const [liveStatus, setLiveStatus] = useState("CONNECTING");
  const lastAliveRef = useRef(0);
  const liveTimerRef = useRef(null);

  const drawingsEngineRef = useRef(null);
  const [drawingsUi, setDrawingsUi] = useState({
    mode: "select",
    count: 0,
    selectedId: null,
  });

  const [engine17Data, setEngine17Data] = useState(null);
  const [engine17RawDebug, setEngine17RawDebug] = useState(null);

  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: "ALL",
    disabled: false,

    showEma: true,
    ema10: true,
    ema20: true,
    ema50: true,
    ema200: true,

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

    engine17Overlay: true,
    engine17Timeline: true,
    engine17Badges: true,
    engine17StateOverlay: true,
    engine17Signals: true,
    engine17TriggerLine: true,
    engine17DebugPanel: false,

    showPremarketFibs: false,
  });

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
      ema10Ref.current = ema20Ref.current = ema50Ref.current = ema200Ref.current = null;
    };
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

  /* ==================== Effect B: SNAPSHOT TRUTH FETCH ==================== */

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function load() {
      try {
        const snap = await getDashboardSnapshot(state.symbol);
        if (cancelled) return;
        setEngine17Data(mapSnapshotToEngine17Overlay(snap));
      } catch (err) {
        if (cancelled) return;
        console.error("[RowChart] dashboard-snapshot error:", err);
        setEngine17Data({
          ok: false,
          error: "SNAPSHOT_FETCH_FAILED",
          detail: err?.message || String(err),
        });
      }

      if (showDebug || state.engine17DebugPanel || state.showPremarketFibs) {
        try {
          const raw = await getMorningFibDebug(state.symbol, state.timeframe);
          if (!cancelled) setEngine17RawDebug(raw);
        } catch (err) {
          if (!cancelled) {
            setEngine17RawDebug({
              ok: false,
              error: err?.message || String(err),
            });
          }
        }
      } else {
        setEngine17RawDebug(null);
      }
    }

    load();
    timer = setInterval(load, SNAPSHOT_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [
    state.symbol,
    state.timeframe,
    state.engine17DebugPanel,
    state.showPremarketFibs,
    showDebug,
  ]);

  /* =================== Effect C: Attach/Seed Overlays =================== */

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

    if (state.showPremarketFibs) {
      reg(
        attachOverlay(PremarketFibOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          enabled: true,
          symbol: state.symbol,
          tf: state.timeframe,
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
          showLiquidityZones: false,
          showMarketStructure: false,
          showSignals: !!state.engine17Signals,
          showSignalProvenance: false,
          showForwardRiskMap: false,
          showRegimeBackground: false,
          showTriggerLine: !!state.engine17TriggerLine,
        })
      );
    }

    try {
      overlayInstancesRef.current.forEach((o) => o?.seed?.(barsRef.current));
    } catch {}
  }, [
    seedToken,
    engine17Data,
    state.institutionalZonesAuto,
    state.smzShelvesAuto,
    state.fibPrimary,
    state.fibIntermediate,
    state.fibMinor,
    state.fibMinute,
    state.fibPrimaryStyle,
    state.fibIntermediateStyle,
    state.fibMinorStyle,
    state.fibMinuteStyle,
    state.showPremarketFibs,
    state.engine17Overlay,
    state.engine17Signals,
    state.engine17TriggerLine,
    state.timeframe,
    state.symbol,
    showDebug,
  ]);

  /* =================== Drawings Engine (ONE TIME) =================== */

  useEffect(() => {
    if (!chartReady) return;

    const chart = chartRef.current;
    const priceSeries = seriesRef.current;
    const hostEl = chartWrapRef.current;
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
  }, [chartReady]);

  useEffect(() => {
    drawingsEngineRef.current?.setContext?.({
      symbol: state.symbol,
      tf: state.timeframe,
    });
  }, [state.symbol, state.timeframe]);

  /* =================== Effect D: LIVE STREAM =================== */

  useEffect(() => {
    if (!chartReady || !seriesRef.current) return;

    lastAliveRef.current = 0;
    setLiveStatus("CONNECTING");

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
    if (ema200Ref.current) ema200Ref.current.applyOptions({ visible: false });

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
    if (state.ema200) {
      const l = ensureLine(ema200Ref, "#a855f7"); // pick a color you like
      l.setData(calcEMA(bars, 200));
      l.applyOptions({ visible: true });
    }
  }, [bars, state.showEma, state.ema10, state.ema20, state.ema50, state.ema200]);
  
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
    ema200: state.ema200,
    volume: state.volume,

    institutionalZonesAuto: state.institutionalZonesAuto,
    smzShelvesAuto: state.smzShelvesAuto,

    fibPrimary: state.fibPrimary,
    fibIntermediate: state.fibIntermediate,
    fibMinor: state.fibMinor,
    fibMinute: state.fibMinute,

    fibPrimaryStyle: state.fibPrimaryStyle,
    fibIntermediateStyle: state.fibIntermediateStyle,
    fibMinorStyle: state.fibMinorStyle,
    fibMinuteStyle: state.fibMinuteStyle,

    engine17Overlay: state.engine17Overlay,
    engine17Timeline: state.engine17Timeline,
    engine17Badges: state.engine17Badges,
    engine17StateOverlay: state.engine17StateOverlay,
    engine17Signals: state.engine17Signals,
    engine17TriggerLine: state.engine17TriggerLine,
    engine17DebugPanel: state.engine17DebugPanel,

    showPremarketFibs: state.showPremarketFibs,

    onChange: handleControlsChange,
    onReset: () =>
      setState((s) => ({
        ...s,
        showEma: true,
        ema10: true,
        ema20: true,
        ema50: true,
        ema200: true,
        
        volume: true,
        institutionalZonesAuto: false,
        smzShelvesAuto: false,
        fibPrimary: false,
        fibIntermediate: false,
        fibMinor: false,
        fibMinute: false,
        engine17Overlay: true,
        engine17Timeline: true,
        engine17Badges: true,
        engine17StateOverlay: true,
        engine17Signals: true,
        engine17TriggerLine: true,
        engine17DebugPanel: false,
        showPremarketFibs: false,
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
    if (liveStatus === "LIVE") return { text: "LIVE", bg: "rgba(16,185,129,0.92)" };
    if (liveStatus === "STALE") return { text: "STALE", bg: "rgba(239,68,68,0.92)" };
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
        <div
          ref={chartWrapRef}
          style={{
            ...containerStyle,
            flex: 1,
            minWidth: 0,
          }}
        >
          <DrawingsToolbar
            mode={drawingsUi.mode}
            onMode={(m) => drawingsEngineRef.current?.setMode?.(m)}
            onDelete={() => drawingsEngineRef.current?.deleteSelected?.()}
          />

          <div
            style={{
              position: "absolute",
              top: 10,
              left: 60,
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

          {state.engine17StateOverlay && (
            <Engine17StateOverlay
              overlayData={engine17Data}
              visible={state.engine17Overlay}
            />
          )}

          <Engine17DecisionTimeline
            overlayData={engine17Data}
            visible={state.engine17Timeline && state.engine17Overlay}
          />

          <Engine17Badges
            overlayData={engine17Data}
            visible={state.engine17Badges && state.engine17Overlay}
            showConfidenceStack={showDebug || state.engine17DebugPanel}
            showReplaySyncedState={false}
          />

          <Engine17DebugPanel
            visible={showDebug || state.engine17DebugPanel}
            rawData={engine17RawDebug}
            composedData={engine17Data}
          />

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
