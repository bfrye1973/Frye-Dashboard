// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode, LineStyle } from "lightweight-charts";
import { fetchHistory } from "../lib/api";

// ---- helpers ----
function ema(values, period) {
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(undefined);
  let emaPrev;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (emaPrev == null) {
      const slice = values.slice(Math.max(0, i - period + 1), i + 1).filter(x => x != null);
      if (slice.length < period) continue;
      emaPrev = slice.reduce((a, b) => a + b, 0) / slice.length;
    } else {
      emaPrev = v * k + emaPrev * (1 - k);
    }
    out[i] = emaPrev;
  }
  return out;
}

function mfi(bars, period = 14) {
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  const vol = bars.map(b => b.volume ?? 0);
  const out = new Array(bars.length).fill(undefined);
  let pos = 0, neg = 0;
  for (let i = 1; i < bars.length; i++) {
    const rmf = tp[i] * vol[i];
    const prev = tp[i - 1];
    if (tp[i] > prev) pos += rmf; else if (tp[i] < prev) neg += rmf;
    if (i >= period) {
      const j = i - period + 1;
      const k = j - 1;
      const rmfOut = tp[j] * vol[j];
      if (tp[j] > tp[k]) pos -= rmfOut;
      else if (tp[j] < tp[k]) neg -= rmfOut;
      const mr = neg === 0 ? 100 : pos / neg;
      out[i] = 100 - 100 / (1 + mr);
    }
  }
  return out;
}

// ---- synthetic fallback ----
function makeSynthetic(count = 300, tf = "1m") {
  const step = tf === "1m" ? 60_000 : tf === "1h" ? 3_600_000 : 86_400_000;
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

export default function LiveLWChart({ symbol = "AAPL", timeframe = "1m", height = 560 }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);
  const volRef = useRef(null);
  const mfiRef = useRef(null);

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
      leftPriceScale: { visible: true, borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: timeframe !== "1d", secondsVisible: timeframe === "1m" },
      crosshair: { mode: CrosshairMode.Normal },
    });

    // --- Price (right scale) ---
    const candles = chart.addCandlestickSeries({ priceScaleId: "right" });
    const ema10Line = chart.addLineSeries({ color: "#2dd4bf", lineWidth: 2, priceScaleId: "right" });
    const ema20Line = chart.addLineSeries({ color: "#fb923c", lineWidth: 2, priceScaleId: "right" });

    // --- Volume (own overlay scale) ---
    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" }, priceScaleId: "", overlay: true, base: 0,
    });

    // --- MFI (left scale, 0–100) ---
    const mfiSeries = chart.addLineSeries({ color: "#60a5fa", lineWidth: 2, priceScaleId: "left" });
    chart.priceScale("left").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 }, borderVisible: false });
    mfiSeries.createPriceLine({ price: 80, color: "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true });
    mfiSeries.createPriceLine({ price: 20, color: "#22c55e", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true });

    chartRef.current = chart;
    candleRef.current = candles;
    ema10Ref.current = ema10Line;
    ema20Ref.current = ema20Line;
    volRef.current = volume;
    mfiRef.current = mfiSeries;

    const ro = new ResizeObserver(() => chart.applyOptions({ width: wrapRef.current?.clientWidth || 1200, height }));
    ro.observe(wrapRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [height, timeframe]);

  useEffect(() => {
    let alive = true;
    (async () => {
      let bars = [];
      try { bars = await fetchHistory(symbol.toUpperCase(), timeframe.toLowerCase()); } catch {}
      if (!Array.isArray(bars) || bars.length === 0) bars = makeSynthetic(300, timeframe);
      if (!alive) return;

      const candleData = bars.map(b => ({ time: Math.round(b.time/1000), open:b.open, high:b.high, low:b.low, close:b.close }));
      const volData = bars.map(b => ({ time: Math.round(b.time/1000), value:b.volume ?? 0, color:b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)" }));

      const closes = bars.map(b => b.close ?? null);
      const ema10Data = ema(closes,10).map((v,i)=> v?{time:Math.round(bars[i].time/1000),value:v}:undefined).filter(Boolean);
      const ema20Data = ema(closes,20).map((v,i)=> v?{time:Math.round(bars[i].time/1000),value:v}:undefined).filter(Boolean);
      const mfiData = mfi(bars,14).map((v,i)=> v?{time:Math.round(bars[i].time/1000),value:v}:undefined).filter(Boolean);

      candleRef.current.setData(candleData);
      volRef.current?.setData(volData);
      ema10Ref.current?.setData(ema10Data);
      ema20Ref.current?.setData(ema20Data);
      mfiRef.current?.setData(mfiData);

      chartRef.current?.timeScale().fitContent();
    })();
    return () => { alive = false; };
  }, [symbol, timeframe]);

  return <div ref={wrapRef} style={{ width: "100%", minHeight: height, border: "1px solid #1b2130", borderRadius: 10 }}/>;
}
