// src/App.js
import React, { useMemo, useState } from "react";
import LiveLWChart from "./components/LiveLWChart"; // barrel export (index.js in folder)

export default function App() {
  // --- Controls state ---
  const [symbol, setSymbol] = useState("MSFT");
  const [timeframe, setTimeframe] = useState("1D");

  // --- Options ---
  const symbols = useMemo(
    () => ["MSFT", "AAPL", "NVDA", "SPY", "QQQ", "TSLA", "META", "AMZN"],
    []
  );
  const tfs = useMemo(() => ["1m", "1H", "1D"], []);

  // --- UI helpers ---
  const panel = {
    border: "1px solid #1f2a44",
    borderRadius: 12,
    padding: 12,
    background: "#0e1526",
    marginBottom: 12,
  };
  const label = { fontSize: 12, opacity: 0.8, marginBottom: 6, display: "block" };
  const row = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
  const button = (active) => ({
    padding: "8px 12px",
    borderRadius: 8,
    border: active ? "1px solid #60a5fa" : "1px solid #334155",
    background: active ? "#111827" : "#0b1220",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: 13,
  });
  const selectStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e5e7eb",
    fontSize: 14,
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#d1d4dc" }}>
      {/* Header */}
      <div style={{ padding: 12, borderBottom: "1px solid #1f2a44" }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Live Chart (Lightweight Charts)</h2>
      </div>

      {/* Layout: left dashboard + chart */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 16,
          padding: 16,
        }}
      >
        {/* LEFT DASHBOARD */}
        <div>
          {/* Symbol selector */}
          <div style={panel}>
            <span style={label}>Symbol</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={selectStyle}
            >
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe buttons */}
          <div style={panel}>
            <span style={label}>Timeframe</span>
            <div style={row}>
              {tfs.map((tf) => (
                <button
                  key={tf}
                  style={button(timeframe.toLowerCase() === tf.toLowerCase())}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* You can add more dashboard cards here later */}
        </div>

        {/* CHART */}
        <div style={{ border: "1px solid #1b2130", borderRadius: 12, overflow: "hidden" }}>
          <LiveLWChart
            symbol={symbol}
            timeframe={timeframe}
            height={620}
            enabledIndicators={[
              // keep candles clean; toggle EMAs here if desired
              "ema10",
              "ema20",
              // "mfi", // off unless you want it
              // "cmf",
            ]}
            // Example: tune EMA lengths/colors on the fly
            indicatorSettings={{
              ema10: { length: 12, color: "#34d399" }, // green EMA12
              ema20: { length: 26, color: "#f59e0b" }, // amber EMA26
            }}
          />
        </div>
      </div>
    </div>
  );
}
