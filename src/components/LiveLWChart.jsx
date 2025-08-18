// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

export default function LiveLWChart({
  symbol = "AAPL",
  timeframe = "1m",   // "1m" | "1H" | "1D"
  height = 560,
}) {
  const wrapRef = useRef(null);

  const toSec = (t) =>
    typeof t === "string" ? Math.floor(new Date(t).getTime() / 1000) : t;

  // fallback synthetic candles so you can keep building even if API 404s
  function makeSynthetic(count = 500, tf = "1m") {
    const now = Math.floor(Date.now() / 1000);
    const step = tf === "1m" ? 60 : tf === "1H" ? 3600 : 86400;
    const out = [];
    let p = 110;
    for (let i = count; i > 0; i--) {
      const t = now - i * step;
      const drift = Math.sin(i / 20) * 0.6;
      const open = p;
      const close = p + drift + (Math.random() - 0.5) * 0.6;
      const high = Math.max(open, close) + Math.random() * 1.0;
      const low = Math.min(open, close) - Math.random() * 1.0;
      const volume = Math.floor(30000 + Math.random() * 180000);
      p = close;
      out.push({ time: t, open, high, low, close, volume });
    }
    return out;
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

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: wrapRef.current?.clientWidth || 1200, height });
    });
    ro.observe(wrapRef.current);

    let alive = true;
    (async () => {
      const url = `/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`;
      let rows = null;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rows = await res.json();
        if (!Array.isArray(rows)) throw new Error("Bad JSON");
      } catch {
        rows = makeSynthetic(500, timeframe);
      }

      if (!alive) return;

      const cData = rows.map((r) => ({
        time: toSec(r.time),
        open: +r.open,
        high: +r.high,
        low: +r.low,
        close: +r.close,
      }));
      const vData = rows.map((r) => ({
        time: toSec(r.time),
        value: r.volume != null ? +r.volume : 0,
        color: (+r.close >= +r.open)
          ? "rgba(38,166,154,0.45)"
          : "rgba(239,83,80,0.45)",
      }));

      candles.setData(cData);
      volume.setData(vData);
      chart.timeScale().fitContent();
    })();

    return () => {
      alive = false;
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
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
