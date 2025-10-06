// src/pages/rows/RowChart/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import IndicatorsToolbar from "./IndicatorsToolbar";
import { getOHLC, subscribeStream } from "../../../lib/ohlcClient";

// Overlays (left wired, they won’t affect axis/volume stability)
import MoneyFlowOverlay from "../../../components/overlays/MoneyFlowOverlay";
import RightProfileOverlay from "../../../components/overlays/RightProfileOverlay";
import SessionShadingOverlay from "../../../components/overlays/SessionShadingOverlay";
import SwingLiquidityOverlay from "../../../components/overlays/SwingLiquidityOverlay";

/* -------------------- constants -------------------- */
const SEED_LIMIT = 2000; // backend supplies months of 10m/1h/4h
const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDown: "rgba(239,83,80,0.5)",
  grid: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};
const TF_SEC = {
  "1m": 60, "5m": 300, "10m": 600, "15m": 900, "30m": 1800,
  "1h": 3600, "4h": 14400, "1d": 86400,
};
const LIVE_TF = "1m";

/* -------------------- helpers -------------------- */
// TradingView-style tick formatter (seconds on 1m; hh:mm on intraday; date on daily)
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
    if (isMidnight || onHour) return fmtBoundary.format(d);
    return fmtTime.format(d);
  };
}

// Crosshair tooltip (AZ)
function phoenixTime(ts, isDaily = false) {
  const seconds = typeof ts === "number" ? ts : (ts && (ts.timestamp ?? ts.time)) || 0;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(isDaily
      ? { month: "short", day: "2-digit" }
      : { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(seconds * 1000));
}

function calcEMA(barsAsc, length) {
  if (!Array.isArray(barsAsc) || !barsAsc.length || length <= 1) return [];
  const k = 2 / (length + 1);
  const out = [];
  let ema;
  for (let i = 0; i < barsAsc.length; i++) {
    const c = Number(barsAsc[i].close);
    if (!Number.isFinite(c)) continue;
    ema = i === 0 ? c : c * k + ema * (1 - k);
    out.push({ time: barsAsc[i].time, value: ema });
  }
  return out;
}

// Accept class, factory, or static attach() overlays
function attachOverlay(Module, args) {
  try {
    if (!Module) return null;
    try { const inst = new Module(args); if (inst && (inst.update || inst.destroy)) return inst; } catch {}
    try { const inst = Module(args); if (inst && (inst.update || inst.destroy)) return inst; } catch {}
    if (Module.attach) return Module.attach(args);
  } catch {}
  return { update() {}, destroy() {} };
}

/* -------------------- component -------------------- */
export default function RowChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
}) {
  // DOM & series refs
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);

  // Overlay instances
  const moneyFlowRef = useRef(null);
  const rightProfileRef = useRef(null);
  const sessionShadeRef = useRef(null);
  const swingLiqRef = useRef(null);

  // Data
  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  // UI / toolbar
  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: "ALL",
    disabled: false,
    showEma: true, ema10: true, ema20: true, ema50: true,
    volume: true,
    moneyFlow: false,
    luxSr: false,
    swingLiquidity: false,
  });

  const symbols = useMemo(() => ["SPY", "QQQ", "IWM"], []);
  const timeframes = useMemo(
    () => ["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"],
    []
  );

  /* -------------------- mount chart (stable fixed height) -------------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const FIXED_HEIGHT = 520; // stable row height; no full-screen behavior

    const chart = createChart(el, {
      width: el.clientWidth,
      height: FIXED_HEIGHT,
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db" },
      grid: { vertLines: { color: DEFAULTS.grid }, horzLines: { color: DEFAULTS.grid } },
      rightPriceScale: {
        borderColor: DEFAULTS.border,
        scaleMargins: { top: 0.1, bottom: 0.2 }, // bottom buffer keeps axis visible
      },
      timeScale: {
        borderColor: DEFAULTS.border,
        timeVisible: true,
        secondsVisible: defaultTimeframe === "1m",                    // seconds only on 1m
        tickMarkFormatter: makeTickFormatter(defaultTimeframe),       // dynamic by TF
        rightOffset: 0,
        barSpacing: 6,
        minBarSpacing: 0.5,
      },
      localization: {
        timeFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const price = chart.addCandlestickSeries({
      upColor: DEFAULTS.upColor, downColor: DEFAULTS.downColor,
      wickUpColor: DEFAULTS.upColor, wickDownColor: DEFAULTS.downColor,
      borderUpColor: DEFAULTS.upColor, borderDownColor: DEFAULTS.downColor,
    });
    seriesRef.current = price;

    const vol = chart.addHistogramSeries({ priceScaleId: "", priceFormat: { type: "volume" } });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    // Keep width responsive, height fixed
    const ro = new ResizeObserver(() => chart.resize(el.clientWidth, FIXED_HEIGHT));
    ro.observe(el);

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
      ema10Ref.current = ema20Ref.current = ema50Ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply dynamic formatter when timeframe changes (no layout change)
  useEffect(() => {
    const chart = chartRef.current; if (!chart) return;
    const tf = state.timeframe;
    chart.applyOptions({
      timeScale: {
        tickMarkFormatter: makeTickFormatter(tf),
        secondsVisible: tf === "1m",
      },
      localization: { timeFormatter: (t) => phoenixTime(t, tf === "1d") },
    });
  }, [state.timeframe]);

  /* -------------------- seed load -------------------- */
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
        if (chartRef.current && state.range === "ALL") chartRef.current.timeScale().fitContent();
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

  /* -------------------- render + range -------------------- */
  useEffect(() => {
    const chart = chartRef.current;
    const price = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !price) return;

    // Candles first
    price.setData(bars);

    // Ensure histogram is always populated right after candles
    if (vol) {
      vol.applyOptions({ visible: !!state.volume });
      vol.setData(
        state.volume
          ? bars.map((b) => ({
              time: b.time,
              value: Number(b.volume || 0),
              color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
            }))
          : []
      );
    }

    // Range handling
    const ts = chart.timeScale();
    const len = bars.length;
    if (!len) return;

    if (state.range === "ALL") {
      ts.fitContent();
    } else if (typeof state.range === "number") {
      const to = len - 1;
      const from = Math.max(0, to - (state.range - 1));
      ts.setVisibleLogicalRange({ from, to });
    } else {
      ts.fitContent();
    }
  }, [bars, state.range, state.volume]);

  /* -------------------- live 1m → TF aggregation -------------------- */
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

      if (tfSec === TF_SEC["1m"]) {
        seriesRef.current.update(oneMin);
        if (state.volume && volSeriesRef.current) {
          volSeriesRef.current.update({
            time: oneMin.time,
            value: Number(oneMin.volume || 0),
            color: oneMin.close >= oneMin.open ? DEFAULTS.volUp : DEFAULTS.volDown,
          });
        }
        const next = [...barsRef.current];
        const last = next[next.length - 1];
        if (!last || oneMin.time > last.time) next.push(oneMin);
        else next[next.length - 1] = oneMin;
        barsRef.current = next;
        setBars(next);
        return;
      }

      const start = floorToBucket(t);
      if (bucketStart === null || start > bucketStart) {
        // close previous bucket
        if (rolling && (!lastSeed || rolling.time >= lastSeed.time)) {
          seriesRef.current.update(rolling);
          if (state.volume && volSeriesRef.current) {
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
        // update current bucket
        rolling.high = Math.max(rolling.high, oneMin.high);
        rolling.low = Math.min(rolling.low, oneMin.low);
        rolling.close = oneMin.close;
        rolling.volume = Number(rolling.volume || 0) + Number(oneMin.volume || 0);
      }

      // live-paint current bucket
      seriesRef.current.update(rolling);
      if (state.volume && volSeriesRef.current) {
        volSeriesRef.current.update({
          time: rolling.time,
          value: Number(rolling.volume || 0),
          color: rolling.close >= rolling.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        });
      }

      const next = [...barsRef.current];
      const last = next[next.length - 1];
      if (!last || rolling.time > last.time) next.push({ ...rolling });
      else next[next.length - 1] = { ...rolling };
      barsRef.current = next;
      setBars(next);
    });

    return () => unsub?.();
  }, [state.symbol, state.timeframe, state.volume]);

  /* -------------------- EMAs -------------------- */
  useEffect(() => {
    const chart = chartRef.current;
    const price = seriesRef.current;
    if (!chart || !price) return;

    const ensureLine = (ref, color) => {
      if (!ref.current) {
        ref.current = chart.addLineSeries({
          color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
        });
      }
      return ref.current;
    };

    // hide all
    if (ema10Ref.current) ema10Ref.current.applyOptions({ visible: false });
    if (ema20Ref.current) ema20Ref.current.applyOptions({ visible: false });
    if (ema50Ref.current) ema50Ref.current.applyOptions({ visible: false });

    if (!state.showEma || bars.length === 0) return;

    if (state.ema10) { const l = ensureLine(ema10Ref, "#f59e0b"); l.setData(calcEMA(bars, 10)); l.applyOptions({ visible: true }); }
    if (state.ema20) { const l = ensureLine(ema20Ref, "#3b82f6"); l.setData(calcEMA(bars, 20)); l.applyOptions({ visible: true }); }
    if (state.ema50) { const l = ensureLine(ema50Ref, "#10b981"); l.setData(calcEMA(bars, 50)); l.applyOptions({ visible: true }); }
  }, [bars, state.showEma, state.ema10, state.ema20, state.ema50]);

  /* -------------------- overlays (optional) -------------------- */
  useEffect(() => {
    const chart = chartRef.current; const price = seriesRef.current;
    if (!chart || !price) return;
    if (state.moneyFlow) {
      if (!moneyFlowRef.current) {
        moneyFlowRef.current = attachOverlay(MoneyFlowOverlay, { chart, series: price });
      }
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
        sessionShadeRef.current = attachOverlay(SessionShadingOverlay, { chart, series: price, timezone: "America/Phoenix" });
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

  /* -------------------- handlers -------------------- */
  const handleControlsChange = (patch) => setState((s) => ({ ...s, ...patch }));
  const applyRange = (nextRange) => {
    const chart = chartRef.current; if (!chart) return;
    setState((s) => ({ ...s, range: nextRange }));
    const ts = chart.timeScale(); const list = barsRef.current; const len = list.length;
    if (!len) return;
    if (nextRange === "ALL") { ts.fitContent(); return; }
    const r = Number(nextRange);
    if (!Number.isFinite(r) || r <= 0) { ts.fitContent(); return; }
    const to = len - 1; const from = Math.max(0, to - (r - 1));
    ts.setVisibleLogicalRange({ from, to });
  };

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

  /* -------------------- render -------------------- */
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

      {/* Fixed-height chart canvas (NO full-screen behavior) */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 520,
          minHeight: 360,
          boxSizing: "border-box",
          background: DEFAULTS.bg,
        }}
      />
    </div>
  );
}
