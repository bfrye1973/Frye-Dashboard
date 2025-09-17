// src/pages/rows/RowChart/useLwcChart.js
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/**
 * Mounts a lightweight-charts instance that flexes to fill its parent.
 * Returns { containerRef, chart, setData }.
 */
export default function useLwcChart({ theme }) {
  const containerRef = useRef(null);   // div.tv-lightweight-charts
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const resizeObsRef = useRef(null);
  const [chart, setChart] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Use the *parent* for height so we don’t start tiny
    const parent = el.parentElement || el;
    const width  = el.clientWidth || parent.clientWidth || 600;
    const height = parent.clientHeight || el.clientHeight || 400;

    const chartInstance = createChart(el, {
      width,
      height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: theme.timeScale,     // includes timeVisible
      crosshair: theme.crosshair,
      localization: { dateFormat: "yyyy-MM-dd" },
    });

    // Ensure the time axis is visible on dashboard too
    chartInstance.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
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
      if (!containerRef.current || !chartRef.current) return;
      const p = containerRef.current.parentElement || containerRef.current;
      chartRef.current.applyOptions({
        width:  containerRef.current.clientWidth || p.clientWidth || 600,
        height: p.clientHeight || containerRef.current.clientHeight || 400,
      });
    });
    ro.observe(parent);
    resizeObsRef.current = ro;

    return () => {
      try { resizeObsRef.current?.disconnect(); } catch {}
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
