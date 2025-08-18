// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode, LineStyle } from "lightweight-charts";
import { fetchHistory } from "../lib/api";

// ---------- math helpers ----------
function ema(values, period) {
  if (!Array.isArray(values) || !values.length) return [];
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(undefined);
  let emaPrev;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (emaPrev == null) {
      // seed with SMA of the first N values we have
      const start = Math.max(0, i - period + 1);
      const slice = values.slice(start, i + 1).filter((x) => x != null);
      if (slice.length < period) continue;
      emaPrev = slice.reduce((a, b) => a + b, 0) / slice.length;
      out[i] = emaPrev;
    } else {
      emaPrev = v * k + emaPrev * (1 - k);
      out[i] = emaPrev;
    }
  }
  return out;
}

// Money Flow Index (MFI-14 by default)
function mfi(bars, period = 14) {
  if (!Array.isArray(bars) || !bars.length) return [];
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
  const vol = bars.map((b) => b.volume ?? 0);
  const out = new Array(bars.length).fill(undefined);

  let pos = 0;
  let neg = 0;

  // Prime the first window
  for (let i = 1; i < bars.length; i++) {
    const rmf = tp[i] * vol[i];
    const prev = tp[i - 1];
    if (tp[i] > prev) pos += rmf;
    else if (tp[i] < prev) neg += rmf;

    if (i >= period) {
      // subtract the element falling out of the window
      const j = i - period + 1;     // start idx of the 14‑bar window
      const k = j - 1;              // comparison idx before window
      // remove rmf for j when compared to k
      const rmfOut = tp[j] * vol[j];
      if (tp[j] > tp[k]) pos -= rmfOut;
      else if (tp[j] < tp[k]) neg -= rmfOut;

      const mr = neg === 0 ? 100 : pos / neg;
      const value = 100 - 100 / (1 + mr);
      out[i] = value;
    }
  }
  return out;
}

// synthetic data so UI still shows something if API is empty
function makeSynthetic(count = 300, tf = "1m") {
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

export default function LiveLWChart({
  symbol = "AAPL",
  timeframe = "1m",
  height = 560,
}) {
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
    });

    // Price pane (top)
    const candles = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
    });

    const ema10Line = chart.addLineSeries({
      color: "#2dd4bf", // teal
      lineWidth: 2,
      priceLineVisible: false,
    });

    const ema20Line = chart.addLineSeries({
      color: "#fb923c", // orange
      lineWidth: 2,
      priceLineVisible: false,
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      overlay: true,
      base: 0,
    });

    // MFI pane (bottom) — separate scale with its own margins
    const mfiSeries = chart.addLineSeries({
      color: "#60a5fa",
      lineWidth: 2,
      priceScaleId: "mfi",
      priceLineVisible: false,
    });
    chart.priceScale("mfi").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0.03 },
      borderVisible: false,
    });

    // keep refs
    chartRef.current = chart;
    candleRef.current = candles;
    ema10Ref.current = ema10Line;
    ema20Ref.current = ema20Line;
    volRef.current = volume;
    mfiRef.current = mfiSeries;

    // resize
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
      candleRef.current = null;
      ema10Ref.current = null;
      ema20Ref.current = null;
      volRef.current = null;
      mfiRef.current = null;
    };
  }, [height, timeframe]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // 1) fetch bars from backend (or synth fallback)
      let bars = [];
      try {
        bars = await fetchHistory(String(symbol).toUpperCase(), String(timeframe).toLowerCase());
      } catch {}
      if (!Array.isArray(bars) || bars.length === 0) {
        bars = makeSynthetic(300, timeframe);
      }

      if (!alive || !candleRef.current) return;

      // 2) map to chart data (seconds for LW charts)
      const candleData = bars.map((b) => ({
        time: Math.round(b.time / 1000),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));

      const volData = bars.map((b) => ({
        time: Math.round(b.time / 1000),
        value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
      }));

      // 3) compute indicators
      const closes = bars.map((b) => b.close ?? null);
      const ema10Vals = ema(closes, 10);
      const ema20Vals = ema(closes, 20);
      const mfiVals = mfi(bars, 14);

      const ema10Data = ema10Vals.map((v, i) =>
        v == null ? undefined : { time: Math.round(bars[i].time / 1000), value: v }
      ).filter(Boolean);

      const ema20Data = ema20Vals.map((v, i) =>
        v == null ? undefined : { time: Math.round(bars[i].time / 1000), value: v }
      ).filter(Boolean);

      const mfiData = mfiVals.map((v, i) =>
        v == null ? undefined : { time: Math.round(bars[i].time / 1000), value: v }
      ).filter(Boolean);

      // 4) set data
      candleRef.current.setData(candleData);
      volRef.current?.setData(volData);
      ema10Ref.current?.setData(ema10Data);
      ema20Ref.current?.setData(ema20Data);
      mfiRef.current?.setData(mfiData);

      // 5) add MFI guides (70/30)
      const chart = chartRef.current;
      if (chart) {
        const mfiScale = chart.priceScale("mfi");
        // horizontal lines: 70 and 30
        mfiRef.current?.applyOptions({
          baseLineVisible: false,
        });
        // Using price lines as guides
        mfiRef.current?.createPriceLine?.({
          price: 70,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "70",
        });
        mfiRef.current?.createPriceLine?.({
          price: 30,
          color: "#22c55e",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "30",
        });
      }

      chartRef.current?.timeScale().fitContent();
    })();

    return () => {
      alive = false;
    };
  }, [symbol, timeframe]);

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
      aria-label="Lightweight Charts price chart with EMA10/EMA20 and MFI"
    />
  );
}
