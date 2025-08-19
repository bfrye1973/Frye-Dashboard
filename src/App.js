// src/App.js
import React from "react";
import LiveLWChart from "./components/LiveLWChart";

export default function App() {
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
      <h2 style={{ margin: 0, fontWeight: 600, marginBottom: 12 }}>
        Live Chart (Lightweight Charts)
      </h2>

      <div style={{ border: "1px solid #1b2130", borderRadius: 12, overflow: "hidden" }}>
        <LiveLWChart
          symbol="MSFT"               // fixed
          timeframe="1D"              // fixed
          height={620}
          enabledIndicators={["mfi", "cmf"]}  // add/remove as you like
          indicatorSettings={{ mfi: { length: 14 }, cmf: { length: 20 } }}
        />
      </div>
    </div>
  );
}
