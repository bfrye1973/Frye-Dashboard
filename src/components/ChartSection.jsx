// src/components/ChartSection.jsx
import React from "react";
import LiveLWChart from "./LiveLWChart/LiveLWChart";

export default function ChartSection({
  symbol, timeframe, enabledIndicators = [], settings = {}, height = 560, onCandles
}) {
  return (
    <section className="panel" style={panel}>
      <div className="panel-head">
        <div className="panel-title">Price Chart</div>
      </div>
      <LiveLWChart
        symbol={symbol}
        timeframe={timeframe}
        height={height}
        enabledIndicators={enabledIndicators}
        indicatorSettings={settings}
        onCandles={onCandles}
      />
    </section>
  );
}

const panel = {
  border:"1px solid #1b2130",
  borderRadius:12,
  overflow:"hidden",
  background:"#0e1526",
};
