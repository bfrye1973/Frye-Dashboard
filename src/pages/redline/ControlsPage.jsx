// src/pages/redline/ControlsPage.jsx
import React from "react";
import RowModeToggle from "../rows/RowModeToggle";

export default function ControlsPage() {
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
          CONTROLS
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
          Replay, AI Listen, and display controls preserved from the original dashboard.
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
        <RowModeToggle />
      </div>
    </div>
  );
}
