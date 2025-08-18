// src/pages/LiveFeeds.jsx
import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

// Tiny helper: generate some demo candles so we always see data
function makeDemoCandles(count = 300, start = Math.round(Date.now() / 1000) - count * 60) {
  const data = [];
  let price = 100 + Math.random() * 2;
  for (let i = 0; i < count; i++) {
    const t = start + i * 60; // 1m bars
    const drift = Math.sin(i / 18) * 0.3 + (Math.random() - 0.5) * 0.4;
    const open = price;
    price = Math.max(1, price + drift);
    const high = Math.max(open, price) + Math.random() * 0.4;
    const low = Math.min(open, price) - Math.random() * 0.4;
    const close = price;
    data.push({ time: t, open, high, low, close });
  }
  return data;
}

export default function LiveFeeds() {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current) return;

    // Make sure the container is clean (in case of hot reloads)
    wrapRef.current.innerHTML = "";

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth,
      height: 640,
      layout: {
        background: { color: "#0d1117" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#1e222d" },
        horzLines: { color: "#1e222d" },
      },
      rightPriceScale: {
        borderColor: "#2b3a55",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#2b3a55",
        rightOffset: 6,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
      kineticScroll: { mouse: true, touch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, pinch: true, mouseWheel: true },
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      borderVisible: false,
    });

    // Demo data so we always see a chart (replace with your live feed later)
    const demo = makeDemoCandles(420);
    candles.setData(demo);

    // Last price line
    candles.applyOptions({
      lastPriceAnimation: 1,
    });
    const last = demo[demo.length - 1]?.close ?? 0;
    candles.createPriceLine({
      price: last,
      color: "#7aa2ff",
      lineWidth: 2,
      lineStyle: 0,
      axisLabelVisible: true,
      title: "Last",
    });

    // Keep references for cleanup/resize
    chartRef.current = chart;
    seriesRef.current = candles;

    const onResize = () => {
      if (!wrapRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: wrapRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    // Small watermark so you know this is LW-only
    const note = document.createElement("div");
    note.textContent = "LW session bands ON";
    Object.assign(note.style, {
      position: "absolute",
      top: "8px",
      left: "12px",
      color: "rgba(209,212,220,.35)",
      fontSize: "12px",
      fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial",
      pointerEvents: "none",
      userSelect: "none",
    });
    wrapRef.current.appendChild(note);

    return () => {
      window.removeEventListener("resize", onResize);
      try { chart.remove(); } catch {}
    };
  }, []);

  return (
    <div style={{ padding: "16px" }}>
      <h2 style={{ margin: "0 0 12px", color: "#fff" }}>Live Chart (LW only)</h2>
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          width: "100%",
          height: 640,
          border: "1px solid #1e2633",
          borderRadius: 10,
          overflow: "hidden",
        }}
      />
    </div>
  );
}
