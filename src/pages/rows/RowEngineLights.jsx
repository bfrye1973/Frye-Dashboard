// src/pages/rows/RowEngineLights.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ---- pill component ---- */
function Light({ label, tone = "info", active = true }) {
  // Added an "off" tone for inactive pills (blacked-out look, still visible)
  const palette = {
    ok:     { bg:"#064e3b", fg:"#d1fae5", bd:"#065f46", shadow:"#065f46" },
    warn:   { bg:"#5b4508", fg:"#fde68a", bd:"#a16207", shadow:"#a16207" },
    danger: { bg:"#7f1d1d", fg:"#fecaca", bd:"#b91c1c", shadow:"#b91c1c" },
    info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" },
    off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", shadow:"#111827" } // <- inactive
  }[tone] || { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" };

  return (
    <span
      title={label}
      style={{
        display:"inline-flex", alignItems:"center",
        padding:"6px 10px", marginRight:8, marginBottom:6,
        borderRadius:8, fontWeight:700, fontSize:12,
        background: palette.bg, color: palette.fg, border:`1px solid ${palette.bd}`,
        boxShadow: `0 0 10px ${palette.shadow}55`,
        opacity: active ? 1 : 0.45, filter: active ? "none" : "grayscale(40%)"
      }}
    >
      {label}
    </span>
  );
}

/* ---- signal definitions (order + legend text) ---- */
const SIGNAL_DEFS = [
  { key:"sigBreakout",     label:"Breakout",     desc:"Breadth positive (net NH > 0)" },
  { key:"sigDistribution", label:"Distribution", desc:"Breadth negative (net NH < 0)" },
  { key:"sigCompression",  label:"Compression",  desc:"Squeeze pressure ≥ 70" },
  { key:"sigExpansion",    label:"Expansion",    desc:"Squeeze pressure < 40" },
  { key:"sigOverheat",     label:"Overheat",     desc:"Momentum > 85 (danger > 92)" },
  { key:"sigTurbo",        label:"Turbo",        desc:"Momentum > 92 AND expansion" },
  { key:"sigDivergence",   label:"Divergence",   desc:"Momentum strong, breadth weak" },
  { key:"sigLowLiquidity", label:"Low Liquidity",desc:"Liquidity PSI < 40 (danger < 30)" },
];

/* ---- normalize signals: return ALL, not just active ---- */
function computeSignalList(sigObj = {}) {
  return SIGNAL_DEFS.map(def => {
    const s = sigObj?.[def.key];
    const active = !!(s?.active ?? s === true);
    const sev = String(s?.severity || "").toLowerCase();

    // tone mapping: danger > warn > ok; inactive -> off
    let tone = "off";
    if (active) {
      if (sev === "danger") tone = "danger";
      else if (sev === "warn") tone = "warn";
      else tone = "ok";
    }

    return { key: def.key, label: def.label, desc: def.desc, active, tone };
  });
}

/* ---- Row 3: Engine Lights (always render all pills) ---- */
export default function RowEngineLights() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  // last-good snapshot to avoid flicker on temporary empties
  const [lights, setLights] = useState(() => computeSignalList({}));
  const [stale, setStale] = useState(false);
  const firstPaintRef = useRef(false);

  useEffect(() => {
    // if data missing, keep last-good
    if (!data || typeof data !== "object") {
      if (firstPaintRef.current) setStale(true);
      return;
    }
    const list = computeSignalList(data.signals || {});
    setLights(list);
    setStale(false);
    firstPaintRef.current = true;
  }, [data]);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights">
      <div className="panel-head">
        <div className="panel-title">Engine Lights</div>
        <div className="spacer" />
        {stale && <span className="small muted">refreshing…</span>}
      </div>

      {/* status messages */}
      {!firstPaintRef.current && loading && <div className="small muted">Loading…</div>}
      {!firstPaintRef.current && error && <div className="small muted">Failed to load signals.</div>}

      {/* pills: always show ALL signals, inactive are dimmed */}
      <div style={{ display:"flex", flexWrap:"wrap", marginTop:8 }}>
        {lights.map((l) => (
          <Light key={l.key} label={l.label} tone={l.tone} active={l.active} />
        ))}
      </div>

      {/* legend */}
      <div style={{ marginTop:10 }}>
        <div className="small muted" style={{ marginBottom:6 }}>Legend</div>
        <div className="small" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:8 }}>
          {SIGNAL_DEFS.map(def => (
            <div key={def.key} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{
                display:"inline-block", width:10, height:10, borderRadius:3,
                background:"#0b0f17", border:"1px solid #1f2937"
              }} />
              <strong style={{ marginRight:6 }}>{def.label}:</strong>
              <span className="muted">{def.desc}</span>
            </div>
          ))}
        </div>
        <div className="small muted" style={{ marginTop:6 }}>
          Colors — <span style={{ color:"#22c55e" }}>Green</span>=active, <span style={{ color:"#facc15" }}>Yellow</span>=warn, <span style={{ color:"#f87171" }}>Red</span>=danger, Gray=inactive.
        </div>
      </div>
    </section>
  );
}
