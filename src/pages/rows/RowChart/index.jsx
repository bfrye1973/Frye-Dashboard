// src/pages/rows/RowChart/index.jsx
// Row row that renders the LiveLWChart directly (seed + SSE)

import React, { useState } from "react";
import LiveLWChart from "../../../components/LiveLWChart/LiveLWChart.jsx";

// Simple controls (Symbol / Timeframe)
const SYMBOLS = ["SPY", "QQQ", "IWM", "DIA", "MDY"];
const TIMEFRAMES = ["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"];

export default function RowChart() {
  const [symbol, setSymbol] = useState("SPY");
  const [timeframe, setTimeframe] = useState("10m");

  return (
    <section id="row-chart" className="panel" aria-label="Chart">
      {/* Header / Controls */}
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Chart</div>

        <label style={{ marginLeft: 12, color: "#9ca3af", fontSize: 12 }}>
          Symbol
        </label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          style={{
            marginLeft: 6,
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 6,
            padding: "4px 6px",
            fontSize: 12,
          }}
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label style={{ marginLeft: 12, color: "#9ca3af", fontSize: 12 }}>
          Timeframe
        </label>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          style={{
            marginLeft: 6,
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 6,
            padding: "4px 6px",
            fontSize: 12,
          }}
        >
          {TIMEFRAMES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="spacer" />
      </div>

      {/* Body: the actual chart */}
      <div style={{ marginTop: 8 }}>
        {/* key forces remount when tf/symbol change */}
        <LiveLWChart key={`${symbol}-${timeframe}`} symbol={symbol} timeframe={timeframe} height={520} />
      </div>
    </section>
  );
}
