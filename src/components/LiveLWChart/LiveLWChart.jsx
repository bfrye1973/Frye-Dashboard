// src/components/LiveLWChart/LiveLWChart.jsx
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { resolveIndicators } from "../../indicators";

// NOTE: adjust this import to wherever your feed adapter lives.
// If you already have a feed util, point to it. Otherwise leave as-is and wire later.
import { getFeed } from "../../services/feed"; // <-- change if needed

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  height = 560,
  enabledIndicators = ["mfi", "cmf"],
  indicatorSettings = {}, // e.g. { mfi:{length:10}, cmf:{length:21} }
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const seriesMapRef = useRef(new Map());
  const [candles, setCandles] = useState([]);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, { ...baseChartOptions, height });
    chartRef.current = chart;

    const price = chart.addCandlestickSeries();
    priceSeriesRef.current = price;

    return () => {
      try { chart.remove(); } catch {}
      chartRef.current = null;
      priceSeriesRef.current = null;
      seriesMapRef.current.clear();
    };
  }, [height]);

  // Load + stream data
  useEffect(() => {
    if (!chartRef.current || !priceSeriesRef.current) return;

    const feed = getFeed?.(symbol, timeframe);
    let disposed = false;

    (async () => {
      if (!feed?.history) return;
      const seed = await feed.history();
      if (disposed) return;

      setCandles(seed);
      priceSeriesRef.current.setData(seed);
      // expose candles for indicator panes to read times
      chartRef.current._candles = seed;
    })();

    const unsubscribe = feed?.subscribe?.((bar) => {
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
      feed?.close?.();
    };
  }, [symbol, timeframe]);

  // Attach indicators whenever candles or list/settings change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;

    // clean old series (and run cleanups if stored)
    for (const [key, obj] of seriesMapRef.current) {
      if (key.endsWith("__cleanup") && typeof obj === "function") {
        try { obj(); } catch {}
      } else {
        try { chart.removeSeries(obj); } catch {}
      }
    }
    seriesMapRef.current.clear();

    const items = resolveIndicators(enabledIndicators, indicatorSettings);
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

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}

/**
 * Minimal merge for streaming bars.
 * If incoming bar time equals last candle time -> replace/update.
 * Otherwise push new bar.
 */
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
