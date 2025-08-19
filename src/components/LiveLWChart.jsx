import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { fetchHistory } from "../lib/api"; // uses your Phase 0 endpoint

/**
 * Minimal candles-only chart.
 * Props:
 *  - symbol: "AAPL" | "MSFT" | ...
 *  - timeframe: "1m" | "5m" | "15m" | "1h" | "1d"
 *  - height: number (px)
 */
export default function LiveLWChart({
  symbol = "AAPL",
  timeframe = "1m",
  height = 560,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);

  // Create chart once (recreate if height/timeframe affects time visibility)
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

    chartRef.current = chart;
    candleSeriesRef.current = candles;

    // responsive
    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: wrapRef.current?.clientWidth || 1200,
        height,
      });
    });
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [height, timeframe]);

  // Load data whenever symbol/timeframe changes
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const rows = await fetchHistory(
          String(symbol).toUpperCase(),
          String(timeframe).toLowerCase()
        );

        if (!alive || !Array.isArray(rows) || rows.length === 0) return;

        // Lightweight Charts expects time in **seconds**
        const data = rows.map((b) => ({
          time: Math.round(b.time / 1000),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }));

        candleSeriesRef.current?.setData(data);
        chartRef.current?.timeScale().fitContent();

        // tiny diagnostic so we know bars landed
        const t0 = new Date(rows[0].time).toISOString();
        const tN = new Date(rows[rows.length - 1].time).toISOString();
        console.log(`[candles] ${symbol} ${timeframe} bars=${rows.length} from=${t0} to=${tN}`);
      } catch (err) {
        console.error("fetchHistory failed:", err);
      }
    })();

    return () => {
      alive = false;
    };
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
      }}
      aria-label="Candlestick chart"
    />
  );
}
