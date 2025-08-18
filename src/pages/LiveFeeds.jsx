// src/pages/LiveFeeds.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

// Optional overlay (safe if missing)
let MoneyFlowOverlay = null;
try { MoneyFlowOverlay = require("../components/overlays/MoneyFlowOverlay").default; } catch (_) {}

/* --------- config --------- */
const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

const STEP = { minute: 60, hour: 3600, day: 86400 };
const LB = { minute: 480, hour: 240, day: 300 };

const toSec = (d) => Math.floor(d.getTime() / 1000);
const nowSec = () => Math.floor(Date.now() / 1000);

/* --------- quick demo data so chart never blanks --------- */
function demoBars(tf = "minute", n = 300, from = nowSec() - n * (STEP[tf] || 60)) {
  const step = STEP[tf] || 60;
  const out = [];
  let p = 100 + Math.random() * 5;
  for (let i = 0; i < n; i++) {
    const t = from + i * step;
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

/* --------- session shading overlay (LW) --------- */
function SessionBands({ chart, container, tf }) {
  const cvsRef = useRef(null);

  useEffect(() => {
    if (!chart || !container) return;

    const cvs = document.createElement("canvas");
    cvs.style.position = "absolute";
    cvs.style.left = "0";
    cvs.style.top = "0";
    cvs.style.pointerEvents = "none";
    cvs.style.zIndex = "5"; // below crosshair
    container.appendChild(cvs);
    cvsRef.current = cvs;
    const ctx = cvs.getContext("2d");

    const ro = new ResizeObserver(() => { size(); draw(); });
    ro.observe(container);

    const unsub = chart.timeScale().subscribeVisibleTimeRangeChange(draw);

    function size() {
      const w = container.clientWidth || 100;
      const h = container.clientHeight || 100;
      cvs.width = Math.max(2, w);
      cvs.height = Math.max(2, h);
    }

    function draw() {
      if (!ctx) return;
      size();
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      if (tf === "day") return;

      const ts = chart.timeScale();
      const range = ts.getVisibleRange();
      if (!range) return;

      const step = STEP[tf] || 60;
      const start = Math.floor(range.from / 86400) * 86400;
      const end = Math.ceil(range.to / 86400) * 86400 + 86400;

      const pre = "rgba(53, 101, 164, 0.12)";
      const post = "rgba(199, 111, 25, 0.12)";
      const frame = "rgba(255,255,255,0.05)";

      for (let day = start; day <= end; day += 86400) {
        const d = new Date(day * 1000);
        const y = d.getFullYear(), m = d.getMonth(), dd = d.getDate();
        const preStart = toSec(new Date(y, m, dd, 4, 0, 0));
        const regStart = toSec(new Date(y, m, dd, 9, 30, 0));
        const regEnd = toSec(new Date(y, m, dd, 16, 0, 0));
        const postEnd = toSec(new Date(y, m, dd, 20, 0, 0));

        const band = (a, b, fill, outline = false) => {
          const x1 = ts.timeToCoordinate(a);
          const x2 = ts.timeToCoordinate(b - step);
          if (x1 == null || x2 == null) return;
          const left = Math.min(x1, x2);
          const w = Math.max(0, Math.abs(x2 - x1));
          if (w < 2) return;
          ctx.fillStyle = fill;
          ctx.fillRect(left, 0, w, cvs.height);
          if (outline) {
            ctx.strokeStyle = frame;
            ctx.lineWidth = 1;
            ctx.strokeRect(left, 0, w, cvs.height);
          }
        };

        band(preStart, regStart, pre, false);       // premarket
        band(regStart, regEnd, "rgba(255,255,255,0.02)", true); // regular
        band(regEnd, postEnd, post, false);         // post
      }

      // tiny watermark so you can confirm this file is live
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "600 11px Inter, system-ui, -apple-system";
      ctx.fillText("LW session bands ON", 10, 18);
    }

    size(); draw();
    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.timeScale().unsubscribeVisibleTimeRangeChange(unsub); } catch {}
      try { container.removeChild(cvs); } catch {}
    };
  }, [chart, container, tf]);

  return null;
}

/* --------- page --------- */
export default function LiveFeeds() {
  const [ticker, setTicker] = useState("AAPL");
  const [tf, setTf] = useState("minute");
  const [candles, setCandles] = useState([]);

  const boxRef = useRef(null);
  const chartRef = useRef(null);
  const csRef = useRef(null);
  const vsRef = useRef(null);
  const lsRef = useRef(null);
  const lastRef = useRef(null);

  // Create chart
  useEffect(() => {
    if (!boxRef.current) return;

    // ⛔ Kill any TradingView iframe that might be in this container
    [...boxRef.current.querySelectorAll("iframe")].forEach((n) => n.remove());

    const chart = createChart(boxRef.current, {
      width: boxRef.current.clientWidth || 980,
      height: 520,
      layout: { background: { type: "Solid", color: "#0b0e13" }, textColor: "#d6deef" },
      grid: { vertLines: { color: "rgba(255,255,255,0.06)" }, horzLines: { color: "rgba(255,255,255,0.06)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    });

    const cs = chart.addCandlestickSeries({
      upColor: "#22c55e", downColor: "#ef4444", borderVisible: false,
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });
    const vs = chart.addHistogramSeries({
      priceScaleId: "", priceFormat: { type: "volume" },
      scaleMargins: { top: 0.82, bottom: 0 },
      color: "rgba(118,160,255,0.45)",
    });
    const ls = chart.addLineSeries({ color: "rgba(210,224,255,0.8)", lineWidth: 1 });

    chartRef.current = chart; csRef.current = cs; vsRef.current = vs; lsRef.current = ls;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: boxRef.current?.clientWidth || 980 });
    });
    ro.observe(boxRef.current);

    return () => { try { ro.disconnect(); } catch {}; try { chart.remove(); } catch {}; };
  }, []);

  // Initial history
  useEffect(() => {
    let dead = false;
    const lookback = LB[tf] ?? 300;
    const step = STEP[tf] || 60;
    const to = nowSec();
    const from = to - lookback * step;

    const demo = demoBars(tf, lookback, from);
    if (!dead) paint(demo);

    (async () => {
      try {
        const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(ticker)}&tf=${encodeURIComponent(tf)}&from=${from}&to=${to}`;
        const r = await fetch(url);
        if (!r.ok) throw 0;
        const data = await r.json();
        paint(Array.isArray(data) && data.length ? data : demo);
      } catch { /* keep demo */ }
    })();

    function paint(data) {
      csRef.current?.setData(data);
      vsRef.current?.setData(data.map(b => ({
        time: b.time, value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
      })));
      lsRef.current?.setData(data.map(b => ({ time: b.time, value: b.close })));
      lastRef.current = data.at(-1)?.time ?? null;
      setCandles(data);
      try { chartRef.current?.timeScale().fitContent(); } catch {}
    }

    return () => { dead = true; };
  }, [ticker, tf]);

  // Lightweight polling (so you see movement even if SSE not wired)
  useEffect(() => {
    const step = STEP[tf] || 60;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/last?ticker=${encodeURIComponent(ticker)}&tf=${encodeURIComponent(tf)}`);
        if (!r.ok) return;
        const b = await r.json();
        if (!b || !b.time) return;

        const isNew = b.time > (lastRef.current || 0) + step / 2;
        if (isNew) {
          csRef.current?.update(b);
          vsRef.current?.update({
            time: b.time, value: b.volume ?? 0,
            color: b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
          });
          lsRef.current?.update({ time: b.time, value: b.close });
          lastRef.current = b.time;
          setCandles((arr) => (arr.length ? [...arr, b] : [b]));
        } else {
          csRef.current?.update(b);
          vsRef.current?.update({
            time: b.time, value: b.volume ?? 0,
            color: b.close >= b.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
          });
          lsRef.current?.update({ time: b.time, value: b.close });
          lastRef.current = b.time;
          setCandles((arr) => (arr.length ? [...arr.slice(0, -1), b] : [b]));
        }
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [ticker, tf]);

  return (
    <main style={styles.page}>
      <div style={styles.top}>
        <select value={ticker} onChange={(e)=>setTicker(e.target.value)} style={styles.ticker}>
          {["AAPL","MSFT","NVDA","SPY","TSLA"].map(x=> <option key={x}>{x}</option>)}
        </select>
        <div style={{display:"flex",gap:8}}>
          {[
            ["minute","1m"],
            ["hour","1h"],
            ["day","1d"]
          ].map(([k,lab])=>(
            <button key={k} onClick={()=>setTf(k)}
              style={{...styles.btn, background: tf===k?"#1b2433":"#0f1520", color: tf===k?"#dbe7ff":"#a9b7d6"}}>
              {lab}
            </button>
          ))}
        </div>
        <div style={{marginLeft:"auto", opacity:.65, fontSize:12}}>No TV iframe • LW only</div>
      </div>

      <div ref={boxRef} style={styles.chart}/>
      {boxRef.current && chartRef.current ? (
        <SessionBands chart={chartRef.current} container={boxRef.current} tf={tf}/>
      ) : null}
      {MoneyFlowOverlay ? <MoneyFlowOverlay chartContainer={boxRef.current} candles={candles}/> : null}
    </main>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#070a0f", color:"#d6deef", padding:"8px 10px 24px" },
  top: { display:"flex", alignItems:"center", gap:10, marginBottom:8 },
  ticker: { background:"#0f1520", color:"#d6deef", border:"1px solid #1e293b", borderRadius:8, padding:"6px 10px", fontWeight:600 },
  btn: { border:"1px solid #1e293b", borderRadius:8, padding:"6px 10px", cursor:"pointer" },
  chart: { position:"relative", width:"100%", height:520, border:"1px solid #1e293b", borderRadius:10, background:"linear-gradient(180deg,#0b1320,#09101a)", overflow:"hidden" },
};
