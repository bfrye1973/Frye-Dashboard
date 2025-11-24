// src/pages/rows/RowChart/index.jsx
// ============================================================
// RowChart — seed + live aggregation + indicators & overlays
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

// Smart-Money Zones engine + overlay
import { computeSmartMoneyZones } from "../../../indicators/smz/engine";
import createSmartMoneyZonesOverlay from "../../../components/overlays/SmartMoneyZonesOverlay";
import SmartMoneyZonesPanel from "../../../components/smz/SmartMoneyZonesPanel";

// Accumulation / Distribution precision levels
import SMZLevelsOverlay from "./overlays/SMZLevelsOverlay";
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
  const days = months * TRADING_DAYS_PER_MONTH;
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
  if (
    !Array.isArray(barsAsc) ||
    barsAsc.length === 0 ||
    !Number.isFinite(length) ||
    length <= 1
  )
    return [];
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

  const bars10mRef = useRef([]);
  const bars1hRef = useRef([]);
  const bars4hRef = useRef([]);

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
    shelvesFour: false,

    wickPaZones: false,
  });

  if (typeof window !== "undefined") {
    window.__indicators = {
      get: () => state,
      set: (patch) => setState((s) => ({ ...s, ...patch })),
    };
    window.__on = (k) => window.__indicators.set({ [k]: true });
    window.__off = (k) => window.__indicators.set({ [k]: false });
  }

  const symbols = useMemo(() => SYMBOLS, []);
  const timeframes = useMemo(() => TIMEFRAMES, []);

  /* -------------------------- Mount / Resize ------------------------- */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
        chart.remove();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
      ema10Ref.current = ema20Ref.current = ema50Ref.current = null;
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
        setBars(asc);

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
                color:
                  b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
              }))
            );
          } else {
            volSeriesRef.current.applyOptions({ visible: false });
            volSeriesRef.current.setData([]);
          }
        }

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

  /* ================== Effect A2: multi-TF snapshots (10 days) ================ */

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshots() {
      try {
        const [d10, d1h, d4h] = await Promise.all([
          getOHLC(state.symbol, "10m", 10 * barsPerDay("10m")),
          getOHLC(state.symbol, "1h", 10 * barsPerDay("1h")),
          getOHLC(state.symbol, "4h", 10 * barsPerDay("4h")),
        ]);

        if (cancelled) return;

        const norm = (arr) =>
          (Array.isArray(arr) ? arr : [])
            .map((b) => ({
              ...b,
              time: b.time > 1e12 ? Math.floor(b.time / 1000) : b.time,
            }))
            .sort((a, b) => a.time - b.time);

        bars10mRef.current = norm(d10);
        bars1hRef.current = norm(d1h);
        bars4hRef.current = norm(d4h);
      } catch (e) {
        console.warn("[RowChart] loadSnapshots error:", e);
        bars10mRef.current = [];
        bars1hRef.current = [];
        bars4hRef.current = [];
      }
    }

    loadSnapshots();
    return () => {
      cancelled = true;
    };
  }, [state.symbol]);

  /* =================== Effect B: Attach/Seed Overlays =================== */

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || barsRef.current.length === 0)
      return;

    try {
      overlayInstancesRef.current.forEach((o) => o?.destroy?.());
    } catch {}
    overlayInstancesRef.current = [];

    const reg = (inst) => inst && overlayInstancesRef.current.push(inst);

    if (state.moneyFlow) {
      reg(
        attachOverlay(RightProfileOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );
    }

    if (state.luxSr) {
      reg(
        attachOverlay(SessionShadingOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );
    }

    if (state.swingLiquidity) {
      reg(
        attachOverlay(createSwingLiquidityOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );
    }

    if (state.shelvesFour) {
      reg(
        attachOverlay(createFourShelvesOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );
    }

    if (state.smi1h) {
      reg(
        attachOverlay(createSMI1hOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );
    }

    // Smart-Money Zones + Accumulation / Distribution precision levels
    if (state.wickPaZones) {
      const smz = attachOverlay(createSmartMoneyZonesOverlay, {
        chart: chartRef.current,
        priceSeries: seriesRef.current,
        chartContainer: containerRef.current,
        timeframe: state.timeframe,
      });
      reg(smz);

      reg(
        attachOverlay(SMZLevelsOverlay, {
          chart: chartRef.current,
          priceSeries: seriesRef.current,
          chartContainer: containerRef.current,
          timeframe: state.timeframe,
        })
      );

      (async () => {
        try {
          const res = await fetch("/data/zones.json");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();

          if (showDebug) {
            console.log("SMZ zones.json payload:", json?.zones?.length ?? 0);
          }

          smz?.seed?.(json);

          if (showDebug) window.__smz = json;
        } catch (e) {
          console.warn(
            "[RowChart] error loading zones.json for SMZ overlay:",
            e
          );
        }
      })();
    }

    try {
      overlayInstancesRef.current.forEach((o) => o?.seed?.(barsRef.current));
    } catch {}
  }, [
    state.moneyFlow,
    state.luxSr,
    state.swingLiquidity,
    state.shelvesFour,
    state.smi1h,
    state.wickPaZones,
    state.timeframe,
    bars,
    showDebug,
  ]);

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
      const tSec =
        Number(
          oneMin.time > 1e12 ? Math.floor(oneMin.time / 1000) : oneMin.time
        );
      if (!Number.isFinite(tSec)) return;

      if (tfSec === TF_SEC["1m"]) {
        const bar = { ...oneMin, time: tSec };
        seriesRef.current.update(bar);
        if (state.volume) {
          volSeriesRef.current.update({
            time: bar.time,
            value: Number(bar.volume || 0),
            color: bar.close >= bar.open ? DEFAULTS.volUp : DEFAULTS.volDown,
          });
        }
        const prev = barsRef.current[barsRef.current.length - 1];
        if (!prev || bar.time > prev.time) {
          const next = [...barsRef.current, bar];
          barsRef.current = next;
          setBars(next);
        } else if (bar.time === prev.time) {
          const next = [...barsRef.current];
          next[next.length - 1] = bar;
          barsRef.current = next;
          setBars(next);
        }
        try {
          overlayInstancesRef.current.forEach((o) => o?.update?.(bar));
        } catch {}
        return;
      }

      const start = floorToBucket(tSec);
      if (bucketStart === null || start > bucketStart) {
        if (rolling) {
          seriesRef.current.update(rolling);
          if (state.volume) {
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
          setBars(next);
          try {
            overlayInstancesRef.current.forEach((o) =>
              o?.update?.(rolling)
            );
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
      }

      seriesRef.current.update(rolling);
      if (state.volume) {
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
    });

    return () => unsub?.();
  }, [state.symbol, state.timeframe, state.volume]);

  /* ---------------------------- EMA lines ----------------------------- */

  useEffect(() => {
    const chart = chartRef.current;
    const price = seriesRef.current;
    if (!chart || !price) return);

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

  const handleControlsChange = (patch) =>
    setState((s) => ({ ...s, ...patch }));

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
    ema10: state.ema10,
    ema20: state.ema20,
    ema50: state.ema50,
    volume: state.volume,
    moneyFlow: state.moneyFlow,
    luxSr: state.luxSr,
    swingLiquidity: state.swingLiquidity,
    smi1h: state.smi1h,
    shelvesFour: state.shelvesFour,
    wickPaZones: state.wickPaZones,
    onChange: handleControlsChange,
    onReset: () =>
      setState((s) => ({
        ...s,
        showEma: true,
        ema10: true,
        ema20: true,
        ema50: true,
        volume: true,
        moneyFlow: false,
        luxSr: false,
        swingLiquidity: false,
        smi1h: false,
        shelvesFour: false,
        wickPaZones: false,
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

  // ----------- RETURN UI -----------
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

      {/* Chart + right-side Smart Money panels */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: fullScreen ? "100%" : undefined,
        }}
      >
        <div
          ref={containerRef}
          style={{
            ...containerStyle,
            flex: 1,
            minWidth: 0,
          }}
        />

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
