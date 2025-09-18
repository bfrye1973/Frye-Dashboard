// src/pages/rows/RowEngineLights.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ---- pill component ---- */
function Light({ label, tone = "info", active = true }) {
  const palette = {
    ok:     { bg:"#064e3b", fg:"#d1fae5", bd:"#065f46", shadow:"#065f46" },
    warn:   { bg:"#5b4508", fg:"#fde68a", bd:"#a16207", shadow:"#a16207" },
    danger: { bg:"#7f1d1d", fg:"#fecaca", bd:"#b91c1c", shadow:"#b91c1c" },
    info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" },
    off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", shadow:"#111827" }
  }[tone] || { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" };

  return (
    <span
      title={label}
      style={{
        display:"inline-flex", alignItems:"center",
        padding:"6px 10px", marginRight:8,
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
  { key:"sigBreakout",       label:"Breakout",        desc:"Breadth positive (net NH > 0)" },
  { key:"sigDistribution",   label:"Distribution",    desc:"Breadth negative (net NH < 0)" },
  { key:"sigCompression",    label:"Compression",     desc:"Squeeze ≥ 70" },
  { key:"sigExpansion",      label:"Expansion",       desc:"Squeeze < 40" },
  { key:"sigOverheat",       label:"Overheat",        desc:"Momentum > 85 (danger > 92)" },
  { key:"sigTurbo",          label:"Turbo",           desc:"Momentum > 92 AND expansion" },
  { key:"sigDivergence",     label:"Divergence",      desc:"Momentum strong, breadth weak" },
  { key:"sigLowLiquidity",   label:"Low Liquidity",   desc:"PSI < 40 (danger < 30)" },
  { key:"sigVolatilityHigh", label:"Volatility High", desc:"Volatility > 70 (danger > 85)" },
];

/* ---- normalize signals: return ALL, not just active ---- */
function computeSignalList(sigObj = {}) {
  return SIGNAL_DEFS.map(def => {
    const s = sigObj?.[def.key];
    const active = !!(s?.active ?? s === true);
    const sev = String(s?.severity || "").toLowerCase();

    let tone = "off";
    if (active) {
      if (sev === "danger") tone = "danger";
      else if (sev === "warn") tone = "warn";
      else tone = "ok";
    }

    return { key: def.key, label: def.label, desc: def.desc, active, tone };
  });
}

/* ---- Row 3: Engine Lights (replay-aware) ---- */
export default function RowEngineLights() {
  // Live poll — unconditionally call the hook (rules of hooks)
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  // Local UI state
  const [lights, setLights] = useState(() => computeSignalList({}));
  const [stale, setStale] = useState(false);
  const firstPaintRef = useRef(false);

  // Replay bridge state for this row
  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);

  // Subscribe to Market Overview's replay event
  useEffect(() => {
    function onReplay(e) {
      const detail = e?.detail || {};
      const on = !!detail.on;
      setReplayOn(on);
      setReplayData(on ? (detail.data || null) : null);
    }
    window.addEventListener("replay:update", onReplay);
    return () => window.removeEventListener("replay:update", onReplay);
  }, []);

  // Choose the same source as the Market Overview row
  const source = (replayOn && replayData) ? replayData : live;

  // Derive lights from source
  useEffect(() => {
    if (!source || typeof source !== "object") {
      if (firstPaintRef.current) setStale(true);
      return;
    }
    const list = computeSignalList(source.signals || {});
    setLights(list);
    setStale(false);
    firstPaintRef.current = true;
  }, [source]);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights">
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Engine Lights</div>
        <div className="spacer" />
        {stale && <span className="small muted">refreshing…</span>}
      </div>

      <div
        style={{
          display:"flex",
          alignItems:"center",
          gap:12,
          overflow:"hidden",
          whiteSpace:"nowrap"
        }}
      >
        <div style={{ display:"flex", flexWrap:"nowrap", overflow:"hidden" }}>
          {lights.map((l) => (
            <Light key={l.key} label={l.label} tone={l.tone} active={l.active} />
          ))}
        </div>

        <span className="muted" style={{ opacity:0.6 }}>•</span>

        <div
          className="small muted"
          style={{ overflow:"hidden", textOverflow:"ellipsis", flex:1, minWidth:120 }}
          title={SIGNAL_DEFS.map(d => `${d.label}: ${d.desc}`).join("  |  ")}
        >
          {SIGNAL_DEFS.map((d, i) => (
            <span key={d.key} style={{ marginRight:10 }}>
              <strong>{d.label}</strong>: {d.desc}
              {i < SIGNAL_DEFS.length - 1 ? "  |  " : ""}
            </span>
          ))}
        </div>
      </div>

      {!firstPaintRef.current && loading && (
        <div className="small muted" style={{ marginTop:6 }}>Loading…</div>
      )}
      {!firstPaintRef.current && error && (
        <div className="small muted" style={{ marginTop:6 }}>Failed to load signals.</div>
      )}
    </section>
  );
}
