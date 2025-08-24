// src/App.js
import React, { useState } from "react";
import FerrariClusterFull from "./components/FerrariClusterFull";
import FinalizingDashboard from "./components/FinalizingDashboard";

export default function App() {
  const [tab, setTab] = useState("cluster"); // "cluster" | "final"

  const tabs = [
    { id: "cluster", label: "Cluster Preview" },
    { id: "final",   label: "Finalizing Dashboard" },
  ];

  const TabButton = ({ id, label }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          padding: "8px 14px",
          borderRadius: 999,
          border: active ? "1px solid #60a5fa" : "1px solid #334155",
          background: active ? "#111827" : "#0b1220",
          color: "#e5e7eb",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#d1d4dc" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1f2a44" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 600 }}>Frye Dashboard</h2>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Ferrari Trading Cluster — Visuals & Review</div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            {tabs.map(t => <TabButton key={t.id} id={t.id} label={t.label} />)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 16 }}>
        {tab === "cluster" && (
          <div>
            <FerrariClusterFull />
          </div>
        )}

        {tab === "final" && (
          <div>
            <FinalizingDashboard />
          </div>
        )}
      </div>
    </div>
  );
}
