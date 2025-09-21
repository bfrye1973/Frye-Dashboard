// src/pages/rows/RowStrategies/index.jsx
import React, { useState } from "react";

/**
 * RowStrategies — Tabs only (B2)
 * - Shows 3 tabs: Alignment • Wave 3 • Flagpole
 * - Active tab is highlighted
 * - Static counts (0/0/0) for now
 * - No data, no chart wiring yet
 */
export default function RowStrategies() {
  const [active, setActive] = useState("alignment");

  const tabs = [
    { key: "alignment", label: "Alignment (0)" },
    { key: "wave3", label: "Wave 3 (0)" },
    { key: "flagpole", label: "Flagpole (0)" },
  ];

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 12,
        padding: "8px 12px",
        color: "#e5e7eb",
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: active === tab.key ? "#2563eb" : "#2b2b2b",
              color: active === tab.key ? "#fff" : "#9ca3af",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 12, background: "#111", borderRadius: 8 }}>
        <strong>Active Tab:</strong> {active}
      </div>
    </div>
  );
}
