// src/components/MarketMeter.jsx
import React from "react";
import { getTone } from "../lib/dashboardApi";
import { useDelta, deltaArrow, formatDelta } from "../lib/delta";

/** value: 0..100, note: optional badge string */
export default function MarketMeter({ value, note }) {
  const d = useDelta(value);
  const arrow = deltaArrow(d);
  const deltaTxt = formatDelta(d, 1);
  const tone = getTone(value);

  // bar % width
  const w = Math.max(0, Math.min(100, value));

  const color =
    tone === "ok" ? "#16a34a" :
    tone === "warn" ? "#f59e0b" :
    tone === "danger" ? "#ef4444" : "#64748b";

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Market Meter</div>
        {note ? <span className="tag tag-warn">{note}</span> : null}
        <div className="spacer" />
        <span className={`tag tag-${tone}`} style={{minWidth:72, textAlign:"center"}}>
          {tone === "ok" ? "Bullish" : tone === "warn" ? "Neutral" : tone === "danger" ? "Bearish" : "Info"}
        </span>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:"100%", height:10, background:"#0b1220", border:"1px solid #1f2a44", borderRadius:10, overflow:"hidden" }}>
          <div style={{ width:`${w}%`, height:"100%", background:color }} />
        </div>
        <div style={{ width:60, textAlign:"right", fontWeight:800 }}>{Math.round(value)}</div>
        <div className={`delta ${d > 0 ? "delta-up" : d < 0 ? "delta-down" : "delta-flat"}`}>{arrow} {deltaTxt}</div>
      </div>

      <div className="muted small" style={{ marginTop:6 }}>Bearish ← 0 … 100 → Bullish</div>
    </div>
  );
}
