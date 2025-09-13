import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function useLwcChart({ height = 520, theme }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const resizeObs = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height, layout: theme.layout, grid: theme.grid,
      rightPriceScale: { borderColor: theme.rightPriceScale.borderColor },
      timeScale: { borderColor: theme.timeScale.borderColor, rightOffset: 6, barSpacing: 8, fixLeftEdge: true },
      crosshair: theme.crosshair, localization: { dateFormat: "yyyy-MM-dd" },
    });
    const series = chart.addCandlestickSeries({
      upColor: theme.upColor, downColor: theme.downColor,
      borderUpColor: theme.borderUpColor, borderDownColor: theme.borderDownColor,
      wickUpColor: theme.wickUpColor, wickDownColor: theme.wickDownColor,
    });
    chartRef.current = chart; seriesRef.current = series;

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

  const setData = (bars) => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(bars || []);
    if (chartRef.current && bars?.length) chartRef.current.timeScale().fitContent();
  };

  return { containerRef, chart: chartRef.current, series: seriesRef.current, timeScale: chartRef.current?.timeScale(), setData };
}
