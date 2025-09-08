// src/components/ChartSection.jsx
// A self-contained chart area that renders a title/actions row and LiveLWChart.
// Props: symbol, timeframe, enabledIndicators, indicatorSettings

import React, { useState } from "react";
import LiveLWChart from "./LiveLWChart/LiveLWChart";

export default function ChartSection({
  symbol,
  timeframe,
  enabledIndicators = [],
  indicatorSettings = {},
  height = 560,                 // default chart height; tweak as desired
  title = "Price",
  rightActions = null,          // optional React node (buttons, info)
  onCandles,                    // optional handler if you want candles upstream
}) {
  // Keep candles local by default, but forward if onCandles provided
  const [localCandles, setLocalCandles] = useState([]);

  const handleCandles = (bars) => {
    setLocalCandles(bars);
    try { onCandles?.(bars); } catch {}
  };

  return (
    <section className="panel chart-section" style={panel}>
      {/* Header row (title + actions) */}
      <div className="panel-head" style={head}>
        <div className="panel-title">{title}</div>
        <div style={{ flex: 1 }} />
        {rightActions}
      </div>

      {/* Chart body */}
      <div className="chart-body">
        <LiveLWChart
          symbol={symbol}
          timeframe={timeframe}
          height={height}
          enabledIndicators={enabledIndicators}
          indicatorSettings={indicatorSettings}
          onCandles={handleCandles}
        />
      </div>
    </section>
  );
}

/* Simple inline styles to keep the section self-contained. Move to index.css if preferred. */
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
