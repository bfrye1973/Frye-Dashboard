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
  const candleSeriesRef = useRef(null);

  // create chart
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
      timeScale: {
        borderVisible: false,
        timeVisible: timeframe !== "1d",
        secondsVisible: timeframe === "1m",
      },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const candles = chart.addCandlestickSeries({
      priceScaleId: "right",
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
    });

    // simple overlay label to show current tf
    const label = document.createElement("div");
    label.style.position = "absolute";
    label.style.top = "8px";
    label.style.left = "10px";
    label.style.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    label.style.color = "#9aa4b2";
    label.style.pointerEvents = "none";
    label.textContent = `TF: ${timeframe}`;
    wrapRef.current.appendChild(label);

    chartRef.current = chart;
    candleSeriesRef.current = candles;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: wrapRef.current?.clientWidth || 1200,
        height,
      });
    });
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      if (label.parentNode) label.parentNode.removeChild(label);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [height, timeframe]);

  // load data when symbol or timeframe changes
  useEffect(() => {
    let alive = true;

    console.log(`[props] symbol=${symbol} timeframe=${timeframe}`);

    (async () => {
      try {
        const rows = await fetchHistory(
          String(symbol).toUpperCase(),
          String(timeframe).toLowerCase()
        );
        if (!alive || !Array.isArray(rows) || rows.length === 0) {
          console.warn("[candles] no rows");
          return;
        }

        const secs = rows.map(r => Math.round(r.time / 1000));
        const uniq = new Set(secs);
        console.log(
          `[candles] ${symbol} ${timeframe} bars=${rows.length} uniqueTimes=${uniq.size} ` +
          `from=${new Date(rows[0].time).toISOString()} to=${new Date(rows[rows.length-1].time).toISOString()}`
        );

        const data = rows.map((b, i) => ({
          time: secs[i],
          open: b.open, high: b.high, low: b.low, close: b.close,
        }));

        candleSeriesRef.current?.setData(data);
        chartRef.current?.timeScale().fitContent();
      } catch (err) {
        console.error("fetchHistory failed:", err);
      }
    })();

    return () => { alive = false; };
  }, [symbol, timeframe]);

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        minHeight: height,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #1b2130",
        background: "#0f1117",
        position: "relative",
      }}
      aria-label="Candlestick chart"
    />
  );
}
