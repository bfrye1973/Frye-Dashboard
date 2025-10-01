// src/pages/rows/RowChart/index.jsx
// RowChart — deep seed + live now-bar poller (no sockets)
// - History from /api/v1/ohlc (full array, no slicing)
// - Live last bucket from /api/v1/live/nowbar (15s)
// - AZ time on hover + axis
// - Volume histogram (bottom 20%)
// - Fixed height = 520
// - Range 50/100 = last N bars (viewport only), 200 = FULL TIMELINE

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { getOHLC } from "../../../lib/ohlcClient";
import { SYMBOLS, TIMEFRAMES } from "./constants";

/* --------------------------- constants / styles -------------------------- */
const API_BASE_DEFAULT = "https://frye-market-backend-1.onrender.com";
const SEED_LIMIT = 5000; // backend still clamps; deep enough for intra + hourly

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDown: "rgba(239,83,80,0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

/* ------------------------------- helpers -------------------------------- */
function phoenixTime(ts, isDaily = false) {
  const seconds =
    typeof ts === "number"
      ? ts
      : ts && typeof ts.timestamp === "number"
      ? ts.timestamp
      : 0;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(isDaily
      ? { month: "short", day: "2-digit" }
      : { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(seconds * 1000));
}

/* --------------------------------- main --------------------------------- */
export default function RowChart({
  apiBase = API_BASE_DEFAULT,
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  showDebug = false,
}) {
  // Make sure lib client sees the same base for /api/v1/ohlc
  useEffect(() => {
    if (typeof window !== "undefined" && apiBase) {
      window.__API_BASE__ = apiBase.replace(/\/+$/, "");
    }
  }, [apiBase]);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const roRef = useRef(null);

  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: 200, // 200 = FULL timeline
    disabled: false,
  });

  const symbols = useMemo(() => SYMBOLS, []);
  const timeframes = useMemo(() => TIMEFRAMES, []);

  /* ------------------------------ create chart ------------------------------ */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db" },
      grid: {
        vertLines: { color: DEFAULTS.gridColor },
        horzLines: { color: DEFAULTS.gridColor },
      },
      rightPriceScale: {
        borderColor: DEFAULTS.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: { borderColor: DEFAULTS.border, timeVisible: true },
      localization: {
        timezone: "America/Phoenix",
        timeFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: DEFAULTS.upColor,
      downColor: DEFAULTS.downColor,
      wickUpColor: DEFAULTS.upColor,
      wickDownColor: DEFAULTS.downColor,
      borderUpColor: DEFAULTS.upColor,
      borderDownColor: DEFAULTS.downColor,
    });
    seriesRef.current = series;

    const vol = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    chart.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      minimumHeight: 20,
    });

    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return;
      chartRef.current.resize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    });
    ro.observe(el);
    roRef.current = ro;

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { chartRef.current?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update axis label style when timeframe changes (daily vs intraday)
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      timeVisible: state.timeframe !== "1d",
    });
  }, [state.timeframe]);

  /* ------------------------------ seed history ----------------------------- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        if (cancelled) return;

        const asc = (Array.isArray(seed) ? seed : [])
          .slice()
          .sort((a, b) => a.time - b.time);

        barsRef.current = asc;
        setBars(asc);

        if (typeof window !== "undefined") {
          const first = asc[0]?.time ?? 0;
          const last = asc[asc.length - 1]?.time ?? 0;
          const spanDays = first && last ? Math.round((last - first) / 86400) : 0;
          window.__ROWCHART_INFO__ = {
            tf: state.timeframe,
            bars: asc.length,
            spanDays,
            source: "api/v1/ohlc",
          };
          if (showDebug) console.log("[ROWCHART seed]", window.__ROWCHART_INFO__);
        }
      } catch (e) {
        if (showDebug) console.error("[ROWCHART] load error:", e);
        barsRef.current = [];
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.symbol, state.timeframe, showDebug]);

  /* ------------------------------ render bars ------------------------------ */
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !series) return;

    series.setData(bars);

    if (vol) {
      vol.setData(
        bars.map((b) => ({
          time: b.time,
          value: Number(b.volume ?? 0),
          color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        }))
      );
    }

    requestAnimationFrame(() => {
      const ts = chart.timeScale();
      const r = state.range;
      const len = bars.length;
      if (!r || r === 200 || !len) {
        ts.fitContent();
      } else {
        const to = len - 1;
        const from = Math.max(0, to - (r - 1));
        ts.setVisibleLogicalRange({ from, to });
      }
    });
  }, [bars, state.range]);

  /* ------------------------------ live poller ------------------------------ */
 // --- LIVE NOW-BAR POLLER (every 10s) ---
 useEffect(() => {
  // build backend base (uses window.__API_BASE__ if set)
  const API_BASE =
    (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
    "https://frye-market-backend-1.onrender.com";

  let timer;
  let cancelled = false;

  async function tick() {
    try {
      const url =
        `${API_BASE.replace(/\/+$/, "")}/api/v1/live/nowbar` +
        `?symbol=${encodeURIComponent(state.symbol)}` +
        `&tf=${encodeURIComponent(state.timeframe)}` +
        `&t=${Date.now()}`;

      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      const b = j?.bar;
      if (!b || cancelled) return;

      // normalize + merge
      const live = {
        time: Number(b.time),                    // seconds epoch
        open: Number(b.open),
        high: Number(b.high),
        low:  Number(b.low),
        close:Number(b.close),
        volume: Number(b.volume || 0),
      };

      // Update the chart series directly (flicker-free),
      // and keep your local 'bars' state in sync if you use it elsewhere
      if (seriesRef?.current) seriesRef.current.update(live);
      if (volSeriesRef?.current) {
        volSeriesRef.current.update({
          time: live.time,
          value: live.volume,
          color: live.close >= live.open
            ? "rgba(38,166,154,0.5)"
            : "rgba(239,83,80,0.5)",
        });
      }

      // Keep in-memory list consistent if your file uses it
      if (typeof setBars === "function") {
        setBars((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return [live];
          const last = prev[prev.length - 1];
          if (last?.time === live.time) {
            const next = prev.slice();
            next[next.length - 1] = live;
            return next;
          }
          if (!last || live.time > last.time) return [...prev, live];
          return prev;
        });
      }
    } catch {
      // ignore, retry next tick
    } finally {
      if (!cancelled) timer = setTimeout(tick, 10000); // 10s cadence
    }
  }

  // don’t poll daily; it only changes once/day
  if (state.timeframe !== "1d") tick();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}, [state.symbol, state.timeframe]);


  /* ------------------------------ range camera ----------------------------- */
  const applyRange = (nextRange) => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const list = barsRef.current;
    const len = list.length;
    if (!nextRange || nextRange === 200 || !len) {
      ts.fitContent();
      return;
    }
    const to = len - 1;
    const from = Math.max(0, to - (nextRange - 1));
    ts.setVisibleLogicalRange({ from, to });
  };

  const handleControlsChange = (patch) => setState((s) => ({ ...s, ...patch }));

  const handleTest = async () => {
    try {
      const got = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
      alert(`Fetched ${Array.isArray(got) ? got.length : 0} bars from /api/v1/ohlc`);
    } catch {
      alert("Fetch failed");
    }
  };

  /* --------------------------------- UI ----------------------------------- */
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
        onTest={showDebug ? handleTest : null}
      />

      {/* IMPORTANT: keep the same fixed height to avoid the black-canvas issue */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: 520, minHeight: 360, background: DEFAULTS.bg }}
      />
    </div>
  );
}
