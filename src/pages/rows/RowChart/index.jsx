// src/pages/rows/RowChart/index.jsx
// ============================================================
// RowChart — seed + live aggregation + indicators & overlays
// FIXED: live bars can no longer be dropped due to timestamp deadlock
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

import createSmartMoneyZonesOverlay from "../../../components/overlays/SmartMoneyZonesOverlay";
import SmartMoneyZonesPanel from "../../../components/smz/SmartMoneyZonesPanel";

import SMZLevelsOverlay from "./overlays/SMZLevelsOverlay";
import SMZShelvesOverlay from "./overlays/SMZShelvesOverlay";
import AccDistZonesPanel from "../../../components/smz/AccDistZonesPanel";

/* ------------------------------ Config ------------------------------ */

const HISTORY_MONTHS = 6;
const TRADING_DAYS_PER_MONTH = 21;
const AXIS_FONT_SIZE = 22;

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

const LIVE_TF = "10m";

/* -------------------- Helper: dynamic seed limit -------------------- */

function barsPerDay(tf) {
  switch (tf) {
    case "1m": return 390;
    case "5m": return 78;
    case "10m": return 39;
    case "15m": return 26;
    case "30m": return 13;
    case "1h": return 7;
    case "4h": return 2;
    case "1d": return 1;
    default: return 39;
  }
}

function seedLimitFor(tf, months = HISTORY_MONTHS) {
  const days = months * TRADING_DAYS_PER_MONTH;
  return Math.ceil(days * barsPerDay(tf) * 1.3);
}

/* --------------------------- AZ time utils --------------------------- */

function phoenixTime(ts, isDaily = false) {
  const seconds = typeof ts === "number" ? ts : ts?.time ?? 0;
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

  const fmtDaily = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "2-digit",
  });

  return (t) => {
    const d = new Date((typeof t === "number" ? t : t?.time ?? 0) * 1000);
    return isDailyTF ? fmtDaily.format(d) : fmtTime.format(d);
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

  const barsRef = useRef([]);
  const [bars, setBars] = useState([]);

  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: "ALL",
    volume: true,
    showEma: true,
    ema10: true,
    ema20: true,
    ema50: true,
    institutionalZonesAuto: false,
    smzShelvesAuto: false,
  });

  /* -------------------------- Mount Chart ------------------------- */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db", fontSize: AXIS_FONT_SIZE },
      grid: { vertLines: { color: DEFAULTS.gridColor }, horzLines: { color: DEFAULTS.gridColor } },
      timeScale: { timeVisible: true, secondsVisible: state.timeframe === "1m" },
      localization: { timeFormatter: (t) => phoenixTime(t, state.timeframe === "1d") },
    });

    chartRef.current = chart;
    seriesRef.current = chart.addCandlestickSeries({
      upColor: DEFAULTS.upColor,
      downColor: DEFAULTS.downColor,
      wickUpColor: DEFAULTS.upColor,
      wickDownColor: DEFAULTS.downColor,
      borderUpColor: DEFAULTS.upColor,
      borderDownColor: DEFAULTS.downColor,
    });

    volSeriesRef.current = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
    });

    return () => chart.remove();
  }, []);

  /* ==================== Effect A: Snapshot seed ==================== */

  useEffect(() => {
    let cancelled = false;

    async function seed() {
      const limit = seedLimitFor(state.timeframe);
      const seedBars = await getOHLC(state.symbol, state.timeframe, limit);
      if (cancelled) return;

      seedBars.sort((a, b) => a.time - b.time);
      barsRef.current = seedBars;
      setBars(seedBars);

      seriesRef.current.setData(seedBars);
      if (state.volume) volSeriesRef.current.setData(seedBars.map(b => ({
        time: b.time,
        value: b.volume,
        color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
      })));
    }

    seed();
    return () => (cancelled = true);
  }, [state.symbol, state.timeframe]);

  /* ================== Effect B: Live aggregation (FIXED) ================== */

  useEffect(() => {
    const tfSec = TF_SEC[state.timeframe] ?? 600;
    const floorBucket = (t) => Math.floor(t / tfSec) * tfSec;

    let rolling = null;
    let bucketStart = null;

    const lastSeed = barsRef.current[barsRef.current.length - 1];
    if (lastSeed) {
      bucketStart = floorBucket(lastSeed.time);
      rolling = { ...lastSeed };
    }

    const unsub = subscribeStream(state.symbol, LIVE_TF, (oneMin) => {
      const t = oneMin.time;
      if (!Number.isFinite(t)) return;

      const start = floorBucket(t);

      if (bucketStart === null || start > bucketStart) {
        if (rolling) {
          const prev = barsRef.current[barsRef.current.length - 1];
          const next = [...barsRef.current];

          if (!prev || rolling.time > prev.time) next.push(rolling);
          else if (rolling.time === prev.time || rolling.time >= prev.time - tfSec)
            next[next.length - 1] = rolling;

          barsRef.current = next;
          setBars(next);
          seriesRef.current.update(rolling);
        }

        bucketStart = start;
        rolling = { ...oneMin, time: start };
      } else {
        rolling.high = Math.max(rolling.high, oneMin.high);
        rolling.low = Math.min(rolling.low, oneMin.low);
        rolling.close = oneMin.close;
        rolling.volume += oneMin.volume || 0;
      }

      seriesRef.current.update(rolling);
    });

    return () => unsub?.();
  }, [state.symbol, state.timeframe]);

  /* ---------------------------- Render ----------------------------- */

  return (
    <div style={{ width: "100%", height: "100%", background: DEFAULTS.bg }}>
      <Controls symbols={SYMBOLS} timeframes={TIMEFRAMES} value={state} onChange={setState} />
      <IndicatorsToolbar {...state} onChange={setState} />
      <div ref={containerRef} style={{ width: "100%", height: fullScreen ? "100%" : 520 }} />
      <SmartMoneyZonesPanel />
      <AccDistZonesPanel />
    </div>
  );
}
