// src/App.js
import React, { useMemo, useState, useEffect } from "react";

// Components
import LiveLWChart from "./components/LiveLWChart";
import GaugesPanel from "./components/GaugesPanel";
import FerrariTwoGaugesMock from "./components/FerrariTwoGaugesMock"; // ⬅️ two‑gauge visual test

// Data (Momentum / Breadth)
import { getGauges } from "./services/gauges";

export default function App() {
  const [symbol, setSymbol] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1D");

  // Small debug banner for OHLC feed
  const [dbg, setDbg] = useState({ source: "-", url: "-", bars: 0, shape: "-" });
  useEffect(() => {
    const id = setInterval(() => {
      const d = window.__FEED_DEBUG__ || {};
      setDbg({
        source: d.source || "-",
        url: d.url || "-",
        bars: d.bars || 0,
        shape: d.shape || "-",
      });
    }, 600);
    return () => clearInterval(id);
  }, []);

  // Indicator toggles
  const [enabled, setEnabled] = useState({
    ema10: true,
    ema20: true,
    mfp:   false,
    sr:    false,
    swing: false,
    squeeze: false,
    smi:     false,
    vol:     false,
  });

  // Indicator settings (override only if needed)
  const [settings] = useState({
    ema10: { length: 12, color: "#60a5fa" },
    ema20: { length: 26, color: "#f59e0b" },
    mfp: {
      lookback: 250, bins: 24,
      showZones: true, zonesCount: 1, zoneOpacity: 0.12,
      showSides: true, sideWidthPct: 0.18, sideOpacity: 0.28,
      posColor: "#22c55e", negColor: "#ef4444", innerMargin: 10,
    },
  });

  // Build list passed to chart
  const enabledIndicators = useMemo(() => {
    const out = [];
    if (enabled.ema10) out.push("ema10");
    if (enabled.ema20) out.push("ema20");
    if (enabled.mfp)   out.push("mfp");
    if (enabled.sr)    out.push("sr");
    if (enabled.swing) out.push("swing");
    if (enabled.squeeze) out.push("squeeze");
    if (enabled.smi)     out.push("smi");
    if (enabled.vol)     out.push("vol");
    return out;
  }, [enabled]);

  // Sidebar lists
  const symbols = useMemo(() => ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","META","AMZN"], []);
  const tfs     = useMemo(() => ["1m","10m","1H","1D"], []);

  // Candles (future use; kept for consistency)
  const [candles, setCandles] = useState([]);

  // Gauges (momentum / breadth) for current index
  const [gaugesRow, setGaugesRow] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await getGauges(symbol);
      if (!live) return;
      setGaugesRow(rows[0] || null); // choose latest row
    })();
    return () => { live = false; };
  }, [symbol]);

  // ----- styles -----
  const panel  = { border:"1px solid #1f2a44", borderRadius:12, padding:12, background:"#0e1526", marginBottom:12 };
  const label  = { fontSize:12, opacity:0.8, marginBottom:6, display:"block" };
  const row    = { display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" };
  const btn = (active) => ({
    padding:"8px 12px", borderRadius:8,
    border: active ? "1px solid #60a5fa" : "1px solid #334155",
    background: active ? "#111827" : "#0b1220",
    color:"#e5e7eb", cursor:"pointer", fontSize:13
  });
  const select = {
    width:"100%", padding:"8px 10px", borderRadius:8,
    border:"1px solid #334155", background:"#0b1220", color:"#e5e7eb",
    fontSize:14, outline:"none"
  };

  // Carbon‑fiber header strip + gloss
  const cfHeader = {
    position:"relative",
    padding:"10px 14px",
    borderBottom:"1px solid #1f2a44",
    background:
      `repeating-linear-gradient(45deg, #0b1220 0 2px, #0f172a 2px 4px),
       repeating-linear-gradient(-45deg, #0b1220 0 2px, #0f172a 2px 4px)`,
    backgroundBlendMode:"multiply",
  };
  const cfGloss = {
    position:"absolute", left:0, right:0, top:0, height:38,
    background:"linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
    borderBottom:"1px solid rgba(255,255,255,0.06)",
    pointerEvents:"none",
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0d1117", color:"#d1d4dc" }}>
      {/* Debug header */}
      <div style={{ padding:"6px 10px", fontSize:12, color:"#93a3b8", background:"#111827", borderBottom:"1px solid #334155" }}>
        FEED: <strong>{dbg.source}</strong> • bars: <strong>{dbg.bars}</strong> • shape: <strong>{dbg.shape}</strong> • url: <span style={{opacity:0.8}}>{dbg.url}</span>
      </div>

      {/* Carbon‑fiber header strip */}
      <div style={cfHeader}>
        <div style={cfGloss} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:12, letterSpacing:1.2, textTransform:"uppercase", opacity:0.75 }}>
            Ferrari Two‑Gauge Replica (Visual Test)
          </div>
          <div style={{ fontSize:11, opacity:0.6 }}>
            {symbol} • {timeframe.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Title */}
      <div style={{ padding:12, borderBottom:"1px solid #1f2a44" }}>
        <h2 style={{ margin:0, fontWeight:600 }}>Live Chart (Lightweight Charts)</h2>
      </div>

      {/* Layout: Sidebar + Right */}
      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:16, padding:16 }}>
        {/* Sidebar */}
        <div>
          <div style={panel}>
            <span style={label}>Symbol</span>
            <select value={symbol} onChange={(e)=>setSymbol(e.target.value)} style={select}>
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={panel}>
            <span style={label}>Timeframe</span>
            <div style={row}>
              {tfs.map(tf => (
                <button key={tf} style={btn(timeframe.toLowerCase()===tf.toLowerCase())} onClick={()=>setTimeframe(tf)}>
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={panel}>
            <span style={label}>Indicators</span>
            {[
              ["ema10","EMA 10"], ["ema20","EMA 20"], ["mfp","Money Flow Profile"],
              ["sr","Support / Resistance"], ["swing","Swing / Liquidity"],
              ["squeeze","Squeeze (LuxAlgo)"], ["smi","SMI"], ["vol","Volume"],
            ].map(([id,lbl]) => (
              <div key={id} style={{ display:"flex", alignItems:"center", gap:8, margin:"6px 0" }}>
                <input
                  id={id}
                  type="checkbox"
                  checked={!!enabled[id]}
                  onChange={(e)=>setEnabled(p=>({ ...p, [id]: e.target.checked }))}
                />
                <label htmlFor={id} style={{ fontSize:12, opacity:0.85 }}>{lbl}</label>
              </div>
            ))}
            <div style={{ marginTop:8, fontSize:11, opacity:0.7 }}>
              Active: {enabledIndicators.join(", ") || "none"}
            </div>
          </div>
        </div>

        {/* Right: Two‑gauge mock + GaugesPanel + Chart */}
        <div style={{ border:"1px solid #1b2130", borderRadius:12, overflow:"hidden" }}>
          {/* 🚗 Two‑gauge Ferrari replica (visuals only) */}
          <FerrariTwoGaugesMock
            rpmPercent={40}     // 0..100 visual only (no data yet)
            speedPercent={20}   // 0..100 visual only (no data yet)
          />

          {/* (Optional) table gauges */}
          <GaugesPanel defaultIndex={symbol} />

          {/* Multi‑pane chart (unchanged) */}
          <LiveLWChart
            symbol={symbol}
            timeframe={timeframe}
            height={620}
            enabledIndicators={enabledIndicators}
            indicatorSettings={settings}
            onCandles={setCandles}
          />
        </div>
      </div>
    </div>
  );
}
