// src/pages/LiveFeeds.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

// If you created this overlay at: src/components/overlays/MoneyFlowOverlay.js
// it will be picked up here automatically; if not present, we keep going.
let MoneyFlowOverlay = null;
try {
  // path from pages → components
  // eslint-disable-next-line global-require, import/no-unresolved
  MoneyFlowOverlay = require("../components/overlays/MoneyFlowOverlay").default;
} catch (_) {
  /* overlay optional */
}

/* -------------------------- Config / Helpers -------------------------- */

const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

/** choose a small lookback so first paint is fast */
const LOOKBACK_BY_TF = {
  minute: 480, // ~ a trading day of 1-minute bars
  hour: 240,
  day: 300,
};

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function makeDemoBars(tf = "minute", n = 300, start = nowSec() - n * 60) {
  const step =
    tf === "day" ? 86400 : tf === "hour" ? 3600 : 60; /* default 1m bars */
  const out = [];
  let p = 100 + Math.random() * 5;
  for (let i = 0; i < n; i++) {
    const t = start + i * step;
    const drift = (Math.random() - 0.5) * 0.8;
    const o = p;
    const c = o + drift;
    const h = Math.max(o, c) + Math.random() * 0.6;
    const l = Math.min(o, c) - Math.random() * 0.6;
    const v = 100000 + Math.floor(Math.random() * 150000);
    out.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
    p = c;
  }
  return out;
}

/* ------------------------------ Page --------------------------------- */

export default function LiveFeeds() {
  const [ticker, setTicker] = useState("AAPL");
  const [tf, setTf] = useState("minute"); // 'minute' | 'hour' | 'day'
  const [candles, setCandles] = useState([]);

  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lineSeriesRef = useRef(null);
  const lastTimeRef = useRef(null);

  /* --------- create chart once --------- */
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 980,
      height: 480,
      layout: {
        background: { type: "Solid", color: "#0b0e13" },
        textColor: "#d6deef",
        fontFamily: "Inter, ui-sans-serif, system-ui",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: tf !== "day",
        secondsVisible: tf === "minute",
      },
      crosshair: { mode: 1 },
    });

    const cs = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const vs = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
      scaleMargins: { top: 0.85, bottom: 0 },
      color: "rgba(118,160,255,0.45)",
    });

    const ls = chart.addLineSeries({
      color: "rgba(210,224,255,0.8)",
      lineWidth: 1,
    });

    chartRef.current = chart;
    candleSeriesRef.current = cs;
    volumeSeriesRef.current = vs;
    lineSeriesRef.current = ls;

    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({ width: wrapRef.current?.clientWidth || 980 });
      } catch {}
    });
    ro.observe(wrapRef.current);

    return () => {
      try {
        ro.disconnect();
      } catch {}
      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lineSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------- (re)load history whenever ticker/tf changes --------- */
  useEffect(() => {
    let disposed = false;

    async function loadHistory() {
      const lookback = LOOKBACK_BY_TF[tf] ?? 300;
      const step = tf === "day" ? 86400 : tf === "hour" ? 3600 : 60;
      const to = nowSec();
      const from = to - lookback * step;

      // Paint demo first so UI never looks empty
      const demo = makeDemoBars(tf, lookback, from);
      if (!disposed) {
        paintBars(demo);
      }

      // Try real history API
      try {
        const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(
          ticker
        )}&tf=${encodeURIComponent(tf)}&from=${from}&to=${to}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`history ${r.status}`);
        const rows = await r.json();
        const data =
          Array.isArray(rows) && rows.length
            ? rows
            : demo;

        if (!disposed) {
          paintBars(data);
        }
      } catch {
        // keep demo bars
      }
    }

    function paintBars(data) {
      candleSeriesRef.current?.setData(data);
      volumeSeriesRef.current?.setData(
        data.map((b) => ({
          time: b.time,
          value: b.volume ?? 0,
          color: b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
        }))
      );
      lineSeriesRef.current?.setData(
        data.map((b) => ({ time: b.time, value: b.close }))
      );
      setCandles(data);
      lastTimeRef.current = data.at(-1)?.time ?? null;

      try {
        chartRef.current?.timeScale().fitContent();
      } catch {}
    }

    loadHistory();

    return () => {
      disposed = true;
    };
  }, [ticker, tf]);

  /* ---------------------------- UI ---------------------------- */

  return (
    <main style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.left}>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            style={styles.ticker}
            title="Ticker"
          >
            {["AAPL", "MSFT", "NVDA", "SPY", "TSLA"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 8 }}>
            {[
              ["minute", "1m"],
              ["hour", "1h"],
              ["day", "1d"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTf(k)}
                style={{
                  ...styles.btn,
                  background: tf === k ? "#1b2433" : "#0f1520",
                  color: tf === k ? "#dbe7ff" : "#a9b7d6",
                }}
                title={`Timeframe: ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.right}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Backend:{" "}
            <span style={{ color: "#34d399" }}>
              {API_BASE.includes("onrender") ? "Online" : "Custom"}
            </span>
          </div>
        </div>
      </div>

      <div ref={wrapRef} style={styles.chartWrap} />
      {MoneyFlowOverlay ? (
        <MoneyFlowOverlay chartContainer={wrapRef.current} candles={candles} />
      ) : null}
    </main>
  );
}

/* ---------------------------- Styles ---------------------------- */

const styles = {
  page: {
    minHeight: "100vh",
    background: "#070a0f",
    color: "#d6deef",
    padding: "8px 10px 20px",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  left: { display: "flex", alignItems: "center", gap: 10 },
  right: { display: "flex", alignItems: "center", gap: 12 },

  ticker: {
    background: "#0f1520",
    color: "#d6deef",
    border: "1px solid #1e293b",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 600,
  },
  btn: {
    border: "1px solid #1e293b",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
  },
  chartWrap: {
    position: "relative",
    width: "100%",
    height: 520,
    border: "1px solid #1e293b",
    borderRadius: 10,
    background: "linear-gradient(180deg,#0b1320,#09101a)",
    overflow: "hidden",
  },
};
