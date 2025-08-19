// src/App.js
import React, { useMemo, useState, useEffect } from "react";
import LiveLWChart from "./components/LiveLWChart";

export default function App() {
  const [symbol, setSymbol] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1D");
  const [dbg, setDbg] = useState({ source: "-", url: "-", bars: 0, shape: "-" });

  // read feed debug (backend vs mock)
  useEffect(() => {
    const id = setInterval(() => {
      const d = window.__FEED_DEBUG__ || {};
      setDbg({
        source: d.source || "-",
        url: d.url || "-",
        bars: d.bars || 0,
        shape: d.shape || "-",
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const symbols = useMemo(() => ["SPY","QQQ","AAPL","MSFT","NVDA","TSLA","META","AMZN"], []);
  const tfs = useMemo(() => ["1m", "1H", "1D"], []);

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

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#d1d4dc" }}>
      {/* debug bar while we verify */}
      <div style={{ padding: "6px 10px", fontSize: 12, color: "#93a3b8", background: "#111827", borderBottom: "1px solid #334155" }}>
        FEED: <strong>{dbg.source}</strong> • bars: <strong>{dbg.bars}</strong> • shape: <strong>{dbg.shape}</strong> • url: <span style={{ opacity: 0.8 }}>{dbg.url}</span>
      </div>

      <div style={{ padding: 12, borderBottom: "1px solid #1f2a44" }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Live Chart (Lightweight Charts)</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, padding: 16 }}>
        {/* LEFT DASHBOARD */}
        <div>
          <div style={panel}>
            <span style={label}>Symbol</span>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={select}>
              {symbols.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
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
        </div>

        {/* CHART */}
        <div style={{ border: "1px solid #1b2130", borderRadius: 12, overflow: "hidden" }}>
          <LiveLWChart
            symbol={symbol}
            timeframe={timeframe}
            height={620}
            enabledIndicators={[
              "ema10",
              "ema20",
              "mfp",       // Money Flow Profile overlay (not MFI oscillator)
            ]}
            indicatorSettings={{
              ema10: { length: 12, color: "#60a5fa" },
              ema20: { length: 26, color: "#f59e0b" },
              // ✅ Updated keys for the profile:
              mfp: {
                lookback: 250,
                bins: 24,
                showZones: true,      // full-width blocks for dominant zones
                zonesCount: 1,        // top 1 green + top 1 red zone
                zoneOpacity: 0.12,
                showSides: true,      // side bars inside pane edges
                sideWidthPct: 0.18,   // 18% of pane width max
                sideOpacity: 0.28,
                posColor: "#22c55e",
                negColor: "#ef4444",
                innerMargin: 10,      // padding from left/right edges (px)
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
