import FerrariTwoGaugesReplica from "./components/FerrariTwoGaugesReplica";

import React from "react";
import GaugeCluster from "./components/GaugeCluster";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#d1d4dc" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1f2a44" }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Frye Dashboard</h2>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Ferrari Trading Cluster</div>
      </div>
      <div style={{ padding: 16 }}>
        <GaugeCluster />
      </div>
    </div>
  );
}
