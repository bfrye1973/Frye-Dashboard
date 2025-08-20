// src/App.js
import React, { useMemo, useState, useEffect } from "react";
import LiveLWChart from "./components/LiveLWChart";

export default function App() {
  const [symbol, setSymbol] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1D");

  // tiny feed debug banner
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

  // indicator toggles
  const [enabled, setEnabled] = useState({
    ema10: true,
    ema20: true,
    mfp:  false,
    sr:   false,
    swing:false,
  });

  // indicator settings (overrides)
  const [settings] = useState({
    ema10: { length: 12, color: "#60a5fa" },
    ema20: { length: 26, color: "#f59e0b" },
    mfp: {
      lookback: 250,
      bins: 24,
      showZones: true,
      zonesCount: 1,
      zoneOpacity: 0.12,
      showSides: true,
      sideWidthPct: 0.18,
      sideOpacity: 0.28,
      posColor: "#22c55e",
      negColor: "#ef4444",
      innerMargin: 10,
    },
    // sr: { leftBars: 15, rightBars: 15, lineWidth: 3, band: 0, volumeThresh: 20 },
    // swing: { leftBars: 15, rightBars: 10, volumeThresh: 0, showBoxes: true, showLines: true, showLabels: true }
  });

  // active indicator id list
  const enabledIndicators = useMemo(() => {
    const out = [];
    if (enabled.ema10) out.push("ema10");
    if (enabled.ema20) out.push("ema20");
    if (enabled.mfp)   out.push("mfp");
    if (enabled.sr)    out.push("sr");
    if (enabled.swing) out.push("swing");
    return out;
  }, [enabled]);

  const symbols = useMemo(() => ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","META","AMZN"], []);
  const tfs = useMemo(() => ["1m","1H","1D"], []);

  // styles
  const panel = { border: "1px solid #1f2a44", borderRadius: 12, padding: 12, background: "#0e1526", marginBottom: 12 };
  const label = { fontSize: 12, opacity: 0.8, marginBottom: 6, display: "block" };
  const row = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
  const btn = (active) => ({
    padding: "8px 12px",
    borderRadius: 8,
    border: active ? "1px solid #60a5fa" : "1px solid #334155",
    background: active ? "#111827" : "#0b1220",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: 13,
  });
  const select = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1px solid #334155", background: "#0b1220",
    color: "#e5e7eb", fontSize: 14, outline: "none",
  };
  const checkRow = { display: "flex", alignItems: "center", gap: 8, margin: "6px 0" };
  const small = { fontSize: 12, opacity: 0.85 };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#d1d4dc" }}>
      {/* debug banner */}
      <div style={{ padding: "6px 10px", fontSize: 12, color: "#93a3b8", background: "#111827", borderBottom: "1px solid #334155" }}>
        FEED: <strong>{dbg.source}</strong> • bars: <strong>{dbg.bars}</strong> • shape: <strong>{dbg.shape}</strong> • url: <span style={{ opacity: 0.8 }}>{dbg.url}</span>
      </div>

      <div style={{ padding: 12, borderBottom: "1px solid #1f2a44" }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Live Chart (Lightweight Charts)</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, padding: 16 }}>
        {/* LEFT DASHBOARD */}
        <div>
          {/* Symbol */}
          <div style={panel}>
            <span style={label}>Symbol</span>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={select}>
              {symbols.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>

          {/* Timeframe */}
          <div style={panel}>
            <span style={label}>Timeframe</span>
            <div style={row}>
              {tfs.map((tf) => (
                <button key={tf} style={btn(timeframe.toLowerCase() === tf.toLowerCase())} onClick={() => setTimeframe(tf)}>
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Indicator toggles */}
          <div style={panel}>
            <span style={label}>Indicators</span>

            <div style={checkRow}>
              <input id="ema10" type="checkbox" checked={enabled.ema10}
                onChange={(e) => setEnabled((p) => ({ ...p, ema10: e.target.checked }))} />
              <label htmlFor="ema10" style={small}>EMA 10</label>
            </div>

            <div style={checkRow}>
              <input id="ema20" type="checkbox" checked={enabled.ema20}
                onChange={(e) => setEnabled((p) => ({ ...p, ema20: e.target.checked }))} />
              <label htmlFor="ema20" style={small}>EMA 20</label>
            </div>

            <div style={checkRow}>
              <input id="mfp" type="checkbox" checked={enabled.mfp}
                onChange={(e) => setEnabled((p) => ({ ...p, mfp: e.target.checked }))} />
              <label htmlFor="mfp" style={small}>Money Flow Profile</label>
            </div>

            <div style={checkRow}>
              <input id="sr" type="checkbox" checked={enabled.sr}
                onChange={(e) => setEnabled((p) => ({ ...p, sr: e.target.checked }))} />
              <label htmlFor="sr" style={small}>Support / Resistance</label>
            </div>

            <div style={checkRow}>
              <input id="swing" type="checkbox" checked={enabled.swing}
                onChange={(e) => setEnabled((p) => ({ ...p, swing: e.target.checked }))} />
              <label htmlFor="swing" style={small}>Swing Points & Liquidity</label>
            </div>

            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
              Active: {enabledIndicators.join(", ") || "none"}
            </div>
          </div>
        </div>

        {/* CHART */}
        <div style={{ border: "1px solid #1b2130", borderRadius: 12, overflow: "hidden" }}>
          <LiveLWChart
            symbol={symbol}
            timeframe={timeframe}
            height={620}
            enabledIndicators={enabledIndicators}
            indicatorSettings={settings}
          />
        </div>
      </div>
    </div>
  );
}
