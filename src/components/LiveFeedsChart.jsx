// src/components/LiveFeedsChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import RightProfileOverlay from "./overlays/RightProfileOverlay";

export default function LiveFeedsChart({
  ticker,
  tf = "minute",
  from,
  to,
  height = 480,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const stopRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
      height,
      layout: { background: { type: "Solid", color: "#0f0f0f" }, textColor: "#d8dee9" },
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

    // Keep chart responsive
    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({ width: containerRef.current.clientWidth || 800, height });
      } catch {}
    });
    ro.observe(containerRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
      try { stopRef.current && stopRef.current(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // create once

  // (Optional) you can continue to load data & WS elsewhere as you already do
  // This component only needs to expose the container for the overlay.

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",      // IMPORTANT for overlay to stack on top
        width: "100%",
        minHeight: height,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #1b2130",
        background: "#0f0f0f",
      }}
    >
      {/* Overlay gets the DOM node of the chart container */}
      <RightProfileOverlay chartContainer={containerRef.current} />
    </div>
  );
}
