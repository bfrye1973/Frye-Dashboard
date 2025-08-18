// src/pages/LiveFeeds.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

// Optional money-flow overlay (if present we render it)
let MoneyFlowOverlay = null;
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  MoneyFlowOverlay = require("../components/overlays/MoneyFlowOverlay").default;
} catch (_) {}

/* ------------------------------------------------------------------ */
/*                            CONFIG & UTILS                           */
/* ------------------------------------------------------------------ */

const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

const LOOKBACK_BY_TF = { minute: 480, hour: 240, day: 300 }; // small for fast first paint
const STEP_BY_TF = { minute: 60, hour: 3600, day: 86400 };

const US_REG_OPEN = { h: 9, m: 30 };
const US_REG_CLOSE = { h: 16, m: 0 };

// convert a JS Date in local tz to unix seconds
const toSec = (d) => Math.floor(d.getTime() / 1000);
const nowSec = () => Math.floor(Date.now() / 1000);

function makeDemoBars(tf = "minute", n = 300, start = nowSec() - n * 60) {
  const step = STEP_BY_TF[tf] || 60;
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

/* ------------------------------------------------------------------ */
/*                         SESSION SHADING (Canvas)                    */
/* ------------------------------------------------------------------ */
// Very small overlay that draws bands for premarket/regular/postmarket.
function SessionShadingOverlay({ chart, container, tf }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!container || !chart) return;

    // create canvas
    const cvs = document.createElement("canvas");
    cvs.style.position = "absolute";
    cvs.style.left = "0";
    cvs.style.top = "0";
    cvs.style.pointerEvents = "none";
    cvs.style.zIndex = "5"; // under crosshair/overlay
    container.appendChild(cvs);
    canvasRef.current = cvs;

    const ctx = cvs.getContext("2d");

    const ro = new ResizeObserver(() => {
      syncSize();
      draw();
    });
    ro.observe(container);

    const unsub = chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      draw();
    });

    function syncSize() {
      const w = container.clientWidth || 100;
      const h = container.clientHeight || 100;
      cvs.width = Math.max(2, w);
      cvs.height = Math.max(2, h);
    }

    function draw() {
      if (!ctx) return;
      syncSize();
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      // only shade for intraday tfs
      if (tf === "day") return;

      const ts = chart.timeScale();
      const range = ts.getVisibleRange();
      if (!range) return;

      const step = STEP_BY_TF[tf] || 60;
      // Walk days inside visible range
      const startSec = Math.floor(range.from / 86400) * 86400;
      const endSec = Math.ceil(range.to / 86400) * 86400 + 86400;

      // colors
      const preColor = "rgba(53, 101, 164, 0.12)"; // blue-ish
      const postColor = "rgba(199, 111, 25, 0.12)"; // orange-ish
      const regFrame = "rgba(255,255,255,0.05)";

      for (let day = startSec; day <= endSec; day += 86400) {
        // Build local date from 'day' (assumes day is in UTC seconds; use local tz for simple shading)
        const d = new Date(day * 1000);
        const y = d.getFullYear();
        const m = d.getMonth();
        const date = d.getDate();

        const preStart = toSec(new Date(y, m, date, 4, 0, 0)); // 04:00
        const regStart = toSec(new Date(y, m, date, US_REG_OPEN.h, US_REG_OPEN.m, 0)); // 09:30
        const regEnd = toSec(new Date(y, m, date, US_REG_CLOSE.h, US_REG_CLOSE.m, 0)); // 16:00
        const postEnd = toSec(new Date(y, m, date, 20, 0, 0)); // 20:00

        // helper to draw band [a,b)
        const rect = (a, b, fill, frame = false) => {
          const x1 = ts.timeToCoordinate(a);
          const x2 = ts.timeToCoordinate(b - step);
          if (x1 == null || x2 == null) return;
          const left = Math.min(x1, x2);
          const right = Math.max(x1, x2);
          const w = right - left;
          if (w <= 1) return;

          ctx.fillStyle = fill;
          ctx.fillRect(left, 0, w, cvs.height);

          if (frame) {
            ctx.strokeStyle = regFrame;
            ctx.lineWidth = 1;
            ctx.strokeRect(left, 0, w, cvs.height);
          }
        };

        // premarket 04:00–09:30
        rect(preStart, regStart, preColor, false);
        // regular 09:30–16:00 (frame it lightly)
        rect(regStart, regEnd, "rgba(255,255,255,0.02)", true);
        // post 16:00–20:00
        rect(regEnd, postEnd, postColor, false);
      }
    }

    // initial draw
    syncSize();
    draw();

    return () => {
      try {
        ro.disconnect();
      } catch {}
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(unsub);
      } catch {}
      try {
        container.removeChild(cvs);
      } catch {}
    };
  }, [chart, container, tf]);

  return null;
}

/* ------------------------------------------------------------------ */
/*                               PAGE                                  */
/* ------------------------------------------------------------------ */

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

  /* ----------------------- chart creation ----------------------- */
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 980,
      height: 520,
      layout: {
        background: { type: "Solid", color: "#0b0e13" },
        textColor: "#d6deef",
        fontFamily: "Inter, ui-sans-serif, system-ui",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
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
      scaleMargins: { top: 0.82, bottom: 0 }, // more room for volume
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
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lineSeriesRef.current = null;
    };
  }, []);

  /* --------------- load initial history on change --------------- */
  useEffect(() => {
    let disposed = false;

    async function loadHistory() {
      const lookback = LOOKBACK_BY_TF[tf] ?? 300;
      const step = STEP_BY_TF[tf] || 60;
      const to = nowSec();
      const from = to - lookback * step;

      // Demo first
      const demo = makeDemoBars(tf, lookback, from);
      if (!disposed) paintBars(demo);

      // Real history
      try {
        const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(
          ticker
        )}&tf=${encodeURIComponent(tf)}&from=${from}&to=${to}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`history ${r.status}`);
        const rows = await r.json();
        const data = Array.isArray(rows) && rows.length ? rows : demo;
        if (!disposed) paintBars(data);
      } catch {
        // keep demo
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
      lineSeriesRef.current?.setData(data.map((b) => ({ time: b.time, value: b.close })));
      setCandles(data);
      lastTimeRef.current = data.at(-1)?.time ?? null;
      try { chartRef.current?.timeScale().fitContent(); } catch {}
    }

    loadHistory();
    return () => { disposed = true; };
  }, [ticker, tf]);

  /* ----------------------------- LIVE ---------------------------- */
  useEffect(() => {
    if (!chartRef.current) return;

    let stop = () => {};
    const step = STEP_BY_TF[tf] || 60;

    // Try SSE first
    try {
      const sseUrl = `${API_BASE}/api/stream?ticker=${encodeURIComponent(
        ticker
      )}&tf=${encodeURIComponent(tf)}`;

      const es = new EventSource(sseUrl);
      const onMsg = (ev) => {
        try {
          const tick = JSON.parse(ev.data);
          if (tick && tick.time) onTick(tick);
        } catch {}
      };
      es.addEventListener("message", onMsg);
      es.addEventListener("error", () => {
        // silently fallback
      });

      stop = () => {
        try { es.close(); } catch {}
      };
    } catch {
      // ignore
    }

    // Also add a polling fallback (lightweight, 5s)
    const poll = setInterval(async () => {
      try {
        const url = `${API_BASE}/api/last?ticker=${encodeURIComponent(
          ticker
        )}&tf=${encodeURIComponent(tf)}`;
        const r = await fetch(url);
        if (!r.ok) return;
        const tick = await r.json();
        if (tick && tick.time) onTick(tick);
      } catch {}
    }, 5000);

    function onTick(b) {
      const lastTime = lastTimeRef.current || 0;
      const isNewBar = b.time > lastTime + step / 2;

      if (isNewBar) {
        // append
        candleSeriesRef.current?.update(b);
        volumeSeriesRef.current?.update({
          time: b.time,
          value: b.volume ?? 0,
          color: b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
        });
        lineSeriesRef.current?.update({ time: b.time, value: b.close });
        lastTimeRef.current = b.time;
        setCandles((arr) => (arr.length ? [...arr, b] : [b]));
      } else {
        // mutate last
        candleSeriesRef.current?.update(b);
        volumeSeriesRef.current?.update({
          time: b.time,
          value: b.volume ?? 0,
          color: b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
        });
        lineSeriesRef.current?.update({ time: b.time, value: b.close });
        lastTimeRef.current = b.time;
        setCandles((arr) => (arr.length ? [...arr.slice(0, -1), b] : [b]));
      }
    }

    return () => {
      clearInterval(poll);
      stop();
    };
  }, [ticker, tf]);

  /* --------------------------- RENDER --------------------------- */

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
      {/* Session shading band overlay */}
      {wrapRef.current && chartRef.current ? (
        <SessionShadingOverlay
          chart={chartRef.current}
          container={wrapRef.current}
          tf={tf}
        />
      ) : null}

      {/* Optional money flow overlay */}
      {MoneyFlowOverlay ? (
        <MoneyFlowOverlay chartContainer={wrapRef.current} candles={candles} />
      ) : null}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*                                STYLES                               */
/* ------------------------------------------------------------------ */

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
