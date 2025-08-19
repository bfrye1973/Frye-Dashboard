// src/App.js
import React from "react";
import LiveLWChart from "./components/LiveLWChart";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#d1d4dc" }}>
      {/* ✅ Build tag from React bundle */}
      <div style={{
        background:"#111827",
        borderBottom:"1px solid #334155",
        padding:"6px 10px",
        font:"12px/1.4 system-ui",
        color:"#93a3b8"
      }}>
        BUILD TAG: <strong>RB1</strong>
      </div>

      <div style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontWeight: 600, marginBottom: 12 }}>
          Live Chart (Lightweight Charts)
        </h2>
        <div style={{ border: "1px solid #1b2130", borderRadius: 12, overflow: "hidden" }}>
          <LiveLWChart
            symbol="MSFT"
            timeframe="1D"
            height={620}
            enabledIndicators={["mfi", "cmf"]}
          />
        </div>
      </div>
    </div>
  );
}
