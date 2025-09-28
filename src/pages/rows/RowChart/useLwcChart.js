// src/pages/rows/RowChart/useLwcChart.js
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/**
 * useLwcChart
 * Mounts a Lightweight Charts instance that flexes to fill its parent.
 * - Sizes strictly from the PARENT (prevents resize feedback loops)
 * - Guarantees time-axis space (minimumHeight) and AZ timezone
 * - Version-safe timeFormatter (accepts seconds or { timestamp })
 * - Returns { containerRef, chart, setData }
 */

export default function useLwcChart({ theme }) {
  const containerRef = useRef(null);   // attach to <div class="tv-lightweight-charts" />
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);

  const [chart, setChart] = useState(null);

  // Keep a few px for axis math when computing height
  const AXIS_GUARD = 6;
  // The real axis strip is enforced by "minimumHeight" below (20–24px works well)

  // Phoenix formatter that works across lib versions (seconds or {timestamp})
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
    const host = containerRef.current;
    if (!host) return;

    // Size from the PARENT (this is what prevents feedback loops)
    const parent = host.parentElement || host;
    const startWidth = host.clientWidth || parent.clientWidth || 600;
    const startHeight = Math.max(
      200,
      (parent.clientHeight || host.clientHeight || 400) - AXIS_GUARD
    );

    // Create chart
    const chartInstance = createChart(host, {
      width: startWidth,
      height: startHeight,
      layout: theme?.layout || {},
      grid: theme?.grid || {},
      rightPriceScale: {
        ...(theme?.rightPriceScale || {}),
      },
      timeScale: {
        ...(theme?.timeScale || {}),
        // visible/space will be enforced below as well
      },
      crosshair: theme?.crosshair || {},
      localization: {
        ...(theme?.localization || {}),
        timezone: "America/Phoenix",
        dateFormat: "yyyy-MM-dd",
        timeFormatter: phoenixFormatter,
      },
    });

    // Make sure the bottom time-axis always has space and is visible
    chartInstance.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
      minimumHeight: 22, // <- guarantees a bottom strip for labels
    });

    // Price series
    const candleSeries = chartInstance.addCandlestickSeries({
      upColor: theme?.upColor || "#16a34a",
      downColor: theme?.downColor || "#ef4444",
      borderUpColor: theme?.borderUpColor || "#16a34a",
      borderDownColor: theme?.borderDownColor || "#ef4444",
      wickUpColor: theme?.wickUpColor || "#16a34a",
      wickDownColor: theme?.wickDownColor || "#ef4444",
    });

    chartRef.current = chartInstance;
    seriesRef.current = candleSeries;
    setChart(chartInstance);

    // Parent-only ResizeObserver
    const ro = new ResizeObserver(() => {
      const h = containerRef.current;
      const p = h?.parentElement || h;
      if (!h || !p || !chartRef.current) return;

      const nextW = h.clientWidth || p.clientWidth || 600;
      const nextH = Math.max(
        200,
        (p.clientHeight || h.clientHeight || 400) - AXIS_GUARD
      );

      chartRef.current.applyOptions({ width: nextW, height: nextH });
      // keep axis options re-applied in case other code touched them
      chartRef.current.timeScale().applyOptions({
        visible: true,
        timeVisible: true,
        borderVisible: true,
        minimumHeight: 22,
      });
    });
    ro.observe(parent);
    roRef.current = ro;

    // Cleanup
    return () => {
      try { roRef.current?.disconnect(); } catch {}
      roRef.current = null;
      try { chartInstance.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      setChart(null);
    };
  }, [theme]);

  // Public setter for historical bars
  const setData = (bars) => {
    if (!seriesRef.current) return;
    const array = Array.isArray(bars) ? bars : [];
    seriesRef.current.setData(array);
    if (chartRef.current && array.length > 0) {
      // Fit to data and ensure axis remains visible
      chartRef.current.timeScale().fitContent();
      chartRef.current.timeScale().applyOptions({
        visible: true,
        timeVisible: true,
        borderVisible: true,
        minimumHeight: 22,
      });
    }
  };

  return { containerRef, chart, setData };
}
