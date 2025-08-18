// src/pages/LiveFeeds.jsx
import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function LiveFeeds() {
  const chartContainerRef = useRef();

  useEffect(() => {
    // Clear container first (to avoid stacking charts)
    chartContainerRef.current.innerHTML = "";

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: "#0d1117" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#1e222d" },
        horzLines: { color: "#1e222d" },
      },
      timeScale: { borderColor: "#485c7b" },
      rightPriceScale: { borderColor: "#485c7b" },
      crosshair: { mode: 1 },
    });

    // Add candlesticks
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // Fake demo data (replace with your API later)
    fetch("https://demo-live-data.highcharts.com/aapl-c.json")
      .then(r => r.json())
      .then(data => {
        const formatted = data.map(d => ({
          time: d[0] / 1000,
          open: d[1],
          high: d[2],
          low: d[3],
          close: d[4],
        }));
        candleSeries.setData(formatted);
      });

    // Resize handling
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ color: "#fff" }}>Live Chart (LW only)</h2>
      <div ref={chartContainerRef} style={{ width: "100%", height: "600px" }} />
    </div>
  );
}
