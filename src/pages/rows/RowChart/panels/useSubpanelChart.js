// src/pages/rows/RowChart/panels/useSubpanelChart.js
import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function useSubpanelChart({ height = 120, theme }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const resizeObs = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: theme.layout,
      grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: {
        borderColor: theme.timeScale.borderColor,
        rightOffset: 6,
        barSpacing: 8,
        fixLeftEdge: true,
        // hide labels (main chart time scale is primary)
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: theme.crosshair,
      localization: { dateFormat: "yyyy-MM-dd" },
    });

    chartRef.current = chart;

    resizeObs.current = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    resizeObs.current.observe(containerRef.current);

    return () => {
      try { resizeObs.current && resizeObs.current.disconnect(); } catch {}
      chart.remove(); chartRef.current = null; seriesRef.current = null;
    };
  }, [height, theme]);

  // Consumer will create series they need and set data.
  return { containerRef, chart: chartRef.current };
}
