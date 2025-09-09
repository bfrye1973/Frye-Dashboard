// src/pages/rows/RowModeToggle.jsx
import React, { useState } from "react";

const MODES = [
  { key: "meter",  label: "Meter + Tiles" },
  { key: "lights", label: "Traffic Lights" },
  { key: "arrows", label: "Arrow Scorecards" },
];

export default function RowModeToggle({ value, onChange }) {
  const [mode, setMode] = useState(value || "meter");

  function handleClick(next) {
    setMode(next);
    onChange?.(next); // inform parent if provided
  }

  return (
    <section id="row-1" className="panel" aria-label="View Modes">
      <div className="panel-head">
        <div className="panel-title">View Modes</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => handleClick(m.key)}
            aria-pressed={mode === m.key}
            title={`Switch to ${m.label}`}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #1f2a44",
              background: mode === m.key ? "#182230" : "#0e1526",
              color: mode === m.key ? "#cde3ff" : "#9fb0cc",
              cursor: "pointer"
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
    </section>
  );
}
