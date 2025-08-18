// src/components/LiveFeedsChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import RightProfileOverlay from "./overlays/RightProfileOverlay";
import MoneyFlowOverlay from "./overlays/MoneyFlowOverlay";

export default function LiveFeedsChart({
  ticker,
  tf = "minute",
  height = 420,
  candles = [],           // <-- history + live bars from parent
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // build chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 960,
      height,
      layout: { background: { type: "Solid", color: "#0f0f0f" }, textColor: "#e6edf7" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: { timeVisible: tf !== "day", secondsVisible: tf === "minute" },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
    });
    const series = chart.addCandlestickSeries();

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({ width: containerRef.current.clientWidth || 960, height });
      } catch {}
    });
    ro.observe(containerRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // create once

  // push incoming candles to the chart
  useEffect(() => {
    if (!seriesRef.current) return;
    if (!Array.isArray(candles) || candles.length === 0) {
      seriesRef.current.setData([]);
      return;
    }
    // full set (history or re-render)
    seriesRef.current.setData(candles);
    try { chartRef.current.timeScale().fitContent(); } catch {}
  }, [candles]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",          // overlays stack on top
        width: "100%",
        minHeight: height,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #1b2130",
        background: "#0f0f0f",
      }}
    >
      {/* Overlays */}
      <RightProfileOverlay chartContainer={containerRef.current} candles={candles} />
      <MoneyFlowOverlay chartContainer={containerRef.current} candles={candles} />
    </div>
  );
}
