// src/pages/redline/WaveDegreesPage.jsx
// Redline Wave Degrees page.
// Reuses the canonical combined RowStrategies presentation so Engine 22 Wave Degrees
// and Engine 27 Trader Intelligence stay together and read the same live snapshot.

import React from "react";
import RowStrategies from "../rows/RowStrategies";

export default function WaveDegreesPage() {
  return (
    <div style={{ maxWidth: 1900, margin: "0 auto", minWidth: 0 }}>
      <div
        style={{
          border: "1px solid rgba(239,68,68,.24)",
          borderLeft: "4px solid #ef4444",
          borderRadius: 12,
          padding: "12px 14px",
          background:
            "linear-gradient(90deg, rgba(127,29,29,.16), rgba(10,13,17,.96) 32%)",
          marginBottom: 14,
        }}
      >
        <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>
          WAVE DEGREES + TRADER INTELLIGENCE
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
          Engine22 structure and Engine27 trader-facing intelligence in one synchronized view.
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(148,163,184,.16)",
          borderRadius: 14,
          background: "rgba(7,10,14,.92)",
          padding: 10,
          overflowX: "auto",
        }}
      >
        <RowStrategies />
      </div>
    </div>
  );
}
