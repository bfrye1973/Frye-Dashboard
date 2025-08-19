// src/components/LiveLWChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";

/** Resolve API base (Render/CRA/Vite or window override) */
function resolveApiBase() {
  // 1) Runtime override (optional): <script>window.__API_BASE__ = "https://your-backend";</script>
  if (typeof window !== "undefined" && window.__API_BASE__) return String(window.__API_BASE__);

  // 2) CRA / Render build-time env:
  // (CRA replaces process.env.REACT_APP_* at build time)
  if (typeof process !== "undefined" && process.env) {
    if (process.env.REACT_APP_API_BASE) return String(process.env.REACT_APP_API_BASE);
    if (process.env.REACT_APP_API_BASE_URL) return String(process.env.REACT_APP_API_BASE_URL);
  }

  // 3) Fallback: relative (works in local dev if you proxy /api to backend)
  return "";
}
const API_BASE = resolveApiBase();

function apiUrl(path) {
  const base = (API_BASE || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * LiveLWChart
 *  - Renders candlesticks + EMA(10) + EMA(20)
 *  - Props:
 *      symbol: string ("AAPL" | "MSFT" | "SPY" | ...)
 *      timeframe: "1m" | "5m" | "15m" | "30m" | "1h" | "1d"
 *      height: number (px)
 *
 * Backend contract:
 *   GET /api/v1/ohlc?symbol=SPY&timeframe=1h
 *   Response:
 *     { ok:true, bars:[{ t: 1735584000000, o,h,l,c,v }, ...] }  // t in ms
 *   (Older shape [ ... ] also supported.)
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

  const toSec = (msOrSec) =>
    typeof msOrSec === "number" && msOrSec > 1e12
      ? Math.floor(msOrSec / 1000)
      : typeof msOrSec === "number"
      ? msOrSec
      : Math.floor(Date.now() / 1000);

  function normalizeBars(json) {
    const raw = Array.isArray(json) ? json : Array.isArray(json?.bars) ? json.bars : [];
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
    rows.sort((a, b) => a.time - b.time);
    return rows;
  }

  function computeEMA(rows, period) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (period <= 1) return rows.map((r) => ({ time: r.time, value: r.close }));
    if (rows.length < period) return [];

    const closes = rows.map((r) => r.close);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += closes[i];
    let prev = sum / period;

    const out = [{ time: rows[period - 1].time, value: prev }];
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
      const url = apiUrl(`/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(tf)}`);
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`OHLC ${res.status}`);
      const json = await res.json();
      return normalizeBars(json);
    } catch (e) {
      console.error("fetchHistory error:", e);
      return [];
    } finally {
      clearTimeout(id);
    }
  }

  useEffect(() => {
    if (!wrapRef.current) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch {}
    }

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 1200,
      height,
      layout: { background: { type: "Solid", color: "#0f1117" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: timeframe !== "1d",
        secondsVisible: ["1m", "5m", "15m", "30m"].includes(timeframe),
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

    const ema10 = chart.addLineSeries({
      color: "#00bcd4",
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      title: "EMA 10",
    });

    const ema20 = chart.addLineSeries({
      color: "#ffa726",
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
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
      ema10.setData(computeEMA(rows, 10));
      ema20.setData(computeEMA(rows, 20));
      chart.timeScale().fitContent();
    })();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: wrapRef.current?.clientWidth || 1200, height });
    });
    ro.observe(wrapRef.current);

    return () => {
      alive = false;
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
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
