// src/components/LiveFeedsChart.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import MoneyFlowOverlay from "./overlays/MoneyFlowOverlay";

/**
 * candles: array of { time: number (unix seconds), open, high, low, close, volume }
 * height: chart pixel height
 */
export default function LiveFeedsChart({ candles = [], height = 480 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volumeRef = useRef(null);

  // We use this state just to trigger overlay mount when the container is ready
  const [containerReady, setContainerReady] = useState(false);

  // Build the chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth || 800,
      height,
      layout: {
        background: { type: "Solid", color: "#0f1117" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
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

    // Overlayed volume histogram
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      overlay: true,
      base: 0,
      color: "rgba(120,130,140,0.35)",
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    // Responsive sizing
    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({
          width: el.clientWidth || 800,
          height,
        });
      } catch {}
    });
    ro.observe(el);

    // Mark container as ready so the overlay can mount
    setContainerReady(true);

    return () => {
      setContainerReady(false);
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [height]);

  // Push candle + volume data
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;

    if (!candles || candles.length === 0) {
      candleRef.current.setData([]);
      volumeRef.current.setData([]);
      return;
    }

    candleRef.current.setData(
      candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volumeRef.current.setData(
      candles.map(c => ({
        time: c.time,
        value: c.volume ?? 0,
        color: c.close >= c.open ? "rgba(38,166,154,0.35)" : "rgba(239,83,80,0.35)",
      }))
    );

    try {
      chartRef.current.timeScale().fitContent();
    } catch {}
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
        background: "#0f1117",
      }}
      aria-label="Lightweight Charts price chart"
    >
      {/* Mount the overlay only after the container ref exists */}
      {containerReady && (
        <MoneyFlowOverlay
          chartContainer={containerRef.current}
          candles={candles}
        />
      )}
    </div>
  );
}
