// src/components/LiveLWChart/LiveLWChart.jsx
// Lightweight Charts wrapper — isolated card + safe scaling (AZ time axis)

import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { getFeed } from "../../services/feed";

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  enabledIndicators = [],    // reserved for future use
  indicatorSettings = {},    // reserved for future use
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

  // ensure chart follows container size
  const safeResize = () => {
    const el = chartRootRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    chart.resize(el.clientWidth, el.clientHeight);
  };

  // -------- timezone formatter (works across library versions) --------
  const phoenixFormatter = (ts) => {
    // lightweight-charts can pass either seconds (number) or {timestamp}
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

  // ---------- INIT ----------
  useEffect(() => {
    const holder = chartRootRef.current;
    if (!holder) return;

    // keep canvases scoped inside the card
    holder.style.position = "relative";
    holder.style.zIndex = "1";

    // merge your base options, then assert AZ localization + sizes
    const chart = createChart(holder, {
      ...baseChartOptions,
      width: holder.clientWidth,
      height,
      localization: {
        ...(baseChartOptions.localization || {}),
        timezone: "America/Phoenix",         // <-- AZ time
        dateFormat: "yyyy-MM-dd",
        timeFormatter: phoenixFormatter,     // safe for multiple lib versions
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

    // keep bottom axis visible with room for labels
    chart.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
      minimumHeight: 20,
      // some builds ignore localization until timeVisible is set -> we set it
    });

    // respond to container size changes (observe only this element)
    const ro = new ResizeObserver(() => safeResize());
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

  // ---------- LOAD + STREAM ----------
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const feed = getFeed(symbol, timeframe);
    let disposed = false;

    (async () => {
      try {
        const seed = await feed.history();
        if (disposed) return;
        if (Array.isArray(seed)) {
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

    const unsub = feed.subscribe((bar) => {
      if (disposed || !bar || bar.time == null) return;
      series.update(bar);
      setCandles((prev) => mergeBar(prev, bar));
    });

    return () => {
      disposed = true;
      try { unsub?.(); } catch {}
      try { feed.close?.(); } catch {}
    };
  }, [symbol, timeframe]);

  // ---------- RENDER ----------
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
      <div
        ref={chartRootRef}
        className="chart-root"
        style={{ position: "relative", width: "100%", height }}
      />
    </section>
  );
}

// ---------- helpers ----------
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
