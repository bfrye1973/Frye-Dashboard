// src/pages/rows/RowChart/index.jsx
// ============================================================
// RowChart — seed + live aggregation + indicators & overlays
//   • Four Shelves overlay (1h Blue/Yellow + 10m Blue/Yellow)
//   • Fonts 2× larger on price/time axes (layout.fontSize)
//   • Dynamic seed limit (2m: 5/10/15/30m; 4m: 1h/4h; 6m: 1d)
//   • History/Stream bucket alignment + forward-fill to "today"
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
// Months of history per timeframe
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
const TRADING_DAYS_PER_MONTH = 21; // rough
const AXIS_FONT_SIZE = 22;         // ~2× default

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

/* -------------------- Helpers (limits & formatting) -------------------- */
function barsPerDay(tf) {
  switch (tf) {
    case "1m":  return 390; // 6.5h * 60
    case "5m":  return 78;
    case "10m": return 39;
    case "15m": return 26;
    case "30m": return 13;
    case "1h":  return 7;
    case "4h":  return 2;
    case "1d":  return 1;
    default:    return 39;
  }
}
function seedLimitFor(tf) {
  const months = HISTORY_MONTHS_BY_TF[tf] ?? 6;
  const days = months * TRADING_DAYS_PER_MONTH;
  const estimate = days * barsPerDay(tf);
  return Math.ceil(estimate * 1.3); // headroom for gaps
}

function phoenixTime(ts, isDaily = false) {
  const seconds = typeof ts === "number" ? ts : (ts?.timestamp ?? ts?.time ?? 0);
  return new Date(seconds * 1000).toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    ...(isDaily ? { month: "short", day: "2-digit" } : { hour: "2-digit", minute: "2-digit" }),
  });
}
function makeTickFormatter(tf) {
  const showSeconds = tf === "1m";
  const isDailyTF = tf === "1d";
  return (t) => {
    const s = typeof t === "number" ? t : t?.time;
    const d = new Date(s * 1000);
    if (isDailyTF) {
      return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    }
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      ...(showSeconds ? { second: "2-digit" } : {}),
    });
  };
}

/* ------------------------------ EMA helper ----------------------------- */
function calcEMA(barsAsc, length) {
  if (!Array.isArray(barsAsc) || !barsAsc.length || !Number.isFinite(length) || length <= 1) return [];
  const k = 2 / (length + 1);
  const out = [];
  let ema;
  for (let i = 0; i < barsAsc.length; i++) {
    const c = Number(barsAsc[i].close);
    if (!Number.isFinite(c)) continue;
    ema = ema === undefined ? c : ema + (c - ema) * k;
    out.push({ time: barsAsc[i].time, value: ema });
  }
  return out;
}

/* ------------------------------ Overlays ------------------------------ */
function attachOverlay(Module, args) {
  try {
    if (!Module) return null;
    try { const inst = new Module(args); if (inst && (inst.update || inst.destroy || inst.seed)) return inst; } catch {}
    try { const inst = Module(args);      if (inst && (inst.update || inst.destroy || inst.seed)) return inst; } catch {}
    if (typeof Module.attach === "function") return Module.attach(args);
  } catch {}
  return { seed() {}, update() {}, destroy() {} };
}

/* ============================== Component ============================= */
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

    shelvesFour: false,   // Four Shelves overlay toggle
  });

  /* -------------------------- Debug toggles -------------------------- */
  if (typeof window !== "undefined") {
    window.__indicators = {
      get: () => state,
      set: (patch) => setState((s) => ({ ...s, ...patch })),
    };
    window.__on  = (k) => setState((s) => ({ ...s, [k]: true }));
    window.__off = (k) => setState((s) => ({ ...s, [k]: false }));
  }

  const symbols = useMemo(() => SYMBOLS, []);
  const timeframes = useMemo(() => TIMEFRAMES, []);

  /* -------------------------- Create chart --------------------------- */
  useEffect(() => {
    const el = containerRef.current;
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

    const onInteract = () => { userInteractedRef.current = true; };
    el.addEventListener("wheel", onInteract, { passive: true });
    el.addEventListener("mousedown", onInteract);

    const ro = new ResizeObserver(() => {
      try { chart.resize(el.clientWidth, el.clientHeight); } catch {}
    });
    ro.observe(el);

    return () => {
      try { ro.disconnect(); } catch {}
      try { el.removeEventListener("wheel", onInteract); el.removeEventListener("mousedown", onInteract); } catch {}
      try { overlayInstancesRef.current.forEach(o => o?.destroy?.()); } catch {}
      overlayInstancesRef.current = [];
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
      ema10Ref.current = ema20Ref.current = ema50Ref.current = null;
    };
  }, [fullScreen]);

  /* ---------------------- TF / axis font refresh --------------------- */
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
      layout: { fontSize: AXIS_FONT_SIZE },
    });
    didFitOnceRef.current = false;
  }, [state.timeframe]);

  /* ---------------- Fetch + seed series (+ align/forward-fill) ------- */
  useEffect(() => {
    let cancelled = false;

    async function seedSeries() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const limit = seedLimitFor(state.timeframe);
        const raw = await getOHLC(state.symbol, state.timeframe, limit);
        if (cancelled) return;

        const asc = (Array.isArray(raw) ? raw : [])
          .map(b => ({ ...b, time: b.time > 1e12 ? Math.floor(b.time / 1000) : b.time }))
          .sort((a, b) => a.time - b.time);

        const tfSec = TF_SEC[state.timeframe] || TF_SEC["10m"];
        const floorToBucket = (t) => Math.floor(t / tfSec) * tfSec;

        // Align last history bar to its TF bucket and forward-fill up to current bucket
        const nowSec = Math.floor(Date.now() / 1000);
        const nowBucket = floorToBucket(nowSec);

        let normalized = asc.slice();
        if (normalized.length) {
          let last = normalized[normalized.length - 1];
          const lastBucket = floorToBucket(last.time);

          // If last bar isn't on its bucket start, move it to bucket start (keep OHLC as-is)
          if (last.time !== lastBucket) {
            normalized[normalized.length - 1] = { ...last, time: lastBucket };
          }

          // If last bucket is behind "today" bucket, forward-fill empty buckets
          let cursor = floorToBucket(normalized[normalized.length - 1].time);
          while (cursor + tfSec <= nowBucket) {
            const prev = normalized[normalized.length - 1];
            const close = prev.close;
            cursor += tfSec;
            normalized.push({
              time: cursor,
              open: close,
              high: close,
              low: close,
              close,
              volume: 0,
            });
          }
        }

        barsRef.current = normalized;
        setBars(normalized);

        // Seed series
        seriesRef.current?.setData(
          normalized.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }))
        );

        // Seed volume
        if (volSeriesRef.current) {
          if (state.volume) {
            volSeriesRef.current.applyOptions({ visible: true });
            volSeriesRef.current.setData(
              normalized.map(b => ({
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

        // Fit once after seed so "today" is in view
        const chart = chartRef.current;
        if (chart && state.range === "ALL" && !didFitOnceRef.current && !userInteractedRef.current) {
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
    return () => { cancelled = true; };
  }, [state.symbol, state.timeframe, state.range, state.volume]);

  /* -------------------- Attach/seed overlays (unchanged) -------------- */
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || barsRef.current.length === 0) return;

    try { overlayInstancesRef.current.forEach(o => o?.destroy?.()); } catch {}
    overlayInstancesRef.current = [];

    const reg = (inst) => inst && overlayInstancesRef.current.push(inst);

    if (state.moneyFlow) {
      reg(attachOverlay(RightProfileOverlay, {
        chart: chartRef.current,
        priceSeries: seriesRef.current,
        chartContainer: containerRef.current,
        timeframe: state.timeframe,
      }));
      // reg(attachOverlay(MoneyFlowOverlay, {...}));
    }

    if (state.luxSr) {
      reg(attachOverlay(SessionShadingOverlay, {
        chart: chartRef.current,
        priceSeries: seriesRef.current,
        chartContainer: containerRef.current,
        timeframe: state.timeframe,
      }));
    }

    if (state.swingLiquidity) {
      reg(attachOverlay(createSwingLiquidityOverlay, {
        chart: chartRef.current,
        priceSeries: seriesRef.current,
        chartContainer: containerRef.current,
        timeframe: state.timeframe,
      }));
    }

    if (state.shelvesFour) {
      reg(attachOverlay(createFourShelvesOverlay, {
        chart: chartRef.current,
        priceSeries: seriesRef.current,
        chartContainer: containerRef.current,
        timeframe: state.timeframe,
      }));
    }

    if (state.smi1h) {
      reg(attachOverlay(createSMI1hOverlay, {
        chart: chartRef.current,
        priceSeries: seriesRef.current,
        chartContainer: containerRef.current,
        timeframe: state.timeframe,
      }));
    }

    try { overlayInstancesRef.current.forEach(o => o?.seed?.(barsRef.current)); } catch {}
  }, [
    state.moneyFlow,
    state.luxSr,
    state.swingLiquidity,
    state.shelvesFour,
    state.smi1h,
    state.timeframe,
    bars
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

  /* -------- Live 1m stream → aggregate to selected TF bucket --------- */
  useEffect(() => {
    if (!seriesRef.current || !volSeriesRef.current) return;

    const tfSec = TF_SEC[state.timeframe] || TF_SEC["10m"];
    const floorToBucket = (t) => Math.floor(t / tfSec) * tfSec;

    let bucketStart = null;
    let rolling = null;

    // Initialize bucketStart/rolling from last seeded bar
    const lastSeed = barsRef.current[barsRef.current.length - 1] || null;
    if (lastSeed) {
      bucketStart = floorToBucket(lastSeed.time);
      rolling = { ...lastSeed };
    }

    const unsub = subscribeStream(state.symbol, LIVE_TF, (pt) => {
      const tSec = Number(pt.time > 1e12 ? Math.floor(pt.time / 1000) : pt.time);
      if (!Number.isFinite(tSec)) return;

      // 1m charts: stream bar is already on bucket; just update/append
      if (tfSec === TF_SEC["1m"]) {
        const bar = { ...pt, time: tSec };
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
          barsRef.current = next; setBars(next);
        } else if (bar.time === prev.time) {
          const next = [...barsRef.current]; next[next.length - 1] = bar;
          barsRef.current = next; setBars(next);
        }
        try { overlayInstancesRef.current.forEach(o => o?.update?.(bar)); } catch {}
        return;
      }

      // Aggregate 1m ticks into selected TF bucket
      const start = floorToBucket(tSec);
      if (bucketStart === null || start > bucketStart) {
        // close prior bucket → push to series/state
        if (rolling) {
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
          barsRef.current = next; setBars(next);
          try { overlayInstancesRef.current.forEach(o => o?.update?.(rolling)); } catch {}
        }

        // start new bucket with this tick
        bucketStart = start;
        rolling = {
          time: start,
          open: pt.open, high: pt.high, low: pt.low, close: pt.close,
          volume: Number(pt.volume || 0),
        };
      } else {
        // update current bucket
        if (pt.high > rolling.high) rolling.high = pt.high;
        if (pt.low  < rolling.low ) rolling.low  = pt.low;
        rolling.close = pt.close;
        rolling.volume = Number(rolling.volume || 0) + Number(pt.volume || 0);
      }

      // push/update current bucket to the series so you see it animating
      seriesRef.current.update(rolling);
      if (state.volume) {
        volSeriesRef.current.update({
          time: rolling.time,
          value: Number(rolling.volume || 0),
          color: rolling.close >= rolling.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        });
      }
    });

    return () => { try { unsub?.(); } catch {} };
  }, [state.symbol, state.timeframe, state.volume]);

  /* ---------------------------- EMA lines ----------------------------- */
  useEffect(() => {
    const chart = chartRef.current;
    const price = seriesRef.current;
    if (!chart || !price) return;

    const ensure = (ref, color) => {
      if (!ref.current) {
        ref.current = chart.addLineSeries({
          color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
        });
      }
      return ref.current;
    };

    // hide then enable as needed
    if (ema10Ref.current) ema10Ref.current.applyOptions({ visible: false });
    if (ema20Ref.current) ema20Ref.current.applyOptions({ visible: false });
    if (ema50Ref.current) ema50Ref.current.applyOptions({ visible: false });

    if (!state.showEma || bars.length === 0) return;

    const data10 = calcEMA(bars, 10);
    const data20 = calcEMA(bars, 20);
    const data50 = calcEMA(bars, 50);

    const l10 = ensure(ema10Ref, "#f59e0b");
    const l20 = ensure(ema20Ref, "#3b82f6");
    const l50 = ensure(ema50Ref, "#10b981");

    l10.setData(data10); l10.applyOptions({ visible: state.ema10 });
    l20.setData(data20); l20.applyOptions({ visible: state.ema20 });
    l50.setData(data50); l50.applyOptions({ visible: state.ema50 });
  }, [bars, state.showEma, state.ema10, state.ema20, state.ema50]);

  /* ---------------------------- Toolbar props ------------------------ */
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
      ts.fitContent(); didFitOnceRef.current = true; userInteractedRef.current = true; return;
    }
    const r = Number(nextRange);
    if (!Number.isFinite(r) || r <= 0) {
      ts.fitContent(); didFitOnceRef.current = true; userInteractedRef.current = true; return;
    }
    const to = len - 1;
    const from = Math.max(0, to - (r - 1));
    ts.setVisibleLogicalRange({ from, to });
    didFitOnceRef.current = true; userInteractedRef.current = true;
  };

  const toolbarProps = {
    showEma: state.showEma,
    ema10: state.ema10, ema20: state.ema20, ema50: state.ema50,
    volume: state.volume,
    moneyFlow: state.moneyFlow, luxSr: state.luxSr, swingLiquidity: state.swingLiquidity,
    smi1h: state.smi1h,
    shelvesFour: state.shelvesFour,
    onChange: handleControlsChange,
    onReset: () =>
      setState((s) => ({
        ...s,
        showEma: true, ema10: true, ema20: true, ema50: true,
        volume: true,
        moneyFlow: false, luxSr: false, swingLiquidity: false,
        smi1h: false, shelvesFour: false,
      })),
  };

  const wrapperStyle = useMemo(() => (
    fullScreen
      ? { display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, overflow: "hidden", background: DEFAULTS.bg }
      : { display: "flex", flexDirection: "column", border: `1px solid ${DEFAULTS.border}`, borderRadius: 8, overflow: "hidden", background: DEFAULTS.bg }
  ), [fullScreen]);

  const containerStyle = useMemo(() => (
    fullScreen
      ? { width: "100%", height: "100%", minHeight: 0, maxHeight: "none", flex: "1 1 auto", overflow: "hidden", background: DEFAULTS.bg, position: "relative" }
      : { width: "100%", height: "520px", minHeight: 520, maxHeight: 520, flex: "0 0 auto", overflow: "hidden", background: DEFAULTS.bg, position: "relative" }
  ), [fullScreen]);

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
      <div ref={containerRef} style={containerStyle} />
    </div>
  );
}
