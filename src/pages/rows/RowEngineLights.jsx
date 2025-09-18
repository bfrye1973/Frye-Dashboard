// src/pages/rows/RowEngineLights.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

/* -------------------------------- Pills -------------------------------- */
function Light({ label, tone = "info", active = true }) {
  const palette = {
    ok:     { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", shadow:"#16a34a" },
    warn:   { bg:"#facc15", fg:"#111827", bd:"#ca8a04", shadow:"#ca8a04" },
    danger: { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", shadow:"#b91c1c" },
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

/* ---------------------------- Legend content ---------------------------- */
function LegendRow({ color, label, note }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
      <span style={{ width:36, height:12, borderRadius:12, background:color, display:"inline-block", border:"1px solid rgba(255,255,255,0.1)" }} />
      <span style={{ color:"#e5e7eb", fontSize:12, fontWeight:700 }}>{label}</span>
      <span style={{ color:"#cbd5e1", fontSize:12 }}> - {note}</span>
    </div>
  );
}

function EngineLightsLegendContent(){
  return (
    <div>
      <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>
        Engine Lights - Legend
      </div>
      <LegendRow color="#22c55e" label="Breakout"         note="Setup forming; breadth positive" />
      <LegendRow color="#ef4444" label="Distribution"     note="Breadth negative; possible turn" />
      <LegendRow color="#facc15" label="Compression"      note="Squeeze >= 70" />
      <LegendRow color="#22c55e" label="Expansion"        note="Post-squeeze ranges opening" />
      <LegendRow color="#facc15" label="Overheat (Warn)"  note="Momentum > 85" />
      <LegendRow color="#ef4444" label="Overheat (Danger)" note="Momentum > 92" />
      <LegendRow color="#22c55e" label="Turbo"            note="Momentum + expansion together" />
      <LegendRow color="#facc15" label="Divergence"       note="Momentum up, breadth weak" />
      <LegendRow color="#facc15" label="Low Liquidity"    note="PSI < 40 (danger < 30)" />
      <LegendRow color="#facc15" label="Volatility High"  note="Volatility > 70 (danger > 85)" />
    </div>
  );
}

/* ------------------------------ Signal defs ------------------------------ */
const SIGNAL_DEFS = [
  { key:"sigBreakout",       label:"Breakout" },
  { key:"sigDistribution",   label:"Distribution" },
  { key:"sigCompression",    label:"Compression" },
  { key:"sigExpansion",      label:"Expansion" },
  { key:"sigOverheat",       label:"Overheat" },
  { key:"sigTurbo",          label:"Turbo" },
  { key:"sigDivergence",     label:"Divergence" },
  { key:"sigLowLiquidity",   label:"Low Liquidity" },
  { key:"sigVolatilityHigh", label:"Volatility High" }
];

function computeSignalList(sigObj) {
  return SIGNAL_DEFS.map(def => {
    const sig = (sigObj && sigObj[def.key]) || {};
    const active = !!(sig.active || sig === true);
    const sev = String(sig.severity || "").toLowerCase();
    let tone = "off";
    if (active) {
      switch (def.key) {
        case "sigBreakout":       tone = "ok"; break;
        case "sigDistribution":   tone = "danger"; break;
        case "sigCompression":    tone = "warn"; break;
        case "sigExpansion":      tone = "ok"; break;
        case "sigOverheat":       tone = (sev === "danger") ? "danger" : "warn"; break;
        case "sigTurbo":          tone = "ok"; break;
        case "sigDivergence":     tone = "warn"; break;
        case "sigLowLiquidity":   tone = (sev === "danger") ? "danger" : "warn"; break;
        case "sigVolatilityHigh": tone = (sev === "danger") ? "danger" : "warn"; break;
        default:                  tone = "ok";
      }
    }
    return { key: def.key, label: def.label, active, tone };
  });
}

/* ------------------------------ Main component ------------------------------ */
export default function RowEngineLights() {
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  const [lights, setLights] = useState(() => computeSignalList({}));
  const [stale, setStale] = useState(false);
  const firstPaintRef = useRef(false);

  // Replay bridge
  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);

  // Legend modal
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    function onReplay(e) {
      const detail = e && e.detail ? e.detail : {};
      const on = !!detail.on;
      setReplayOn(on);
      setReplayData(on ? (detail.data || null) : null);
    }
    window.addEventListener("replay:update", onReplay);
    return () => window.removeEventListener("replay:update", onReplay);
  }, []);

  // Choose source (snapshot vs live)
  const source = (replayOn && replayData) ? replayData : live;

  // NEW: section-specific timestamp from backend
  const ts = (source && source.engineLights && source.engineLights.updatedAt)
    || (source && source.meta && source.meta.ts)
    || (source && source.ts)
    || null;

  // Compute row lights
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
      {/* Header */}
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Engine Lights</div>
        <button
          onClick={() => setLegendOpen(true)}
          style={{
            background:"#0b0b0b", color:"#e5e7eb",
            border:"1px solid #2b2b2b", borderRadius:8,
            padding:"6px 10px", fontWeight:600, cursor:"pointer", marginLeft:8
          }}
          title="Legend"
        >
          Legend
        </button>
        <div className="spacer" />
        <LastUpdated ts={ts} />
        {stale ? <span className="small muted" style={{ marginLeft:8 }}>refreshing...</span> : null}
      </div>

      {/* Lights row */}
      <div style={{ display:"flex", alignItems:"center", gap:12, overflow:"hidden", whiteSpace:"nowrap" }}>
        <div style={{ display:"flex", flexWrap:"nowrap", overflow:"hidden" }}>
          {lights.map(l => (
            <Light key={l.key} label={l.label} tone={l.tone} active={l.active} />
          ))}
        </div>
      </div>

      {/* Legend modal */}
      {legendOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLegendOpen(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:60
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width:"min(880px, 92vw)", background:"#0b0b0c",
              border:"1px solid #2b2b2b", borderRadius:12, padding:16,
              boxShadow:"0 10px 30px rgba(0,0,0,0.35)"
            }}
          >
            <EngineLightsLegendContent />
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button
                onClick={() => setLegendOpen(false)}
                style={{
                  background:"#eab308", color:"#111827", border:"none",
                  borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* First-paint status */}
      {!firstPaintRef.current && loading ? (
        <div className="small muted" style={{ marginTop:6 }}>Loading...</div>
      ) : null}
      {!firstPaintRef.current && error ? (
        <div className="small muted" style={{ marginTop:6 }}>Failed to load signals.</div>
      ) : null}
    </section>
  );
}
