// src/components/LiveFeedsChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

// Overlays
import RightProfileOverlay from "./overlays/RightProfileOverlay";
import MoneyFlowOverlay from "./overlays/MoneyFlowOverlay";

/**
 * Lightweight Charts wrapper + overlay mount point.
 *
 * Props:
 * - ticker?: string (optional, only used for titles/logging)
 * - tf?: "minute" | "hour" | "day"  (default "minute")
 * - height?: number (default 480)
 * - candles?: Array<{time:number,open:number,high:number,low:number,close:number,volume:number}>
 *      If provided, the chart will render these. If empty, the chart renders with no data.
 */
export default function LiveFeedsChart({
  ticker = "",
  tf = "minute",
  height = 480,
  candles = [],
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // Build the chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
      height,
      layout: {
        background: { type: "Solid", color: "#0f0f0f" },
        textColor: "#d8dee9",
      },
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

    // Resize observer to keep it responsive
    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({
          width: containerRef.current?.clientWidth || 800,
          height,
        });
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

  // Push incoming candles to the chart
  useEffect(() => {
    if (!seriesRef.current) return;
    if (Array.isArray(candles) && candles.length) {
      try {
        seriesRef.current.setData(candles);
        chartRef.current?.timeScale().fitContent?.();
      } catch {}
    } else {
      try {
        seriesRef.current.setData([]);
      } catch {}
    }
  }, [candles]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",        // IMPORTANT: lets overlays sit on top
        width: "100%",
        minHeight: height,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #1b2130",
        background: "#0f0f0f",
      }}
      title={ticker ? `${ticker} • ${tf}` : undefined}
    >
      {/* Overlays receive the actual chart DOM container.
          They can also receive candles if they need them. */}
      <RightProfileOverlay chartContainer={containerRef.current} candles={candles} />
      <MoneyFlowOverlay  chartContainer={containerRef.current} candles={candles} />
    </div>
  );
}
