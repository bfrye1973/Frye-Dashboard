import React from "react";

/**
 * PulseIcon10m
 * Renders a small bar-chart icon + Signal number for the 10-minute Sector Rotation Pulse.
 * Reads from:
 *   - data.pulse10m.{signal,pulseDelta,offenseTilt,defensiveTilt,risingPct}
 *   - falls back to data.metrics.pulse10m_* mirrors
 */
export default function PulseIcon10m({ data }) {
  const p = (data && data.pulse10m) || {};
  const m = (data && data.metrics) || {};

  const signal =
    typeof p.signal === "number"
      ? p.signal
      : typeof m.pulse10m_signal === "number"
      ? m.pulse10m_signal
      : null;

  const pulseDelta =
    typeof p.pulseDelta === "number" ? p.pulseDelta : null;

  const offenseTilt =
    typeof p.offenseTilt === "number"
      ? p.offenseTilt
      : typeof m.pulse10m_offenseTilt === "number"
      ? m.pulse10m_offenseTilt
      : null;

  const defensiveTilt =
    typeof p.defensiveTilt === "number"
      ? p.defensiveTilt
      : typeof m.pulse10m_defenseTilt === "number"
      ? m.pulse10m_defenseTilt
      : null;

  const risingPct =
    typeof p.risingPct === "number"
      ? p.risingPct
      : typeof m.pulse10m_risingPct === "number"
      ? m.pulse10m_risingPct
      : null;

  const band = (s) => {
    if (s == null || Number.isNaN(s)) return "muted";
    return s >= 60 ? "ok" : s < 40 ? "red" : "warn";
  };

  const fillColor = {
    ok:   "#19c37d",
    warn: "#e5b454",
    red:  "#ff5a5a",
    muted:"#93a1b2",
  }[band(signal)];

  const container = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 6px",
    borderRadius: 8,
    border: "1px solid rgba(120,150,190,.25)",
    background: "rgba(8,12,20,.55)",
    color: "#e5e7eb",
    lineHeight: 1.1,
  };

  const valStyle = {
    fontWeight: 700,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums"
  };

  const lblStyle = {
    fontSize: 10,
    opacity: 0.85
  };

  const title =
    `Pulse 10m • Signal: ${signal ?? "—"}`
    + (risingPct != null ? ` • Rising: ${risingPct}%` : "")
    + (offenseTilt != null ? ` • Off: ${offenseTilt}` : "")
    + (defensiveTilt != null ? ` • Def: ${defensiveTilt}` : "")
    + (pulseDelta != null ? ` • Δ: ${(pulseDelta > 0 ? "+" : "") + pulseDelta.toFixed(1)}` : "");

  return (
    <div style={container} title={title}>
      {/* bar-chart glyph */}
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <rect x="1"  y="9" width="3" height="6" rx="1" fill={fillColor} />
        <rect x="6"  y="6" width="3" height="9" rx="1" fill={fillColor} opacity=".9" />
        <rect x="11" y="3" width="3" height="12" rx="1" fill={fillColor} opacity=".8" />
      </svg>

      {/* value + label */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
        <span style={valStyle}>{signal != null ? signal.toFixed(1) : "—"}</span>
        <span style={lblStyle}>Pulse</span>
      </div>
    </div>
  );
}
