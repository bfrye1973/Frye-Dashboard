// src/pages/rows/RowChart/useLwcChart.js
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/**
 * Stable baseline:
 * - Mounts LWC into the host div
 * - Sizes from the parent (prevents tiny-start)
 * - Observes ONLY the parent (no feedback loops)
 * - Locks timezone to America/Phoenix
 * Returns { containerRef, chart, setData }.
 */
export default function useLwcChart({ theme }) {
  const containerRef = useRef(null);   // div.tv-lightweight-charts
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);
  const [chart, setChart] = useState(null);

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

    const parent = host.parentElement || host;
    const width = host.clientWidth || parent.clientWidth || 600;
    const height = host.clientHeight || parent.clientHeight || 400;

    const chartInstance = createChart(host, {
      width,
      height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: theme.timeScale,
      crosshair: theme.crosshair,
      localization: {
        timezone: "America/Phoenix",
        dateFormat: "yyyy-MM-dd",
        timeFormatter: phoenixFormatter,
      },
    });

    const candleSeries = chartInstance.addCandlestickSeries({
      upColor: theme.upColor,
      downColor: theme.downColor,
      borderUpColor: theme.borderUpColor,
      borderDownColor: theme.borderDownColor,
      wickUpColor: theme.wickUpColor,
      wickDownColor: theme.wickDownColor,
    });

    chartRef.current = chartInstance;
    seriesRef.current = candleSeries;
    setChart(chartInstance);

    const ro = new ResizeObserver(() => {
      const h = containerRef.current;
      if (!h || !chartRef.current) return;
      const p = h.parentElement || h;
      chartRef.current.applyOptions({
        width: h.clientWidth || p.clientWidth || 600,
        height: h.clientHeight || p.clientHeight || 400,
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
      try { chartRef.current.timeScale().fitContent(); } catch {}
    }
  };

  return { containerRef, chart, setData };
}
