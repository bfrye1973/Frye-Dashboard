// src/pages/rows/RowChart.jsx
import React from "react";
import LiveLWChart from "../../components/LiveLWChart/LiveLWChart";

export default function RowChart() {
  return (
    <section id="row-6" className="panel chart-card" style={{ marginTop: 12 }}>
      <LiveLWChart symbol="SPY" timeframe="1D" height={520} />
    </section>
  );
}
