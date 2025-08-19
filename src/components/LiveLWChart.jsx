// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

/**
 * LiveLWChart
 *  - Renders candlesticks + EMA(10) + EMA(20)
 *  - Props:
 *      symbol: "AAPL" | "MSFT" | "SPY" | ...
 *      timeframe: "1m" | "5m" | "15m" | "30m" | "1h" | "1d"
 *      height: number (px)
 *
 *  Backend contract (already live):
 *    GET /api/v1/ohlc?symbol=SPY&timeframe=1h
 *    Response example:
 *      { ok:true, bars:[{ t: 1735584000000, o:..., h:..., l:..., c:..., v:...}, ...] }
 *    (t in ms; we convert to unix seconds for Lightweight Charts)
 */

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1d",
  height = 560,
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);

  // ---------- utils ----------
  const toSec = (msOrSec) =>
    typeof msOrSec === "number" && msOrSec > 1e12
      ? Math.floor(msOrSec / 1000) // ms -> s
      : typeof msOrSec === "number"
      ? msOrSec
      : Math.floor(Date.now() / 1000);

  // Accepts either {bars:[...]} or [...] and normalizes to LWC shape
  function normalizeBars(json) {
    const raw = Array.isArray(json) ? json : Array.isArray(json?.bars) ? json.bars : [];
    // Bars ascending by time; convert to { time, open, high, low, close, volume }
    const rows = raw
      .map((b) => ({
        time: toSec(b.t ?? b.time),
        open: +((b.o ?? b.open) ?? 0),
        high: +((b.h ?? b.high) ?? 0),
        low: +((b.l ?? b.low) ?? 0),
        close: +((b.c ?? b.close) ?? 0),
        volume: +((b.v ?? b.volume) ?? 0),
      }))
      .filter((r) => r.time && Number.isFinite(r.open) && Number.isFinite(r.close));
    // Ensure strictly ascending (Polygon is asc; still guard)
    rows.sort((a, b) => a.time - b.time);
    return rows;
  }

  // Simple EMA: seed with SMA for first 'p' samples, then standard multiplier
  function computeEMA(rows, period) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (period <= 1) {
      return rows.map((r) => ({ time: r.time, value: r.close }));
    }

    const out = [];
    const closes = rows.map((r) => r.close);
    if (closes.length < period) return out;

    let sum = 0;
    for (let i = 0; i < period; i++) sum += closes[i];
    let prev = sum / period;
    out.push({ time: rows[period - 1].time, value: prev });

    const k = 2 / (period + 1);
    for (let i = period; i < closes.length; i++) {
      const ema = closes[i] * k + prev * (1 - k);
      out.push({ time: rows[i].time, value: ema });
      prev = ema;
    }
    return out;
  }

  async function fetchHistory(sym, tf) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 20000);
    try {
      const url = `/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(
        tf
      )}`;
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`OHLC ${res.status} ${res.statusText}`);
      const json = await res.json();
      return normalizeBars(json);
    } catch (e) {
      console.error("fetchHistory error:", e);
      return [];
    } finally {
      clearTimeout(id);
    }
  }

  // ---------- init & update ----------
  useEffect(() => {
    if (!wrapRef.current) return;

    // Destroy & recreate chart on prop changes (simplest + safest)
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {}
    }

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
      timeScale: {
        borderVisible: false,
        secondsVisible: timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "30m",
        timeVisible: timeframe !== "1d",
      },
      rightPriceScale: {
        borderVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      localization: {
        priceFormatter: (p) => (p ?? 0).toFixed(2),
      },
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // EMA lines (overlay on same scale as candles)
    const ema10 = chart.addLineSeries({
      color: "#00bcd4", // teal-ish
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      title: "EMA 10",
    });

    const ema20 = chart.addLineSeries({
      color: "#ffa726", // orange-ish
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      title: "EMA 20",
    });

    chartRef.current = chart;
    candleRef.current = candles;
    ema10Ref.current = ema10;
    ema20Ref.current = ema20;

    let alive = true;
    (async () => {
      const rows = await fetchHistory(symbol, timeframe);
      if (!alive) return;

      candles.setData(rows);

      // Compute EMAs over close prices
      const e10 = computeEMA(rows, 10);
      const e20 = computeEMA(rows, 20);
      ema10.setData(e10);
      ema20.setData(e20);

      chart.timeScale().fitContent();
    })();

    // Responsive
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
      ema10Ref.current = null;
      ema20Ref.current = null;
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
      aria-label="Lightweight Charts: Candles with EMA(10) & EMA(20)"
    />
  );
}
