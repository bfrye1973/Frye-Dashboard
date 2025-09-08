// src/components/ModeToggleBar.jsx
import React from "react";

export default function ModeToggleBar({ mode, onChange }) {
  const modes = [
    { key: "meter",  label: "Meter + Tiles" },
    { key: "lights", label: "Traffic Lights" },
    { key: "arrows", label: "Arrow Scorecards" },
  ];
  return (
    <section className="panel" style={panel}>
      <div style={{ display: "flex", gap: 8 }}>
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: mode === m.key ? "1px solid #60a5fa" : "1px solid #334155",
              background: mode === m.key ? "#111827" : "#0b1220",
              color: "#e5e7eb",
              cursor: "pointer",
              fontSize: 12
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
    </section>
  );
}

const panel = {
  border: "1px solid #1f2a44",
  borderRadius: 12,
  padding: 8,
  background: "#0e1526",
};
