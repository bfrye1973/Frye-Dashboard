// src/components/KpiTile.jsx
import React from "react";
import { getTone } from "../lib/dashboardApi";
import { useDelta, formatDelta, deltaArrow } from "../lib/delta";

/**
 * Props:
 *  title: "Breadth" | "Momentum" | "Squeeze (Compression)"
 *  value: number (0..100)
 *  hint: optional small string under title
 *  unit: "%", "psi", "°F"
 *  precision: number of decimals (default 0)
 *  badge: optional string (e.g., "Major Squeeze — direction unknown")
 *  spark: optional array<number> (if you want a mini sparkline later)
 */
export default function KpiTile({ title, value, unit="%", precision=0, hint, badge }) {
  const d = useDelta(value);
  const arrow = deltaArrow(d);
  const deltaTxt = formatDelta(d, 1);
  const tone = getTone(value); // "danger" | "warn" | "ok" | "info"

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        {badge ? <span className="tag tag-warn">{badge}</span> : null}
        <div className="spacer" />
        <span className={`tag tag-${tone}`} style={{minWidth:72, textAlign:"center"}}>
          {tone === "ok" ? "Bullish" : tone === "warn" ? "Neutral" : tone === "danger" ? "Bearish" : "Info"}
        </span>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontSize:28, fontWeight:800 }}>
          {Number.isFinite(value) ? value.toFixed(precision) : "—"}<span style={{ opacity:.7, fontSize:14 }}> {unit}</span>
        </div>

        <div className={`delta ${d > 0 ? "delta-up" : d < 0 ? "delta-down" : "delta-flat"}`} style={{ fontSize:14 }}>
          {arrow} {deltaTxt}
        </div>
      </div>

      {hint ? <div className="muted small" style={{ marginTop:6 }}>{hint}</div> : null}
    </div>
  );
}
