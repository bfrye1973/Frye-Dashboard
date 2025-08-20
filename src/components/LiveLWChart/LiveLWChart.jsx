// src/components/LiveLWChart/LiveLWChart.jsx
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { resolveIndicators } from "../../indicators";
import { getFeed } from "../../services/feed";

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  height = 560,
  enabledIndicators = [],
  indicatorSettings = {},
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const seriesMapRef = useRef(new Map());
  const [candles, setCandles] = useState([]);

  // Create chart + main price series
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, { ...baseChartOptions, height });
    chartRef.current = chart;

    const price = chart.addCandlestickSeries();
    priceSeriesRef.current = price;

    // ✅ expose internals for overlays (Money Flow Profile, etc.)
    chartRef.current._container = containerRef.current;
    chartRef.current._priceSeries = priceSeriesRef.current;

    return () => {
      try { chart.remove(); } catch {}
      chartRef.current = null;
      priceSeriesRef.current = null;
      seriesMapRef.current.clear();
    };
  }, [height]);

  // Load history + subscribe to updates
  useEffect(() => {
    if (!chartRef.current || !priceSeriesRef.current) return;

    const feed = getFeed(symbol, timeframe);
    let disposed = false;

    (async () => {
      const seed = await feed.history();
      if (disposed) return;
      setCandles(seed);
      priceSeriesRef.current.setData(seed);
      chartRef.current._candles = seed; // expose for overlays that need times
    })();

    const unsubscribe = feed.subscribe((bar) => {
      if (disposed) return;
      setCandles((prev) => {
        const next = mergeBar(prev, bar);
        priceSeriesRef.current.update(bar);
        chartRef.current._candles = next;
        return next;
      });
    });

    return () => {
      disposed = true;
      unsubscribe?.();
      feed.close?.();
    };
  }, [symbol, timeframe]);

  // Attach indicators (overlays + panes)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;

    // cleanup previous
    for (const [key, obj] of seriesMapRef.current) {
      if (key.endsWith("__cleanup") && typeof obj === "function") {
        try { obj(); } catch {}
      } else {
        try { chart.removeSeries(obj); } catch {}
      }
    }
    seriesMapRef.current.clear();

    // resolve requested indicators with settings
    const items = resolveIndicators(enabledIndicators, indicatorSettings);

    // compute + attach
    items.forEach(({ def, inputs }) => {
      const result = def.compute(candles, inputs);
      const cleanup = def.attach(chart, seriesMapRef.current, result, inputs);
      seriesMapRef.current.set(`${def.id}__cleanup`, cleanup);
    });

    return () => {
      for (const [key, fn] of seriesMapRef.current) {
        if (key.endsWith("__cleanup") && typeof fn === "function") {
          try { fn(); } catch {}
        }
      }
      seriesMapRef.current.clear();
    };
  }, [candles, enabledIndicators, indicatorSettings]);

  return <div ref={containerRef} className="w-full" style={{ height, position: "relative" }} />;
}

// Replace last bar if same time; otherwise append
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
