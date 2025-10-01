// src/components/LiveLWChart/LiveLWChart.jsx
// Lightweight Charts wrapper — isolated card + safe scaling (AZ time axis)
// Seed from /api/v1/ohlc and stream via backend SSE /stream/agg

import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { getOHLC } from "../../services/ohlc";   // ✅ seed history from backend alias

// backend base (same pattern used elsewhere in your app)
const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  "https://frye-market-backend-1.onrender.com";

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "10m",
  enabledIndicators = [],   // reserved for future use
  indicatorSettings = {},   // reserved for future use
  height = 520,
}) {
  // panel (outer visible card) and inner chart root
  const panelRef = useRef(null);
  const chartRootRef = useRef(null);

  // chart internals
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);
  const dprCleanupRef = useRef(null);

  const [candles, setCandles] = useState([]);

  // keep chart responsive to its container
  const safeResize = () => {
    const el = chartRootRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    chart.resize(el.clientWidth, el.clientHeight);
  };

  // ---- Phoenix time formatter (works across LW charts versions) ----
  const phoenixFormatter = (ts) => {
    // library may pass a number (seconds) or an object { timestamp }
    const seconds =
      typeof ts === "number"
        ? ts
        : ts && typeof ts.timestamp === "number"
        ? ts.timestamp
        : 0;
    const d = new Date(seconds * 1000);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  };

  // ---- INIT ----
  useEffect(() => {
    const holder = chartRootRef.current;
    if (!holder) return;

    // keep canvases scoped inside the card
    holder.style.position = "relative";
    holder.style.zIndex = "1";

    const chart = createChart(holder, {
      ...baseChartOptions,
      width: holder.clientWidth,
      height,
      // assert AZ localization; timeScale tick formatter will reinforce it
      localization: {
        ...(baseChartOptions.localization || {}),
        timezone: "America/Phoenix",
        dateFormat: "yyyy-MM-dd",
        timeFormatter: phoenixFormatter,
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: baseChartOptions?.upColor ?? "#26a69a",
      downColor: baseChartOptions?.downColor ?? "#ef5350",
      borderUpColor: baseChartOptions?.borderUpColor ?? "#26a69a",
      borderDownColor: baseChartOptions?.borderDownColor ?? "#ef5350",
      wickUpColor: baseChartOptions?.wickUpColor ?? "#26a69a",
      wickDownColor: baseChartOptions?.wickDownColor ?? "#ef5350",
    });
    seriesRef.current = candleSeries;

    // ensure bottom axis is visible & shows AZ tick labels
    chart.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
      minimumHeight: 20,
      tickMarkFormatter: (time) => phoenixFormatter(time),
    });

    // observe ONLY this element (prevents resize feedback loops)
    const ro = new ResizeObserver(safeResize);
    ro.observe(holder);
    roRef.current = ro;

    // respond to OS/browser zoom changes for crisp rendering
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDpr = () => safeResize();
    if (mq.addEventListener) {
      mq.addEventListener("change", onDpr);
      dprCleanupRef.current = () => mq.removeEventListener("change", onDpr);
    } else if (mq.addListener) {
      mq.addListener(onDpr);
      dprCleanupRef.current = () => mq.removeListener(onDpr);
    }

    // initial size sync
    safeResize();

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { dprCleanupRef.current?.(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  // ---- LOAD + STREAM (seed + SSE) ----
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    let disposed = false;
    let es = null;

    // 1) Seed history from backend alias (✅ /api/v1/ohlc)
    (async () => {
      try {
        const seed = await getOHLC(symbol, timeframe, 5000);
        if (disposed) return;
        if (Array.isArray(seed) && seed.length) {
          series.setData(seed);
          setCandles(seed);
          chart.timeScale().fitContent();
        } else {
          series.setData([]);
          setCandles([]);
        }
      } catch (e) {
        console.error("[LiveLWChart] history failed:", e);
        series.setData([]);
        setCandles([]);
      }
    })();

    // 2) SSE stream from backend WS relay (instant last-candle updates)
    //    /stream/agg?symbol=SPY&tf=10m (bar.time is bucket start in SECONDS)
    const url =
      `${API_BASE.replace(/\/+$/, "")}/stream/agg` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&tf=${encodeURIComponent(timeframe)}`;

    try {
      es = new EventSource(url);
    } catch (e) {
      console.error("[LiveLWChart] SSE init error:", e);
      es = null;
    }

    if (es) {
      es.onmessage = (ev) => {
        if (disposed) return;
        try {
          const msg = JSON.parse(ev.data);
          const b = msg?.bar;
          const tSec = Number(b?.time);
          // guard: require valid seconds epoch (>= 1e9) or ignore
          if (!msg?.ok || !b || !Number.isFinite(tSec) || tSec < 1_000_000_000) return;

          const live = {
            time: tSec,
            open: Number(b.open),
            high: Number(b.high),
            low:  Number(b.low),
            close:Number(b.close),
            volume: Number(b.volume || 0),
          };

          series.update(live);
          setCandles((prev) => mergeBar(prev, live));
        } catch (e) {
          // ignore bad packet
        }
      };

      es.onerror = () => {
        // let browser auto-reconnect; nothing to do here
      };
    }

    return () => {
      disposed = true;
      try { es?.close?.(); } catch {}
    };
  }, [symbol, timeframe]);

  // ---- RENDER ----
  return (
    <section
      ref={panelRef}
      className="panel chart-card"
      style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        minHeight: height,
        border: "1px solid #1f2a44",
        borderRadius: 8,
        background: "#0b0b14",
        overflow: "hidden",
        marginTop: 12,
      }}
    >
      {/* chart mount root */}
      <div
        ref={chartRootRef}
        className="chart-root"
        style={{ position: "relative", width: "100%", height }}
      />
    </section>
  );
}

/* -------------------- helpers -------------------- */

// if time is in ms (e.g., 1695402600000), convert to seconds
function normalizeSeconds(t) {
  if (typeof t === "number" && t > 1e12) return Math.floor(t / 1000);
  return t;
}

function mergeBar(prev, bar) {
  if (!Array.isArray(prev) || prev.length === 0) return [bar];
  const last = prev[prev.length - 1];
  if (last && last.time === bar.time) {
    const next = prev.slice(0, -1);
    next.push(bar);
    return next;
  }
  return [...prev, bar];
}
