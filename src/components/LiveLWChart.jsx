// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

/**
 * Lightweight Charts component
 * - Props:
 *   - symbol: string (e.g., "AAPL")
 *   - timeframe: "1m" | "1h" | "1d"
 *   - height: number (default 560)
 *
 * Expects backend endpoint via proxy:
 *   GET /api/v1/ohlc?symbol=SYMBOL&timeframe=1m|1h|1d
 * Returns array of rows with:
 *   { time: unixSeconds, open, high, low, close, volume }
 */
export default function LiveLWChart({
  symbol = "AAPL",
  timeframe = "1m",
  height = 560,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volRef = useRef(null);

  // --- helpers
  const toSec = (t) =>
    typeof t === "string" ? Math.floor(new Date(t).getTime() / 1000) : t;

  // Fallback synthetic candles so UI still renders if API 404s
  function makeSynthetic(count = 500, tf = "1m") {
    const now = Math.floor(Date.now() / 1000);
    const step = tf === "1m" ? 60 : tf === "1h" ? 3600 : 86400;
    const out = [];
    let p = 110;
    for (let i = count; i > 0; i--) {
      const t = now - i * step;
      const drift = Math.sin(i / 20) * 0.6;
      const open = p;
      const close = p + drift + (Math.random() - 0.5) * 0.4;
      const high = Math.max(open, close) + Math.random() * 0.8;
      const low = Math.min(open, close) - Math.random() * 0.8;
      const volume = Math.floor(30000 + Math.random() * 170000);
      p = close;
      out.push({ time: t, open, high, low, close, volume });
    }
    return out;
  }

  async function fetchHistory(sym, tf) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 15000);
    try {
      const url = `/api/v1/ohlc?symbol=${encodeURIComponent(
        sym
      )}&timeframe=${encodeURIComponent(tf)}`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`OHLC ${res.status} ${res.statusText}`);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error("Bad JSON");
      return rows.map((r) => ({
        time: toSec(r.time),
        open: +r.open,
        high: +r.high,
        low: +r.low,
        close: +r.close,
        volume: r.volume != null ? +r.volume : undefined,
      }));
    } catch (e) {
      // fallback
      return makeSynthetic(500, tf);
    } finally {
      clearTimeout(id);
    }
  }

  useEffect(() => {
    if (!wrapRef.current) return;

    // create chart
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
        timeVisible: timeframe !== "1d",
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
      base: 0,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;

    // load data
    let alive = true;
    (async () => {
      const rows = await fetchHistory(symbol, timeframe);
      if (!alive) return;

      const cData = rows.map((r) => ({
        time: r.time,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
      }));

      const vData = rows.map((r) => ({
        time: r.time,
        value: r.volume ?? 0,
        color: r.close >= r.open ? "rgba(38,166,154,0.45)" : "rgba(239,83,80,0.45)",
      }));

      candles.setData(cData);
      volume.setData(vData);
      chart.timeScale().fitContent();
    })();

    // responsive
    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: wrapRef.current?.clientWidth || 1200,
        height,
      });
    });
    ro.observe(wrapRef.current);

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
