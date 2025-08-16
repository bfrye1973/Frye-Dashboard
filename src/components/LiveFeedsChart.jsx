// src/components/LiveFeedsChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { fetchHistory } from "../lib/api.js";
import { openMarketSocket } from "../lib/ws.js";

export default function LiveFeedsChart({ ticker, tf = "minute", from, to, height = 480 }) {
  const containerRef = useRef(null);
  const seriesRef = useRef(null);
  const lastRef = useRef(null);
  const stopRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
      height,
      layout: { background: { type: "Solid", color: "#0f0f0f" }, textColor: "#d8d8d8" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" }
      },
      timeScale: { timeVisible: tf !== "day", secondsVisible: tf === "minute" },
      rightPriceScale: { borderVisible: false },
    });

    const candles = chart.addCandlestickSeries();
    seriesRef.current = candles;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    (async () => {
      const hist = await fetchHistory(ticker, tf, from, to);
      if (hist.length) {
        candles.setData(hist);
        lastRef.current = hist[hist.length - 1].time;
      }

      stopRef.current = openMarketSocket({
        onBar: (b) => {
          if (b.ticker !== ticker) return;
          const t = b.time;
          if (lastRef.current && t === lastRef.current) {
            candles.update(b);
          } else {
            candles.update(b);
            lastRef.current = t;
          }
        }
      });
    })().catch(console.error);

    return () => {
      ro.disconnect();
      try { stopRef.current && stopRef.current(); } catch {}
      try { chart.remove(); } catch {}
    };
  }, [ticker, tf, from, to, height]);

  return <div ref={containerRef} style={{ width: "100%", minHeight: height, position: "relative" }} />;
}
