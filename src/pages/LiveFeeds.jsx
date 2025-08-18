// src/pages/LiveFeeds.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/* ------------------------------ CONFIG ------------------------------ */
const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  ""; // leave blank → demo data fallback

const DEFAULT_SYMBOL = "AAPL";
const DEFAULT_TF = "1m"; // "1m" | "1h" | "1d"

/* ------------------------------ HELPERS ------------------------------ */

// Compute EMA N over {close} candles
function ema(candles, period = 20) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const k = 2 / (period + 1);
  let prev;
  return candles.map((c, i) => {
    if (i === 0) {
      prev = c.close;
    } else {
      prev = c.close * k + prev * (1 - k);
    }
    return { time: c.time, value: +prev.toFixed(4) };
  });
}

// Simple demo data when API is missing/unavailable
function demoCandles(count = 600, startUnix = Math.floor(Date.now() / 1000) - 600 * 60) {
  const out = [];
  let price = 110;
  for (let i = 0; i < count; i++) {
    const t = startUnix + i * 60; // 1m bars
    const wave =
      3 * Math.sin(i / 24) +
      1.6 * Math.sin(i / 5.7) +
      0.9 * Math.sin(i / 2.1);
    const o = price;
    const c = price + wave * 0.12 + (Math.random() - 0.5) * 0.2;
    const h = Math.max(o, c) + Math.random() * 0.25;
    const l = Math.min(o, c) - Math.random() * 0.25;
    const v = 100000 + Math.floor((Math.abs(wave) + 0.5) * 45000);
    out.push({
      time: t,
      open: +o.toFixed(2),
      high: +h.toFixed(2),
      low: +l.toFixed(2),
      close: +c.toFixed(2),
      volume: v,
    });
    price = c;
  }
  return out;
}

// Session band overlay (pre-market 04:00–09:30, after-hours 16:00–20:00, America/New_York)
function attachSessionBands(chart, opts = {}) {
  const { preColor = "rgba(60,130,255,0.10)", postColor = "rgba(230,150,40,0.10)" } = opts;
  const root = chart?.chartElement?.parentElement || chart._internal__container || chart._container;
  if (!root) return () => {};

  root.style.position = "relative";
  const layer = document.createElement("canvas");
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  root.appendChild(layer);
  const ctx = layer.getContext("2d");

  const toNYParts = (date) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value])
    );

  const unixNY = (utcY, utcM, utcD, hh, mm) => {
    // build a same-day NY wall-clock time → convert to a real UTC instant
    const d = new Date(Date.UTC(utcY, utcM, utcD));
    const parts = toNYParts(d);
    const isoNY = `${parts.year}-${parts.month}-${parts.day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`;
    return Math.floor(new Date(isoNY).getTime() / 1000);
    // (Intl trick: we format a UTC day as NY, then recompose into a Z string)
  };

  function draw() {
    const W = root.clientWidth;
    const H = root.clientHeight;
    const dpr = devicePixelRatio || 1;
    if (layer.width !== Math.floor(W * dpr) || layer.height !== Math.floor(H * dpr)) {
      layer.width = Math.floor(W * dpr);
      layer.height = Math.floor(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const tr = chart.timeScale().getVisibleRange();
    if (!tr) return;

    const from = new Date(tr.from * 1000);
    const to = new Date(tr.to * 1000);

    // build day list (UTC days)
    const days = [];
    const d0 = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const d1 = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    for (let d = new Date(d0); d <= d1; d.setUTCDate(d.getUTCDate() + 1)) {
      days.push(new Date(d));
    }

    for (const day of days) {
      const y = day.getUTCFullYear();
      const m = day.getUTCMonth();
      const dn = day.getUTCDate();

      // pre: 04:00–09:30
      const preFrom = unixNY(y, m, dn, 4, 0);
      const preTo = unixNY(y, m, dn, 9, 30);
      // post: 16:00–20:00
      const postFrom = unixNY(y, m, dn, 16, 0);
      const postTo = unixNY(y, m, dn, 20, 0);

      const ranges = [
        { from: preFrom, to: preTo, color: preColor },
        { from: postFrom, to: postTo, color: postColor },
      ];

      for (const r of ranges) {
        if (r.to <= tr.from || r.from >= tr.to) continue;
        const x1 = chart.timeScale().timeToCoordinate(r.from);
        const x2 = chart.timeScale().timeToCoordinate(r.to);
        if (x1 == null || x2 == null) continue;
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        ctx.fillStyle = r.color;
        ctx.fillRect(left, 0, right - left, H);
      }
    }
  }

  const ro = new ResizeObserver(draw);
  ro.observe(root);

  const unsubA = chart.timeScale().subscribeVisibleTimeRangeChange(draw);
  const unsubB = chart.timeScale().subscribeVisibleLogicalRangeChange(draw);

  // first paint
  setTimeout(draw, 40);

  return () => {
    try { ro.disconnect(); } catch {}
    try { unsubA && chart.timeScale().unsubscribeVisibleTimeRangeChange(draw); } catch {}
    try { unsubB && chart.timeScale().unsubscribeVisibleLogicalRangeChange(draw); } catch {}
    try { layer.remove(); } catch {}
  };
}

/* ------------------------------ PAGE ------------------------------ */

export default function LiveFeeds() {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const emaRef = useRef(null);
  const volRef = useRef(null);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [tf, setTf] = useState(DEFAULT_TF);

  // create chart once
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      autoSize: true,
      layout: { background: { color: "#0d1117" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "#18202c" },
        horzLines: { color: "#18202c" },
      },
      rightPriceScale: { borderColor: "#334155", scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: { borderColor: "#334155", rightOffset: 6, barSpacing: 8 },
      crosshair: { mode: 0 },
    });

    const cand = chart.addCandlestickSeries({
      upColor: "#20c997",
      downColor: "#e25555",
      borderVisible: false,
      wickUpColor: "#20c997",
      wickDownColor: "#e25555",
    });

    const emaLine = chart.addLineSeries({
      color: "#d6dee7",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "", // separate scale at bottom
      autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 1 } }),
      color: "#6e7f91",
      base: 0,
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = cand;
    emaRef.current = emaLine;
    volRef.current = vol;

    // overlay bands
    const detachBands = attachSessionBands(chart);

    return () => {
      detachBands && detachBands();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // fetch + set data whenever symbol / timeframe changes
  useEffect(() => {
    if (!chartRef.current) return;

    (async () => {
      let candles = [];
      try {
        if (API_BASE) {
          // Example expected: GET /api/candles?symbol=AAPL&tf=1m -> [{time,open,high,low,close,volume}]
          const r = await fetch(`${API_BASE}/api/candles?symbol=${symbol}&tf=${tf}`);
          if (!r.ok) throw new Error("bad status");
          const data = await r.json();
          candles = Array.isArray(data) ? data : data?.candles || [];
        }
      } catch {
        candles = demoCandles(); // fallback demo data
      }

      // lightweight-charts expects { time: unix_sec, open, high, low, close }
      candleRef.current.setData(candles);

      const ema20 = ema(candles, 20);
      emaRef.current.setData(ema20);

      // colorize volume by candle direction
      const volData = candles.map((c, i) => ({
        time: c.time,
        value: c.volume ?? 0,
        color: (i === 0 ? "#6e7f91" : (c.close >= candles[i - 1].close ? "rgba(32,201,151,0.45)" : "rgba(226,85,85,0.45)")),
      }));
      volRef.current.setData(volData);

      chartRef.current.timeScale().fitContent();
    })();
  }, [symbol, tf]);

  return (
    <div style={{ height: "100%", padding: "10px 12px 0" }}>
      <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <strong>Live Chart (LW only)</strong>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={ui.select}
          title="Symbol"
        >
          <option>AAPL</option>
          <option>MSFT</option>
          <option>NVDA</option>
          <option>TSLA</option>
          <option>SPY</option>
        </select>
        <div style={{ display: "flex", gap: 6 }}>
          {["1m", "1h", "1d"].map((k) => (
            <button
              key={k}
              onClick={() => setTf(k)}
              style={{ ...ui.btn, ...(tf === k ? ui.btnOn : {}) }}
              title={`Timeframe: ${k}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} style={{ height: "78vh", border: "1px solid #202733", borderRadius: 8 }} />
    </div>
  );
}

/* ------------------------------ UI bits ------------------------------ */

const ui = {
  btn: {
    padding: "6px 10px",
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid #2a3342",
    background: "#0f1520",
    color: "#c9d6ea",
    cursor: "pointer",
  },
  btnOn: {
    background: "#1f2937",
    color: "#e3ecfa",
  },
  select: {
    background: "#0f1520",
    color: "#c9d6ea",
    border: "1px solid #2a3342",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 12,
  },
};
