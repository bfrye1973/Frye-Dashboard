// src/components/LiveLWChart/LiveLWChart.jsx
// Lightweight Charts wrapper (isolated chart section)

import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { resolveIndicators } from "../../indicators";
import { getFeed } from "../../services/feed";

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  enabledIndicators = [],
  indicatorSettings = {},
  height = 520,
}) {
  const wrapperRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const seriesMap = useRef(new Map());
  const [candles, setCandles] = useState([]);

  // ---------- INIT ----------
  useEffect(() => {
    if (!wrapperRef.current) return;

    const chart = createChart(wrapperRef.current, {
      ...baseChartOptions,
      height,
      width: wrapperRef.current.clientWidth,
    });

    chartRef.current = chart;
    const candleSeries = chart.addCandlestickSeries();
    seriesRef.current = candleSeries;

    const handleResize = () => {
      if (wrapperRef.current && chartRef.current) {
        chartRef.current.resize(wrapperRef.current.clientWidth, height);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [height]);

  // ---------- LOAD DATA ----------
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    const feed = getFeed(symbol, timeframe);
    let disposed = false;

    (async () => {
      try {
        const seed = await feed.history();
        if (disposed || !Array.isArray(seed)) return;
        setCandles(seed);
        seriesRef.current.setData(seed);
      } catch (e) {
        console.error("[chart] history failed:", e);
      }
    })();

    const unsub = feed.subscribe((bar) => {
      if (disposed || !bar || bar.time == null) return;
      setCandles((prev) => {
        const next = mergeBar(prev, bar);
        seriesRef.current.update(bar);
        return next;
      });
    });

    return () => {
      disposed = true;
      unsub?.();
      feed.close?.();
    };
  }, [symbol, timeframe]);

  // ---------- RENDER ----------
  return (
    <section
      id="chart-section"
      style={{
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
        ref={wrapperRef}
        style={{
          width: "100%",
          height: height,
        }}
      />
    </section>
  );
}

// ---------- HELPERS ----------
function mergeBar(prev, bar) {
  if (!prev?.length) return [bar];
  const last = prev[prev.length - 1];
  if (last.time === bar.time) {
    const next = prev.slice(0, -1);
    next.push(bar);
    return next;
  }
  return [...prev, bar];
}
