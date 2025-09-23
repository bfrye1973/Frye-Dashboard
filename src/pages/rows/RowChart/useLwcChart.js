// src/pages/rows/RowChart/useLwcChart.js
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/**
 * Mounts a lightweight-charts instance that flexes to fill its parent.
 * - Sizes from the parent (prevents tiny-start issues)
 * - Observes ONLY the parent (avoids resize feedback loops)
 * - Keeps time axis visible with space for labels
 * - Locks timezone to America/Phoenix (Arizona), with a version-safe timeFormatter fallback
 * Returns { containerRef, chart, setData }.
 */
export default function useLwcChart({ theme }) {
  const containerRef = useRef(null);   // div.tv-lightweight-charts
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);
  const [chart, setChart] = useState(null);

  // give the bottom axis a few px without messing with CSS elsewhere
  const AXIS_GUARD = 6;

  // Phoenix time formatter that works across lib versions (number or {timestamp})
  const phoenixFormatter = (ts) => {
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const parent = el.parentElement || el;
    const width = el.clientWidth || parent.clientWidth || 600;
    const height = Math.max(
      200,
      (parent.clientHeight || el.clientHeight || 400) - AXIS_GUARD
    );

    const chartInstance = createChart(el, {
      width,
      height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: theme.timeScale, // keep your existing spacing/borders
      crosshair: theme.crosshair,
      localization: {
        timezone: "America/Phoenix",     // AZ time (no DST)
        dateFormat: "yyyy-MM-dd",
        timeFormatter: phoenixFormatter, // robust across versions
      },
    });

    // ensure the time axis is visible and has space for labels
    chartInstance.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
      minimumHeight: 20,
    });

    const candleSeries = chartInstance.addCandlestickSeries({
      upColor: theme.upColor,
      downColor: theme.downColor,
      borderUpColor: theme.borderUpColor,
      borderDownColor: theme.borderDownColor,
      wickUpColor: theme.wickUpColor,
      wickDownColor: theme.wickDownColor,
    });

    // re-assert axis options after series creation (wins over later touches)
    chartInstance.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
      minimumHeight: 20,
    });

    chartRef.current = chartInstance;
    seriesRef.current = candleSeries;
    setChart(chartInstance);

    // observe ONLY the parent for resizes (prevents chart <-> container feedback loops)
    const ro = new ResizeObserver(() => {
      const host = containerRef.current;
      if (!host || !chartRef.current) return;
      const p = host.parentElement || host;

      chartRef.current.applyOptions({
        width: host.clientWidth || p.clientWidth || 600,
        height: Math.max(
          200,
          (p.clientHeight || host.clientHeight || 400) - AXIS_GUARD
        ),
      });
    });
    ro.observe(parent);
    roRef.current = ro;

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { chartInstance.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      setChart(null);
    };
  }, [theme]);

  const setData = (bars) => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(bars || []);
    if (chartRef.current && bars && bars.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  };

  return { containerRef, chart, setData };
}
