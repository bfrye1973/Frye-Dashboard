// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { fetchHistory } from "../lib/api";

export default function LiveLWChart({
  symbol = "AAPL",
  timeframe = "1m",
  height = 560,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volRef = useRef(null);

  // fallback data generator
  function makeSynthetic(count = 200, tf = "1m") {
    const step =
      tf === "1m" ? 60_000 :
      tf === "5m" ? 300_000 :
      tf === "15m" ? 900_000 :
      tf === "30m" ? 1_800_000 :
      tf === "1h" ? 3_600_000 : 86_400_000;
    const now = Date.now();
    const out = [];
    let p = 110;
    for (let i = count; i > 0; i--) {
      const t = now - i * step;
      const drift = Math.sin(i / 20) * 0.6;
      const open = p;
      const close = p + drift + (Math.random() - 0.5) * 0.4;
      const high = Math.max(open, close) + Math.random() * 0.8;
      const low = Math.min(open, close) - Math.random() * 0.8;
      const volume = Math.floor(30_000 + Math.random() * 170_000);
      p = close;
      out.push({ time: t, open, high, low, close, volume });
    }
    return out;
  }

  // load data from backend
  async function loadData(sym, tf) {
    try {
      const rows = await fetchHistory(sym, tf);
      if (!Array.isArray(rows) || rows.length === 0) {
        return makeSynthetic(200, tf);
      }
      return rows;
    } catch {
      return makeSynthetic(200, tf);
    }
  }

  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 1200,
      height,
      layout: { background: { type: "Solid", color: "#0f1117" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: false },
      timeScale: { borderVisible: false, timeVisible: timeframe !== "1d", secondsVisible: timeframe === "1m" },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { priceFormatter: (p) => (p ?? 0).toFixed(2) },
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#26a69a", downColor: "#ef5350",
      borderUpColor: "#26a69a", borderDownColor: "#ef5350",
      wickUpColor: "#26a69a", wickDownColor: "#ef5350",
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" }, priceScaleId: "", overlay: true, base: 0,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;

    // initial + updates
    let alive = true;
    (async () => {
      const bars = await loadData(symbol, timeframe);
      if (!alive) return;

      const cData = bars.map(b => ({
        time: Math.round(b.time / 1000), // seconds
        open: b.open, high: b.high, low: b.low, close: b.close,
      }));

      const vData = bars.map(b => ({
        time: Math.round(b.time / 1000),
        value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(38,166,154,0.45)" : "rgba(239,83,80,0.45)",
      }));

      candles.setData(cData);
      volume.setData(vData);
      chart.timeScale().fitContent();
    })();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: wrapRef.current?.clientWidth || 1200, height });
    });
    ro.observe(wrapRef.current);

    return () => {
      alive = false;
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, [symbol, timeframe, height]);

  return (
    <div
      ref={wrapRef}
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
