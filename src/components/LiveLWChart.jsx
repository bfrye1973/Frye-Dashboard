// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

export default function LiveLWChart({
  symbol = "AAPL",
  timeframe = "1m",
  height = 540,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volRef = useRef(null);

  // ---- fake data adapter (replace with your real API if you have it)
  async function fetchHistory(sym, tf) {
    // Example: return last ~500 synthetic candles so you see something
    const now = Math.floor(Date.now() / 1000);
    const N = 500, step = tf === "1m" ? 60 : tf === "1h" ? 3600 : 86400;
    const data = [];
    let p = 110;
    for (let i = N; i > 0; i--) {
      const t = now - i * step;
      const drift = Math.sin(i / 20) * 0.5;
      const open = p;
      const close = p + drift + (Math.random() - 0.5) * 0.3;
      const high = Math.max(open, close) + Math.random() * 0.6;
      const low = Math.min(open, close) - Math.random() * 0.6;
      const volume = Math.floor(30000 + Math.random() * 180000);
      p = close;
      data.push({ time: t, open, high, low, close, volume });
    }
    return data;
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 1200,
      height,
      layout: { background: { type: "Solid", color: "#0f1117" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: timeframe !== "1d",
        secondsVisible: timeframe === "1m",
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { priceFormatter: p => p.toFixed(2) },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      overlay: true,
      color: "rgba(110, 118, 129, 0.4)",
      base: 0,
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volRef.current = volumeSeries;

    // Responsive
    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({
          width: containerRef.current?.clientWidth || 1200,
          height,
        });
      } catch {}
    });
    ro.observe(containerRef.current);

    // Load initial data
    let mounted = true;
    (async () => {
      const candles = await fetchHistory(symbol, timeframe);
      if (!mounted) return;
      candleSeries.setData(
        candles.map(c => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
      volumeSeries.setData(
        candles.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? "rgba(38,166,154,0.4)" : "rgba(239,83,80,0.4)",
        }))
      );
      chart.timeScale().fitContent();
    })();

    return () => {
      mounted = false;
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, [symbol, timeframe, height]);

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
        background: "#0f1117",
      }}
      aria-label="Lightweight Charts price chart"
    />
  );
}
