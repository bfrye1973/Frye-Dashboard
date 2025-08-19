// src/App.js
import React, { useState, useMemo } from "react";
import LiveLWChart from "./components/LiveLWChart";

// Simple pill button
function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: active ? "1px solid #60a5fa" : "1px solid #374151",
        background: active ? "#1f2937" : "#111827",
        color: "#e5e7eb",
        cursor: "pointer",
        fontSize: 14,
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState("1m");

  const symbols = useMemo(
    () => ["AAPL", "MSFT", "NVDA", "TSLA", "META", "AMZN", "SPY", "QQQ"],
    []
  );
  const tfs = useMemo(() => ["1m", "5m", "15m", "1h", "1d"], []);

  // Tiny diagnostic so you can confirm props are flowing
  console.log(`[App] symbol=${symbol} timeframe=${timeframe}`);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#d1d4dc",
        padding: 16,
        boxSizing: "border-box",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 600 }}>Frye Dashboard — Candles Only</h2>
        <div style={{ opacity: 0.7, fontSize: 13 }}>
          Data: /api/v1/ohlc?symbol=&timeframe=
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, opacity: 0.8, paddingRight: 4 }}>Symbol</span>
          {symbols.map((s) => (
            <Pill key={s} active={symbol === s} onClick={() => setSymbol(s)}>
              {s}
            </Pill>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, opacity: 0.8, paddingRight: 4 }}>Timeframe</span>
          {tfs.map((t) => (
            <Pill key={t} active={timeframe === t} onClick={() => setTimeframe(t)}>
              {t.toUpperCase()}
            </Pill>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ border: "1px solid #1b2130", borderRadius: 12, overflow: "hidden" }}>
        <LiveLWChart symbol={symbol} timeframe={timeframe} height={560} />
      </div>

      {/* Footer tip */}
      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Tip: Open DevTools → Console. You’ll see a line like
        {" "}
        <code>[candles] AAPL 1m bars=… from=… to=…</code>
        {" "}when data loads.
      </div>
    </div>
  );
}
