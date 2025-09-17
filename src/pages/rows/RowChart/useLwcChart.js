// src/pages/rows/RowChart/useLwcChart.js
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/**
 * Mounts a lightweight-charts instance that flexes to fill its parent.
 * - Sizes from the parent (prevents tiny-start issues)
 * - Observes ONLY the parent (prevents resize feedback loops)
 * - Forces time axis visible with room for labels
 * Returns { containerRef, chart, setData }.
 */
export default function useLwcChart({ theme }) {
  const containerRef = useRef(null);      // div.tv-lightweight-charts
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);
  const [chart, setChart] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Use the parent for reliable height on first paint
    const parent = el.parentElement || el;
    const width  = el.clientWidth || parent.clientWidth || 600;
    const height = parent.clientHeight || el.clientHeight || 400;

    const chartInstance = createChart(el, {
      width,
      height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: theme.timeScale,     // base options
      crosshair: theme.crosshair,
      localization: { dateFormat: "yyyy-MM-dd" },
    });

    // Ensure the time axis is visible and has room in tight containers
    chartInstance.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
      minimumHeight: 20,              // guard space for labels
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

    // Resize: observe ONLY the parent to avoid feedback loops
    const ro = new ResizeObserver(() => {
      const host = containerRef.current;
      if (!host || !chartRef.current) return;
      const p = host.parentElement || host;
      chartRef.current.applyOptions({
        width:  host.clientWidth || p.clientWidth || 600,
        height: p.clientHeight   || host.clientHeight || 400,
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
