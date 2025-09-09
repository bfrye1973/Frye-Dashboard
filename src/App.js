// src/App.js — 6 rows: Mode Toggle, Market Overview, Engine Lights, Sectors, Strategies, Chart
import React, { useMemo, useState } from "react";

/* Rows kept under ./components (flat structure) */
import ModeToggleBar from "./components/ModeToggleBar";
import MarketOverview from "./components/MarketOverview";
import EngineLightsPanel from "./components/EngineLightsPanel";
import SectorsGrid from "./components/SectorsGrid";
import StrategiesPanel from "./components/StrategiesPanel";
import ChartSection from "./components/ChartSection";

/* ---------- DEBUG build marker (remove later) ---------- */
const __BUILD_TS__ = new Date().toISOString();
console.log("APP build:", __BUILD_TS__);

export default function App() {
  /* Row 1/2: overview mode */
  const [mode, setMode] = useState("meter"); // "meter" | "lights" | "arrows"

  /* Row 6: chart controls */
  const [symbol, setSymbol] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1D");
  const [enabled, setEnabled] = useState({
    ema10: true, ema20: true,
    mfp: false, sr: false, swing: false,
    squeeze: false, smi: false, vol: false,
  });
  const [settings] = useState({
    ema10: { length: 12, color: "#60a5fa" },
    ema20: { length: 26, color: "#f59e0b" },
  });

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

  /* --- simple UI styles for the page and cards --- */
  const page   = { minHeight:"100vh", background:"#0d1117", color:"#d1d4dc", display:"grid", gap:12, padding:"12px" };
  const panel  = { border:"1px solid #1f2a44", borderRadius:12, padding:10, background:"#0e1526" };
  const label  = { fontSize:12, opacity:0.85, marginBottom:6, display:"block" };
  const select = { width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #334155", background:"#0b1220", color:"#e5e7eb", fontSize:14, outline:"none" };
  const btn    = (active) => ({
    padding:"6px 10px",
    borderRadius:8,
    border: active ? "1px solid #60a5fa" : "1px solid #334155",
    background: active ? "#111827" : "#0b1220",
    color:"#e5e7eb",
    cursor:"pointer",
    fontSize:12
  });

  return (
    <div style={page}>
      {/* DEBUG marker — remove when you confirm deploys update */}
      <div style={{position:'fixed', top:6, right:8, zIndex:99999, background:'#111827',
                   color:'#fff', border:'1px solid #334155', padding:'2px 6px', borderRadius:6, fontSize:12}}>
        {__BUILD_TS__}
      </div>

      {/* Row 1: Mode toggle */}
      <section id="row-1">
        <ModeToggleBar mode={mode} onChange={setMode} />
      </section>

      {/* Row 2: Market Overview */}
      <section id="row-2">
        <MarketOverview mode={mode} />
      </section>

      {/* Row 3: Engine Lights */}
      <section id="row-3">
        <EngineLightsPanel />
      </section>

      {/* Row 4: Index Sectors */}
      <section id="row-4">
        <SectorsGrid />
      </section>

      {/* Row 5: Strategies */}
      <section id="row-5">
        <StrategiesPanel />
      </section>

      {/* Chart Controls (just above chart) */}
      <section id="row-5-controls" className="panel" style={panel}>
        <div className="panel-head"><div className="panel-title">Chart Controls</div></div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
          {/* Symbol */}
          <div className="panel" style={panel}>
            <span style={label}>Symbol</span>
            <select value={symbol} onChange={(e)=>setSymbol(e.target.value)} style={select}>
              {["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","META","AMZN"].map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
          </div>

          {/* Timeframe */}
          <div className="panel" style={panel}>
            <span style={label}>Timeframe</span>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["1m","10m","1H","1D"].map(tf => (
                <button key={tf} style={btn(timeframe.toLowerCase()===tf.toLowerCase())} onClick={()=>setTimeframe(tf)}>
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Indicators */}
          <div className="panel" style={panel}>
            <span style={label}>Indicators</span>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6 }}>
              {[
                ["ema10","EMA 10"], ["ema20","EMA 20"],
                ["mfp","Money Flow Profile"], ["sr","Support/Resistance"],
                ["swing","Swing/Liquidity"], ["squeeze","Squeeze (LuxAlgo)"],
                ["smi","SMI"], ["vol","Volume"],
              ].map(([id,lbl]) => (
                <label key={id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <input type="checkbox"
                         checked={!!enabled[id]}
                         onChange={(e)=>setEnabled(p=>({ ...p, [id]: e.target.checked }))}/>
                  <span className="small">{lbl}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Row 6: Chart Section (full width) */}
      <section id="row-6">
        <ChartSection
          symbol={symbol}
          timeframe={timeframe}
          enabledIndicators={enabledIndicators}
          settings={settings}
          height={560}
          title="Price Chart"
        />
      </section>
    </div>
  );
}
