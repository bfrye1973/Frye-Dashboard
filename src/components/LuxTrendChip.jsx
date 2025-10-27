// src/components/LuxTrendChip.jsx
import React from "react";

const toneMap = {
  green: { bg: "var(--ok)" },
  red: { bg: "var(--danger)" },
  purple: { bg: "#8b5cf6" }, // Lux purple
};

export default function LuxTrendChip({ state, reason, label }) {
  if (!state) return null;
  const s = String(state).toLowerCase();
  const tone = s.includes("green") || s.includes("bull") ? "green"
             : s.includes("red")   || s.includes("bear") ? "red"
             : "purple";
  const style = {
    background: (toneMap[tone] || toneMap.purple).bg,
    color: "#000",
    fontSize: 12,
    lineHeight: "18px",
    padding: "2px 8px",
    borderRadius: "999px",
    opacity: 0.95,
    whiteSpace: "nowrap",
  };
  return (
    <span className="lux-chip" style={style} title={reason || ""}>
      {label || (tone === "green" ? "Bullish" : tone === "red" ? "Bearish" : "Squeeze")}
    </span>
  );
}
