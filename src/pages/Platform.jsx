// src/pages/Platform.jsx
import React, { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";

export default function Platform() {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1) Create the chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "#0b0b14" },
        textColor: "#e5e7eb",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1f2937" },
      timeScale: { borderColor: "#1f2937" },
    });

    chartRef.current = chart;

    // 2) Add a simple line series (sanity)
    const series = chart.addLineSeries({
      color: "#22d3ee",
      lineWidth: 2,
    });

    const now = Math.floor(Date.now() / 1000);
    const data = Array.from({ length: 20 }, (_, i) => ({
      time: now - (19 - i) * 60, // one point per minute
      value: 100 + Math.round(Math.random() * 20 - 10),
    }));
    series.setData(data);

    // 3) Keep it responsive
    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    // 4) Cleanup
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ color: "#86efac", marginBottom: 8 }}>Platform route reached ✅</div>
      <div ref={containerRef} style={{ width: "100%", height: 320 }} />
    </div>
  );
}
