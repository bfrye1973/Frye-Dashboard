// src/components/ChartSection.jsx
// Self-contained section wrapper for the price chart.
// Renders a title/header and LiveLWChart, nothing else.

import React from "react";
import LiveLWChart from "./LiveLWChart/LiveLWChart";

export default function ChartSection({
  symbol,
  timeframe,
  enabledIndicators = [],
  settings = {},
  height = 560,
  onCandles,
  title = "Price Chart",
  rightActions = null, // pass buttons/links later if you want
}) {
  return (
    <section className="panel" style={panel}>
      <div className="panel-head" style={head}>
        <div className="panel-title">{title}</div>
        <div style={{ flex: 1 }} />
        {rightActions}
      </div>

      <div className="chart-body">
        <LiveLWChart
          symbol={symbol}
          timeframe={timeframe}
          height={height}
          enabledIndicators={enabledIndicators}
          indicatorSettings={settings}
          onCandles={onCandles}
        />
      </div>
    </section>
  );
}

const panel = {
  border: "1px solid #1b2130",
  borderRadius: 12,
  overflow: "hidden",
  background: "#0e1526",
};

const head = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderBottom: "1px solid #1f2a44",
  background: "#0c1320",
  color: "#d1d4dc",
};
