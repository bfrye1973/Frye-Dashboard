// src/App.js — 3 rows: DashboardTop, Controls+Gauges table, Full-width ChartSection
import React, { useMemo, useState, useEffect } from "react";

// Top (beginner-friendly): Market Meter + KPI Tiles (modes)
import DashboardTop from "./components/DashboardTop";

// Middle: Market table
import GaugesPanel from "./components/GaugesPanel";

// Bottom: Chart section (isolated)
import ChartSection from "./components/ChartSection";

// Services (optional prefetch for GaugesPanel)
import { getGauges } from "./services/gauges";

export default function App() {
  /* ---------------- Symbol / timeframe ---------------- */
  const [symbol, setSymbol] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1D");
  const [candles, setCandles] = useState([]); // LiveLWChart will push bars here

  /* ---------------- Indicators ---------------- */
  const [enabled, setEnabled] = useState({
    ema10: true, ema20: true,
    mfp: false, sr: false, swing: false,
    squeeze: false, smi: false, vol: false,
  });

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

  const symbols = useMemo(() => ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","META","AMZN"], []);
  const tfs     = useMemo(() => ["1m","10m","1H","1D"], []);

  // Optional: prefetch a row for GaugesPanel (table can also fetch itself)
  const [gaugesRow, setGaugesRow] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const rows = await getGauges(symbol);
        if (!live) return;
        setGaugesRow(rows?.[0] || null);
      } catch {}
    })();
    return () => { live = false; };
  }, [symbol]);

  /* ------------ Layout styles (3 rows) ------------ */
  const page = {
    minHeight: "100vh",
    background: "#0d1117",
    color: "#d1d4dc",
    display: "grid",
    gap: 12,
    padding: "12px",
  };

  // Row 2: two columns: Controls | Market Gauges
  const row2 = {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 12,
    alignItems: "start",
  };

  const panel  = { border:"1px solid #1f2a44", borderRadius:12, padding:10, background:"#0e1526", marginBottom:12 };
  const label  = { fontSize:12, opacity:0.85, marginBottom:6, display:"block" };
  const rowCtl = { display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" };
  const btn    = (active) => ({
    padding:"6px 10px",
    borderRadius:8,
    border: active ? "1px solid #60a5fa" : "1px solid #334155",
    background: active ? "#111827" : "#0b1220",
    color:"#e5e7eb",
    cursor:"pointer",
    fontSize:12
  });
  const select = {
    width:"100%", padding:"8px 10px", borderRadius:8,
    border:"1px solid #334155", background:"#0b1220", color:"#e5e7eb",
    fontSize:14, outline:"none"
  };

  const tablePanel = { border:"1px solid #1b2130", borderRadius:12, overflow:"hidden" };

  return (
    <div style={page}>
      {/* Row 1: Beginner-friendly top (Market Meter + Tiles / modes) */}
      <DashboardTop />

      {/* Row 2: Controls (left) + Market Gauges table (right) */}
      <div style={row2}>
        {/* --- Controls --- */}
        <div>
          <div style={panel}>
            <span style={label}>Symbol</span>
            <select value={symbol} onChange={(e)=>setSymbol(e.target.value)} style={select}>
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={panel}>
            <span style={label}>Timeframe</span>
            <div style={rowCtl}>
              {tfs.map(tf => (
                <button
                  key={tf}
                  style={btn(timeframe.toLowerCase()===tf.toLowerCase())}
                  onClick={()=>setTimeframe(tf)}
                >
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
                <label htmlFor={id} style={{ fontSize:12, opacity:0.9 }}>{lbl}</label>
              </div>
            ))}
          </div>
        </div>

        {/* --- Market Gauges table --- */}
        <div style={tablePanel}>
          <GaugesPanel defaultIndex={symbol} />
        </div>
      </div>

      {/* Row 3: Full-width ChartSection (chart in its own section) */}
      <ChartSection
        symbol={symbol}
        timeframe={timeframe}
        height={560}
        enabledIndicators={enabledIndicators}
        settings={settings}
        onCandles={setCandles}
        title="Price Chart"
      />
    </div>
  );
}
