// src/pages/rows/RowChart/index.jsx
// ============================================================
// RowChart — month seed + live 1m→TF aggregation + Indicators wiring
// - AZ timezone on axis + tooltip
// - "All" range support (fit once; no auto-fit on every tick)
// - IndicatorsToolbar wired: EMA10/20/50, Volume, MoneyFlow, RightProfile,
//   SessionShading (via luxSr toggle), SwingLiquidity
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import { getOHLC, subscribeStream } from "../../../lib/ohlcClient";

// Overlays
import MoneyFlowOverlay from "../../../components/overlays/MoneyFlowOverlay";
import RightProfileOverlay from "../../../components/overlays/RightProfileOverlay";
import SessionShadingOverlay from "../../../components/overlays/SessionShadingOverlay";
import SwingLiquidityOverlay from "../../../components/overlays/SwingLiquidityOverlay";

// ---------- Config ----------
const SEED_LIMIT = 6000; // ~1 month of 10m bars + buffer

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

// ---------- AZ time helpers ----------
function phoenixTime(ts, isDaily = false) {
  const seconds =
    typeof ts === "number"
      ? ts
      : (ts && (ts.timestamp ?? ts.time)) || 0;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(isDaily ? { month: "short", day: "2-digit" } : { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(seconds * 1000));
}

// TradingView-style ticks: seconds on 1m; hh:mm on intraday; date on daily
function makeTickFormatter(tf) {
  const showSeconds = tf === "1m";
  const isDailyTF   = tf === "1d";

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
    const onHour     = d.getMinutes() === 0;
    return (isMidnight || onHour) ? fmtBoundary.format(d) : fmtTime.format(d);
  };
}

// ---------- Small utils ----------
function calcEMA(barsAsc, length) {
  if (!Array.isArray(barsAsc) || !barsAsc.length || !Number.isFinite(length) || length <= 1) return [];
  const k = 2 / (length + 1);
  const out = [];
  let ema = undefined;
  for (let i = 0; i < barsAsc.length; i++) {
    const c = Number(barsAsc[i].close);
    if (!Number.isFinite(c)) continue;
    if (ema === undefined) ema = c; else ema = c * k + ema * (1 - k);
    out.push({ time: barsAsc[i].time, value: ema });
  }
  return out;
}

// Flexible overlay attach (works with class, factory, or {attach})
function attachOverlay(Module, args) {
  try {
    if (!Module) return null;
    try { const inst = new Module(args); if (inst && (inst.update || inst.destroy)) return inst; } catch {}
    try { const inst = Module(args); if (inst && (inst.update || inst.destroy)) return inst; } catch {}
    if (typeof Module.attach === "function") return Module.attach(args);
  } catch {}
  return { update() {}, destroy() {} };
}

export default function RowChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
  fullScreen = false, // if true (on /chart), we can use 100vh
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

  // Overlay instances
  const moneyFlowRef = useRef(null);
  const rightProfileRef = useRef(null);
  const sessionShadeRef = useRef(null);
  const swingLiqRef = useRef(null);

  // Bars state
  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  // Fit/interaction guards
  const didFitOnceRef = useRef(false);     // set true after seed fit or Range click
  const userInteractedRef = useRef(false); // set true on wheel/drag once

  // UI / Indicators state
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: "ALL",
    disabled: false,

    // Indicators (defaults show EMA + Volume only)
    showEma: true,
    ema10: true,
    ema20: true,
    ema50: true,
    volume: true,
    moneyFlow: false,
    luxSr: false,            // mapped to SessionShadingOverlay below
    swingLiquidity: false,
  });

  const symbols = useMemo(() => ["SPY", "QQQ", "IWM"], []);
  const timeframes = useMemo(() => ["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"], []);

  // ---------- Mount chart ----------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: fullScreen ? el.clientHeight : el.clientHeight, // parent controls height
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

    // mark user interaction (prevents any auto-fit in future)
    const markInteract = () => { userInteractedRef.current = true; };
    el.addEventListener("wheel", markInteract, { passive: true });
    el.addEventListener("mousedown", markInteract);

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

    const ro = new ResizeObserver(() => chart.resize(el.clientWidth, el.clientHeight));
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

  // Keep AZ formatters + secondsVisible correct on TF change; also reset fit guard
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
    // new TF: allow a fresh single fit after seed
    didFitOnceRef.current = false;
  }, [state.timeframe]);

  // ---------- Historical seed (fit ONCE here) ----------
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
          // Fit ONCE immediately after seed (no further auto-fit on ticks)
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
  }, [state.symbol, state.timeframe, showDebug, state.range]);

  // ---------- Render + range (NO auto-fit on every tick) ----------
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

    // Respect Range buttons (explicit user action)
    const ts = chart.timeScale();
    const len = bars.length;
    if (!len) return;

    if (state.range === "ALL") {
      // Only fit if we haven't already fit after seed, and user hasn't interacted.
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

  // ---------- Live stream: 1m → selected TF aggregation ----------
  useEffect(() => {
    // when TF/symbol changes, this effect cleans up previous subscription automatically
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

      // 1m TF: push finished bar to state only when a NEW minute bar begins
      if (tfSec === TF_SEC["1m"]) {
        seriesRef.current.update(oneMin);
        if (state.volume && volSeriesRef.current) {
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

      // Aggregated TFs: update rolling bucket live, commit to state ONLY when bucket closes
      const start = floorToBucket(t);

      // bucket rollover: commit the previous bucket (CLOSE) to state once
      if (bucketStart === null || start > bucketStart) {
        if (rolling && (!lastSeed || rolling.time >= lastSeed.time)) {
          // Paint the final closed bucket to series & vol
          seriesRef.current.update(rolling);
          if (state.volume && volSeriesRef.current) {
            volSeriesRef.current.update({
              time: rolling.time,
              value: Number(rolling.volume || 0),
              color: rolling.close >= rolling.open ? DEFAULTS.volUp : DEFAULTS.volDown,
            });
          }
          // Commit closed bucket to React state ONCE per bucket
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

      // paint current open bucket to the chart (no React state change yet)
      seriesRef.current.update(rolling);
      if (state.volume && volSeriesRef.current) {
        volSeriesRef.current.update({
          time: rolling.time,
          value: Number(rolling.volume || 0),
          color: rolling.close >= rolling.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        });
      }
    });

    return () => unsub?.();
  }, [state.symbol, state.timeframe, state.volume]);

  // ---------- EMA lines ----------
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

  // ---------- Overlays ----------
  useEffect(() => {
    const chart = chartRef.current; const price = seriesRef.current;
    if (!chart || !price) return;
    if (state.moneyFlow) {
      if (!moneyFlowRef.current) moneyFlowRef.current = attachOverlay(MoneyFlowOverlay, { chart, series: price });
      try { moneyFlowRef.current.update?.(bars); } catch {}
    } else {
      try { moneyFlowRef.current?.destroy?.(); } catch {}
      moneyFlowRef.current = null;
    }
  }, [state.moneyFlow, bars]);

  useEffect(() => {
    const chart = chartRef.current; const price = seriesRef.current;
    if (!chart || !price) return;
    if (state.volume && !rightProfileRef.current) {
      rightProfileRef.current = attachOverlay(RightProfileOverlay, { chart, series: price });
    }
    if (rightProfileRef.current) {
      try { rightProfileRef.current.update?.(bars); } catch {}
    }
  }, [state.volume, bars]);

  useEffect(() => {
    const chart = chartRef.current; const price = seriesRef.current;
    if (!chart || !price) return;
    if (state.luxSr) {
      if (!sessionShadeRef.current) {
        sessionShadeRef.current = attachOverlay(SessionShadingOverlay, {
          chart, series: price, timezone: "America/Phoenix",
        });
      }
      try { sessionShadeRef.current.update?.(bars, { timeframe: state.timeframe }); } catch {}
    } else {
      try { sessionShadeRef.current?.destroy?.(); } catch {}
      sessionShadeRef.current = null;
    }
  }, [state.luxSr, state.timeframe, bars]);

  useEffect(() => {
    const chart = chartRef.current; const price = seriesRef.current;
    if (!chart || !price) return;
    if (state.swingLiquidity) {
      if (!swingLiqRef.current) {
        swingLiqRef.current = attachOverlay(SwingLiquidityOverlay, { chart, series: price });
      }
      try { swingLiqRef.current.update?.(bars); } catch {}
    } else {
      try { swingLiqRef.current?.destroy?.(); } catch {}
      swingLiqRef.current = null;
    }
  }, [state.swingLiquidity, bars]);

  // ---------- Controls ----------
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
      didFitOnceRef.current = true;             // lock: no further auto-fit
      userInteractedRef.current = true;         // treat as explicit user choice
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

  // ---------- Toolbar ----------
  const handleIndicatorsChange = (patch) => setState((s) => ({ ...s, ...patch }));
  const handleIndicatorsReset = () =>
    setState((s) => ({
      ...s,
      showEma: true, ema10: true, ema20: true, ema50: true,
      volume: true, moneyFlow: false, luxSr: false, swingLiquidity: false,
    }));

  const toolbarProps = {
    showEma: state.showEma,
    ema10: state.ema10, ema20: state.ema20, ema50: state.ema50,
    volume: state.volume,
    moneyFlow: state.moneyFlow, luxSr: state.luxSr, swingLiquidity: state.swingLiquidity,
    showSmiToggle: false,
    onChange: handleIndicatorsChange,
    onReset: handleIndicatorsReset,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${DEFAULTS.border}`,
        borderRadius: 8,
        overflow: "hidden",
        background: DEFAULTS.bg,
      }}
    >
      <Controls
        symbols={symbols}
        timeframes={timeframes}
        value={state}
        onChange={handleControlsChange}
        onRange={applyRange}
      />

      <IndicatorsToolbar {...toolbarProps} />

     const H = fullScreen ? "100%" : "520px";

<div
  ref={containerRef}
  style={{
    width: "100%",
    height: H,                 // full screen fills parent; dashboard fixed
    minHeight: fullScreen ? 0 : 520,
    maxHeight: fullScreen ? "none" : 520,
    flex: fullScreen ? "1 1 auto" : "0 0 auto",
    overflow: "hidden",
    background: DEFAULTS.bg,   // keep whatever you had here
  }}
>
  {/* chart host */}
</div>
