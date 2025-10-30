// src/components/LuxTrendPanel.jsx
import React from "react";

const safe = (v, d="—") => (v == null || v === "" ? d : String(v));

const stateTone = (state) => {
  const s = String(state || "").toLowerCase();
  if (s.includes("green") || s.includes("bull")) return { label: "Bullish",  color: "var(--ok)" };
  if (s.includes("red")   || s.includes("bear")) return { label: "Bearish", color: "var(--danger)" };
  return { label: "Neutral", color: "var(--warn)" }; // yellow
};

export default function LuxTrendPanel({
  title,            // "Lux 10m" | "Lux 1h" | "Lux EOD"
  state,            // "green" | "yellow" | "red" (or bull/bear/neutral)
  reason,           // short text
  updatedAt,        // AZ time string already formatted or raw
  trendStrength,    // number 0..100 or string
  volatility,       // number or string
  squeeze,          // number or string
  volumeSentiment,  // number or string
}) {
  const tone = stateTone(state);
  const panel = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 260,
    flex: "1 1 0",             // grow to share width across 3 cards
    minHeight: 120,            // base height; will expand to fill row if allowed
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(12,19,32,0.92)",
    boxShadow: "0 1px 0 rgba(0,0,0,.35) inset, 0 0 0 1px rgba(255,255,255,.03)",
    overflow: "hidden",
  };
  const header = { display: "flex", alignItems: "center", gap: 10 };
  const badge  = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 10px",
    borderRadius: 999,
    background: tone.color,
    color: "#0a0a0a",
    fontWeight: 700,
    fontSize: 12,
  };
  const titleCss = { fontSize: 13, fontWeight: 700, opacity: .9 };
  const reasonCss = { fontSize: 12, opacity: .75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const grid = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
    marginTop: 4,
  };
  const metric = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "6px 8px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "#0b1220",
    minHeight: 56,
  };
  const label = { fontSize: 11, opacity: .7 };
  const val   = { fontSize: 13, fontWeight: 700 };

  return (
    <div className="lux-panel" style={panel}>
      <div style={header}>
        <span style={titleCss}>{title}</span>
        <span style={badge}>{tone.label}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, opacity: .6 }}>{safe(updatedAt)}</span>
      </div>
      <div style={reasonCss} title={safe(reason)}>{safe(reason)}</div>
      <div style={grid}>
        <div style={metric}><span style={label}>Trend Strength</span><span style={val}>{safe(trendStrength)}</span></div>
        <div style={metric}><span style={label}>Volatility</span><span style={val}>{safe(volatility)}</span></div>
        <div style={metric}><span style={label}>Squeeze</span><span style={val}>{safe(squeeze)}</span></div>
        <div style={metric}><span style={label}>Volume Sentiment</span><span style={val}>{safe(volumeSentiment)}</span></div>
      </div>
    </div>
  );
}
