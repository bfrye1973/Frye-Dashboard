// src/pages/rows/RowChart/useLwcChart.js
import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

export default function useLwcChart({ height = 520, theme }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const resizeObs = useRef(null);
  const [chart, setChart] = useState(null); // 👈 stateful chart

  useEffect(() => {
    if (!containerRef.current) return;

    const chartInstance = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: { borderColor: theme.timeScale.borderColor, rightOffset: 6, barSpacing: 8, fixLeftEdge: true },
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
    setChart(chartInstance); // 👈 trigger consumer render

    // keep responsive
    resizeObs.current = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    resizeObs.current.observe(containerRef.current);

    return () => {
      try { resizeObs.current && resizeObs.current.disconnect(); } catch {}
      try { chartInstance.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      setChart(null);
    };
  }, [height, theme]);

  const setData = (bars) => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(bars || []);
    if (chartRef.current && bars && bars.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  };

  return { containerRef, chart, setData }; // 👈 chart is a state value now
}
