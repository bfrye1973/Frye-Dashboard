// src/components/LiveLWChart/LiveLWChart.jsx
// Lightweight Charts wrapper — isolated & safe (no page overlay)

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
  const containerRef = useRef(null);      // outer panel
  const chartRootRef = useRef(null);      // inner chart root
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const seriesMap = useRef(new Map());
  const roRef = useRef(null);
  const dprListenerRef = useRef(null);

  const [candles, setCandles] = useState([]);

  // -------- helpers --------
  const safeResize = () => {
    const el = chartRootRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    // keep height fixed; width from parent
    chart.resize(el.clientWidth, el.clientHeight);
  };

  // ---------- INIT ----------
  useEffect(() => {
    const holder = chartRootRef.current;
    if (!holder) return;

    // Ensure the holder is sized and creates a stacking context
    // (prevents canvas overlaying other sections)
    holder.style.position = "relative";
    holder.style.zIndex = "1";

    const chart = createChart(holder, {
      ...baseChartOptions,
      width: holder.clientWidth,
      height: height,
      // Any chart-level options that help with crispness:
      // Right/left price scale can remain as configured in baseChartOptions
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries();
    seriesRef.current = candleSeries;

    // ResizeObserver is more reliable than window resize for grid layouts
    const ro = new ResizeObserver(() => safeResize());
    ro.observe(holder);
    roRef.current = ro;

    // React to devicePixelRatio changes (zooms/OS scaling)
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDpr = () => {
      // Recreate the chart size on DPR change for crisp rendering
      safeResize();
    };
    // Some browsers don’t fire .addEventListener on this MediaQueryList
    if (mq.addEventListener) {
      mq.addEventListener("change", onDpr);
      dprListenerRef.current = () => mq.removeEventListener("change", onDpr);
    } else if (mq.addListener) {
      mq.addListener(onDpr);
      dprListenerRef.current = () => mq.removeListener(onDpr);
    }

    // Initial size sync
    safeResize();

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { dprListenerRef.current?.(); } catch {}
      try { seriesMap.current.clear(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // ---------- LOAD DATA ----------
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const feed = getFeed(symbol, timeframe);
    let disposed = false;

    (async () => {
      try {
        const seed = await feed.history();   // expect array of bars
        if (disposed) return;
        if (Array.isArray(seed) && seed.length) {
          series.setData(seed);
          setCandles(seed);
          // console.log(`[LiveLWChart] history loaded: ${seed.length} bars`);
        } else {
          // No seed? clear to avoid stale canvas
          series.setData([]);
          setCandles([]);
          // console.warn("[LiveLWChart] history returned empty array");
        }
      } catch (e) {
        console.error("[LiveLWChart] history failed:", e);
        series.setData([]);
        setCandles([]);
      }
    })();

    // Live updates
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

  // ---------- Indicators (optional; kept for future wiring) ----------
  useEffect(() => {
    if (!chartRef.current) return;
    // Example: resolveIndicators(chartRef.current, enabledIndicators, indicatorSettings);
  }, [enabledIndicators, indicatorSettings]);

  // ---------- RENDER ----------
  return (
    <section
      id="chart-section"
      className="panel chart-card"
      ref={containerRef}
      /* The panel & chart-card classes help ensure no overlay leak */
      style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        minHeight: height,
        border: "1px solid #1f2a44",
        borderRadius: 8,
        background: "#0b0b14",
        overflow: "hidden",  // critical: confine canvases
        marginTop: 12,
      }}
    >
      <div
        ref={chartRootRef}
        className="chart-root"
        style={{
          position: "relative", // stacking context so canvases are scoped
          width: "100%",
          height: height,
          // Prevent any stray children (like overlays) from capturing the page
          // pointerEvents stays default so you can interact with chart
        }}
      />
    </section>
  );
}

// ---------- HELPERS ----------
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
