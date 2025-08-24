import React from "react";
import FerrariClusterFull from "./components/FerrariClusterFull";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#d1d4dc" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1f2a44" }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Ferrari Trading Cluster — Visual Preview</h2>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Static needles • Visuals only</div>
      </div>

      {/* Full cluster */}
      <div style={{ padding: 16 }}>
        <FerrariClusterFull />
      </div>
    </div>
  );
}
