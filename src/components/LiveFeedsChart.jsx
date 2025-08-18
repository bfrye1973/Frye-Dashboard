import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import MoneyFlowOverlay from "./overlays/MoneyFlowOverlay";

export default function LiveFeedsChart({ candles = [], height = 480 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // build chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
      height,
      layout: { background: { type: "Solid", color: "#0f0f0f" }, textColor: "#d8dee9" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: true },
    });

    const series = chart.addCandlestickSeries();
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({ width: containerRef.current.clientWidth || 800, height });
      } catch {}
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // feed candles into LWC
  useEffect(() => {
    if (!seriesRef.current) return;
    if (!candles?.length) {
      seriesRef.current.setData([]);
      return;
    }
    seriesRef.current.setData(candles);
    try { chartRef.current.timeScale().fitContent(); } catch {}
  }, [candles]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        minHeight: height,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #1b2130",
        background: "#0f0f0f",
      }}
    >
      <MoneyFlowOverlay chartContainer={containerRef.current} candles={candles} />
    </div>
  );
}
