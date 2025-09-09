// src/components/LiveLWChart/LiveLWChart.jsx
// Lightweight Charts wrapper — isolated card + safe scaling

import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { getFeed } from "../../services/feed";

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  enabledIndicators = [],      // reserved for later
  indicatorSettings = {},      // reserved for later
  height = 520,
}) {
  // OUTER PANEL (the visible card)
  const panelRef = useRef(null);

  // ROOT for the chart/canvases (must be inside the card)
  const chartRootRef = useRef(null);

  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);
  const dprCleanupRef = useRef(null);

  const [candles, setCandles] = useState([]);

  const safeResize = () => {
    const el = chartRootRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    chart.resize(el.clientWidth, el.clientHeight);
  };

  // ---------- INIT ----------
  useEffect(() => {
    const holder = chartRootRef.current;
    if (!holder) return;

    holder.style.position = "relative";
    holder.style.zIndex = "1";

    const chart = createChart(holder, {
      ...baseChartOptions,
      width: holder.clientWidth,
      height,
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries();
    seriesRef.current = candleSeries;

    const ro = new ResizeObserver(() => safeResize());
    ro.observe(holder);
    roRef.current = ro;

    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDpr = () => safeResize();
    if (mq.addEventListener) {
      mq.addEventListener("change", onDpr);
      dprCleanupRef.current = () => mq.removeEventListener("change", onDpr);
    } else if (mq.addListener) {
      mq.addListener(onDpr);
      dprCleanupRef.current = () => mq.removeListener(onDpr);
    }

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
        ref={chartRootRef}               {/* <-- the ref must be a real variable */}
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
