// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

/**
 * Lightweight Charts wrapper with a simple OHLC fetcher and
 * graceful fallback to synthetic data if the API is unavailable.
 *
 * Expects your dev proxy to forward /api -> your backend, so calls like:
 *   /api/v1/ohlc?symbol=AAPL&timeframe=1m
 * hit your service.
 */
export default function LiveLWChart({
  symbol = "AAPL",
  timeframe = "1m", // "1m" | "1h" | "1d"
  height = 560,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candlesRef = useRef(null);
  const volumeRef = useRef(null);

  // --- utils ---------------------------------------------------------------

  // Normalize time: ISO string/Date -> seconds; pass numbers through
  const toSec = (t) =>
    typeof t === "string" || t instanceof Date
      ? Math.floor(new Date(t).getTime() / 1000)
      : t;

  // Synthetic candles so the chart always renders something
  function makeSynthetic(count = 500, tf = "1m") {
    const now = Math.floor(Date.now() / 1000);
    const step = tf === "1m" ? 60 : tf === "1h" ? 3600 : 86400;
    const out = [];
    let p = 110;

    for (let i = count; i > 0; i--) {
      const t = now - i * step;
      const drift = Math.sin(i / 20) * 0.6;
      const open = p;
      const close = p + drift + (Math.random() - 0.5) * 0.3;
      const high = Math.max(open, close) + Math.random() * 0.6;
      const low = Math.min(open, close) - Math.random() * 0.6;
      const volume = Math.floor(30_000 + Math.random() * 180_000);
      p = close;
      out.push({ time: t, open, high, low, close, volume });
    }
    return out;
  }

  async function fetchHistory(sym, tf) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort("timeout"), 15_000);

    try {
      const url = `/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(
        tf
      )}`;
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
    } catch {
      // Fallback if API is down / 404 / etc.
      return makeSynthetic(500, tf);
    } finally {
      clearTimeout(timer);
    }
  }

  // --- effect --------------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 1200,
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
      color: "rgba(110, 118, 129, 0.4)",
      base: 0,
    });

    chartRef.current = chart;
    candlesRef.current = candles;
    volumeRef.current = volume;

    // responsive sizing
    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({
          width: containerRef.current?.clientWidth || 1200,
          height,
        });
      } catch {}
    });
    ro.observe(containerRef.current);

    let alive = true;

    (async () => {
      try {
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
      } catch (e) {
        // Minimal inline banner so failures are visible in UI
        if (containerRef.current) {
          const node = document.createElement("div");
          node.style.cssText =
            "position:absolute;top:8px;left:8px;padding:6px 10px;border-radius:8px;background:#361b1b;color:#ffb4b4;border:1px solid #532222;font:12px/1.3 system-ui";
          node.textContent = `Chart error: ${e?.message ?? e}`;
          containerRef.current.appendChild(node);
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
      candlesRef.current = null;
      volumeRef.current = null;
    };
  }, [symbol, timeframe, height]);

  // --- render --------------------------------------------------------------

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
