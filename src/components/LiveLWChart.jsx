// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

/**
 * LiveLWChart
 * - Expects CRA proxy for /api (src/setupProxy.js already points to your backend)
 * - Calls: GET /api/v1/ohlc?symbol=SYMBOL&timeframe=TF
 *   → [{ time: 1717027200 | "2024-01-01T00:00:00Z", open, high, low, close, volume }]
 */
export default function LiveLWChart({
  symbol = "AAPL",
  timeframe = "1m", // use "1m", "1H", or "1D" (backend keys)
  height = 560,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volRef = useRef(null);

  // -------- helpers
  const toSec = (t) =>
    typeof t === "string" ? Math.floor(new Date(t).getTime() / 1000) : t;

  async function fetchHistory(sym, tf) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort("timeout"), 15000);

    try {
      const url = `/api/v1/ohlc?symbol=${encodeURIComponent(
        sym
      )}&timeframe=${encodeURIComponent(tf)}`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`OHLC ${res.status} ${res.statusText}`);
      const rows = await res.json();
      return rows.map((r) => ({
        time: toSec(r.time),
        open: +r.open,
        high: +r.high,
        low: +r.low,
        close: +r.close,
        volume: r.volume != null ? +r.volume : undefined,
      }));
    } finally {
      clearTimeout(id);
    }
  }

  // -------- main effect
  useEffect(() => {
    if (!wrapRef.current) return;

    // chart
    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 1200,
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
        timeVisible: timeframe !== "1D",
        secondsVisible: timeframe === "1m",
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { priceFormatter: (p) => (p ?? 0).toFixed(2) },
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      overlay: true,
      color: "rgba(110,118,129,0.45)",
      base: 0,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;

    // resize
    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: wrapRef.current?.clientWidth || 1200,
        height,
      });
    });
    ro.observe(wrapRef.current);

    // load data
    let alive = true;
    (async () => {
      try {
        const rows = await fetchHistory(symbol, timeframe);
        if (!alive) return;

        const candleData = rows.map((r) => ({
          time: r.time,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
        }));
        const volData = rows.map((r) => ({
          time: r.time,
          value: r.volume ?? 0,
          color:
            r.close >= r.open
              ? "rgba(38,166,154,0.45)"
              : "rgba(239,83,80,0.45)",
        }));

        candles.setData(candleData);
        volume.setData(volData);
        chart.timeScale().fitContent();
      } catch (e) {
        // simple inline error banner
        if (wrapRef.current) {
          const node = document.createElement("div");
          node.style.cssText =
            "position:absolute;top:8px;left:8px;padding:6px 10px;border-radius:8px;background:#361b1b;color:#ffb4b4;border:1px solid #532222;font:12px system-ui";
          node.textContent = `Chart error: ${e?.message ?? e}`;
          wrapRef.current.appendChild(node);
        }
        // eslint-disable-next-line no-console
        console.error(e);
      }
    })();

    return () => {
      alive = false;
      try {
        ro.disconnect();
      } catch {}
      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, [symbol, timeframe, height]);

  // -------- render
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
