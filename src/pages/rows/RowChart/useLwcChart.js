// src/pages/rows/RowChart/useLwcChart.js
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/**
 * Mounts a lightweight-charts instance that flexes to fill its parent.
 * Returns { containerRef, chart, setData }.
 */
export default function useLwcChart({ theme }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const resizeObsRef = useRef(null);
  const [chart, setChart] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Use the *parent* height because the container may start tiny (e.g., 36px) before the chart mounts.
    const parent = el.parentElement || el;
    const width = el.clientWidth || parent.clientWidth || 600;
    const height = parent.clientHeight || el.clientHeight || 400;

    const chartInstance = createChart(el, {
      width,
      height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: theme.timeScale,
      crosshair: theme.crosshair,
      localization: { dateFormat: "yyyy-MM-dd" },
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

    // Keep width *and height* synced to the parent as Row 6 flexes.
    const ro = new ResizeObserver(() => {
      const elNow = containerRef.current;
      if (!elNow || !chartRef.current) return;
      const p = elNow.parentElement || elNow;
      chartRef.current.applyOptions({
        width: elNow.clientWidth || p.clientWidth || 600,
        height: p.clientHeight || elNow.clientHeight || 400,
      });
    });
    ro.observe(parent);
    ro.observe(el);
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
