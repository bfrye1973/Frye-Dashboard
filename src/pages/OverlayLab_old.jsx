// src/pages/OverlayLab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { OverlayEngine } from "../lib/overlayEngine";

const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

const WS_BASE =
  (typeof process !== "undefined" &&
    (process.env.WS_BASE_URL ||
      process.env.REACT_APP_WS_BASE ||
      process.env.VITE_WS_BASE_URL)) ||
  API_BASE.replace(/^http/i, "ws"); // derive wss:// from https://

const TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"];
const TF_OPTIONS = [
  { k: "minute", label: "1m", step: 60 },
  { k: "hour", label: "1h", step: 3600 },
  { k: "day", label: "1d", step: 86400 },
];

function ema(candles, period = 20) {
  if (!candles?.length) return [];
  const k = 2 / (period + 1);
  let prev;
  return candles.map((c, i) => {
    prev = i === 0 ? c.close : c.close * k + prev * (1 - k);
    return { time: c.time, value: +prev.toFixed(4) };
  });
}

export default function OverlayLab() {
  const [symbol, setSymbol] = useState("AAPL");
  const [tfKey, setTfKey] = useState("minute");

  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({ candle: null, ema20: null, volume: null });
  const lastTimeRef = useRef(null);
  const wsStopRef = useRef(null);
  const engineRef = useRef(null);

  const { fromISO, toISO } = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 864e5);
    return {
      toISO: to.toISOString().slice(0, 10),
      fromISO: from.toISOString().slice(0, 10),
    };
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      autoSize: true,
      layout: { background: { color: "#0d1117" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      leftPriceScale: { visible: false },
      timeScale: { rightOffset: 6, barSpacing: 8, borderVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { priceFormatter: (p) => p.toFixed(2) },
    });

    const candle = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      borderVisible: false,
    });

    const ema20 = chart.addLineSeries({
      color: "#d6dee7",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      overlay: true,
      color: "rgba(110,118,129,0.45)",
      base: 0,
    });

    seriesRef.current = { candle, ema20, volume };
    chartRef.current = chart;

    // Overlay engine (canvas layer manager)
    engineRef.current = new OverlayEngine(chart);

    // Responsive
    const ro = new ResizeObserver(() => {
      try { chart.timeScale().fitContent(); } catch {}
    });
    ro.observe(wrapRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
      try { wsStopRef.current && wsStopRef.current(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    let cancelled = false;

    async function loadHistory() {
      const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(
        symbol
      )}&tf=${encodeURIComponent(tfKey)}&from=${fromISO}&to=${toISO}`;
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`history ${r.status}`);
        const candles = await r.json();
        if (cancelled) return;

        // set candles
        seriesRef.current.candle.setData(candles);
        // ema 20
        seriesRef.current.ema20.setData(ema(candles, 20));
        // volume color by up/down
        seriesRef.current.volume.setData(
          candles.map((c, i) => ({
            time: c.time,
            value: c.volume ?? 0,
            color:
              i === 0
                ? "rgba(110,118,129,0.45)"
                : c.close >= candles[i - 1].close
                ? "rgba(38,166,154,0.45)"
                : "rgba(239,83,80,0.45)",
          }))
        );

        lastTimeRef.current = candles.at(-1)?.time ?? null;

        // tell overlays new dataset is in place
        engineRef.current?.setDataset(candles);
        chartRef.current.timeScale().fitContent();
      } catch (e) {
        console.error("loadHistory error:", e);
      }
    }

    function openWS() {
      try { wsStopRef.current && wsStopRef.current(); } catch {}
      let ws;
      try {
        ws = new WebSocket(WS_BASE);
      } catch (e) {
        console.error("WS open failed:", e);
        return () => {};
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (!msg?.type) return;

          if (msg.type === "bar" && msg.payload) {
            const b = msg.payload; // {ticker,time,open,high,low,close,volume}
            if (b.ticker && b.ticker !== symbol) return;

            // live update
            if (lastTimeRef.current && b.time === lastTimeRef.current) {
              seriesRef.current.candle.update(b);
            } else {
              seriesRef.current.candle.update(b);
              lastTimeRef.current = b.time;
            }

            // update EMA and volume for last bar only (fast path)
            const newEma = engineRef.current?.updateLastEMA?.(b) ?? null; // optional
            if (!newEma) {
              // simple: recompute ema last value on the fly
              // (engine will provide a smarter version later)
            }
          }

          if (msg.type === "metrics" && msg.payload) {
            // reserved for top tiles; ignored here
          }
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {};

      return () => { try { ws.close(); } catch {} };
    }

    loadHistory();
    wsStopRef.current = openWS();

    return () => {
      cancelled = true;
      try { wsStopRef.current && wsStopRef.current(); } catch {}
    };
  }, [symbol, tfKey, fromISO, toISO]);

  const tf = TF_OPTIONS.find((t) => t.k === tfKey);

  return (
    <main style={styles.page}>
      <div style={styles.toolbar}>
        <div style={styles.title}>Overlay Lab (Lightweight Charts)</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={styles.select}
            aria-label="Symbol"
          >
            {TICKERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 6 }}>
            {TF_OPTIONS.map((t) => (
              <button
                key={t.k}
                onClick={() => setTfKey(t.k)}
                style={{
                  ...styles.btn,
                  background: tfKey === t.k ? "#182230" : "#0f1520",
                  color: tfKey === t.k ? "#cde3ff" : "#96a4bd",
                }}
                aria-pressed={tfKey === t.k}
                title={`Timeframe: ${t.label}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        style={{
          position: "relative",
          height: "78vh",
          border: "1px solid #202733",
          borderRadius: 10,
          background: "#0d1117",
          overflow: "hidden",
        }}
      />
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "12px 14px 18px",
    background: "#0b0f17",
    color: "#d1d4dc",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  title: { fontWeight: 700, letterSpacing: ".06em", opacity: 0.95 },
  select: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #202733",
    background: "#0f1520",
    color: "#c9d6ea",
  },
  btn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #202733",
    cursor: "pointer",
  },
};
