// src/App.js — 6-row layout: Toggle, Overview, Engine Lights, Sectors, Strategies, Chart
import React, { useMemo, useState } from "react";

// Rows
import ModeToggleBar from "./components/ModeToggleBar";
import MarketOverview from "./components/MarketOverview";
import EngineLightsPanel from "./components/EngineLightsPanel";
import SectorsGrid from "./components/SectorsGrid";
import StrategiesPanel from "./components/StrategiesPanel";
import ChartSection from "./components/ChartSection";

export default function App() {
  // Row 1/2 mode
  const [mode, setMode] = useState("meter"); // "meter" | "lights" | "arrows"

  // Chart controls (Row 6)
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
    mfp: { lookback:250, bins:24, showZones:true, zonesCount:1, zoneOpacity:0.12,
           showSides:true, sideWidthPct:0.18, sideOpacity:0.28, posColor:"#22c55e", negColor:"#ef4444", innerMargin:10 },
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

  /* ----- Page layout styles ----- */
  const page = { minHeight:"100vh", background:"#0d1117", color:"#d1d4dc", display:"grid", gap:12, padding:"12px" };
  const panel = { border:"1px solid #1f2a44", borderRadius:12, padding:10, background:"#0e1526" };
  const rowCtl = { display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" };
  const label  = { fontSize:12, opacity:0.85, marginBottom:6, display:"block" };
  const select = { width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #334155", background:"#0b1220", color:"#e5e7eb", fontSize:14, outline:"none" };
  const btn = (active) => ({
    padding:"6px 10px", borderRadius:8,
    border: active ? "1px solid #60a5fa" : "1px solid #334155",
    background: active ? "#111827" : "#0b1220",
    color:"#e5e7eb", cursor:"pointer", fontSize:12
  });

  return (
    <div style={page}>
      {/* Row 1: Mode toggle */}
      <ModeToggleBar mode={mode} onChange={setMode} />

      {/* Row 2: Market Overview */}
      <MarketOverview mode={mode} />

      {/* Row 3: Engine Lights */}
      <EngineLightsPanel />

      {/* Row 4: Index Sectors */}
      <SectorsGrid />

      {/* Row 5: Strategies */}
      <StrategiesPanel />

      {/* Chart Controls (tied to Row 6) */}
      <section className="panel" style={panel}>
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
            <div style={rowCtl}>
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
                  <input type="checkbox" checked={!!enabled[id]} onChange={(e)=>setEnabled(p=>({ ...p, [id]: e.target.checked }))}/>
                  <span className="small">{lbl}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Row 6: Chart (isolated section) */}
      <ChartSection
        symbol={symbol}
        timeframe={timeframe}
        enabledIndicators={enabledIndicators}
        settings={settings}
        height={560}
      />
      {/* onCandles wired in ChartSection->LiveLWChart if you need it later */}
    </div>
  );
}
