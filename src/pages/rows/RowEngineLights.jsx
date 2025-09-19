// src/pages/rows/RowEngineLights.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

/* ------------------------------------------------------------------ */
/* Light pill (colored badge)                                          */
/* ------------------------------------------------------------------ */
function Light({ label, tone = "info", active = true }) {
  const palette = {
    ok:     { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", shadow:"#16a34a" }, // green
    warn:   { bg:"#facc15", fg:"#111827", bd:"#ca8a04", shadow:"#ca8a04" }, // yellow
    danger: { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", shadow:"#b91c1c" }, // red
    info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" }, // muted blue
    off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", shadow:"#111827" }  // dark/off
  }[tone] || { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", shadow:"#111827" };

  return (
    <span
      title={label}
      style={{
        display:"inline-flex", alignItems:"center",
        padding:"6px 10px", marginRight:8,
        borderRadius:8, fontWeight:700, fontSize:12,
        background: palette.bg, color: palette.fg, border:`1px solid ${palette.bd}`,
        boxShadow: `0 0 10px ${palette.shadow}55`,
        opacity: active ? 1 : 0.45,
        filter: active ? "none" : "grayscale(40%)"
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Legend content (modal body)                                         */
/* ------------------------------------------------------------------ */
function Swatch({ color, label, note }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
      <span style={{
        width:36, height:12, borderRadius:12, background:color,
        display:"inline-block", border:"1px solid rgba(255,255,255,0.1)"
      }} />
      <span style={{ color:"#e5e7eb", fontSize:12, fontWeight:700 }}>{label}</span>
      <span style={{ color:"#cbd5e1", fontSize:12 }}>— {note}</span>
    </div>
  );
}

function EngineLightsLegendContent(){
  return (
    <div>
      <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>
        Engine Lights — Legend
      </div>
      <Swatch color="#22c55e" label="Breakout" note="Market setting up for move." />
      <Swatch color="#ef4444" label="Distribution" note="Breadth negative, possible reversal." />
      <Swatch color="#facc15" label="Compression" note="Squeeze ≥ 70, direction unclear." />
      <Swatch color="#22c55e" label="Expansion" note="Ranges expanding." />
      <Swatch color="#facc15" label="Overheat" note="Momentum > 85." />
      <Swatch color="#ef4444" label="Overheat Danger" note="Momentum > 92." />
      <Swatch color="#22c55e" label="Turbo" note="Momentum + Expansion together." />
      <Swatch color="#facc15" label="Divergence" note="Momentum strong, breadth weak." />
      <Swatch color="#facc15" label="Low Liquidity" note="Liquidity < 40." />
      <Swatch color="#ef4444" label="Liquidity Danger" note="Liquidity < 30." />
      <Swatch color="#facc15" label="Volatility Warn" note="Volatility > 70." />
      <Swatch color="#ef4444" label="Volatility Danger" note="Volatility > 85." />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signal definitions                                                  */
/* ------------------------------------------------------------------ */
const SIGNAL_DEFS = [
  { key:"sigBreakout",       label:"Breakout",        desc:"Market ready to move" },
  { key:"sigDistribution",   label:"Distribution",    desc:"Breadth negative, possible reversal" },
  { key:"sigCompression",    label:"Compression",     desc:"Squeeze ≥ 70 — direction unclear" },
  { key:"sigExpansion",      label:"Expansion",       desc:"Post-squeeze ranges opening" },
  { key:"sigOverheat",       label:"Overheat",        desc:"Momentum > 85 (danger > 92)" },
  { key:"sigTurbo",          label:"Turbo",           desc:"Momentum > 92 with expansion" },
  { key:"sigDivergence",     label:"Divergence",      desc:"Momentum strong, breadth weak" },
  { key:"sigLowLiquidity",   label:"Low Liquidity",   desc:"PSI < 40 (danger < 30)" },
  { key:"sigVolatilityHigh", label:"Volatility High", desc:"Volatility > 70 (danger > 85)" },
];

/* ------------------------------------------------------------------ */
/* Tone mapping                                                        */
/* ------------------------------------------------------------------ */
function computeSignalList(sigObj = {}) {
  return SIGNAL_DEFS.map(def => {
    const sig = sigObj?.[def.key] || {};
    const active = !!(sig.active ?? sig === true);
    const sev = String(sig.severity || "").toLowerCase();

    let tone = "off";
    if (active) {
      switch (def.key) {
        case "sigBreakout":        tone = "ok";     break;
        case "sigDistribution":    tone = "danger"; break;
        case "sigCompression":     tone = "warn";   break;
        case "sigExpansion":       tone = "ok";     break;
        case "sigOverheat":        tone = (sev === "danger") ? "danger" : "warn"; break;
        case "sigTurbo":           tone = "ok";     break;
        case "sigDivergence":      tone = "warn";   break;
        case "sigLowLiquidity":    tone = (sev === "danger") ? "danger" : "warn"; break;
        case "sigVolatilityHigh":  tone = (sev === "danger") ? "danger" : "warn"; break;
        default:                   tone = "ok";     break;
      }
    }
    return { key:def.key, label:def.label, desc:def.desc, active, tone };
  });
}

/* ------------------------------------------------------------------ */
/* Derive fallback signals from gauges (when backend signals missing) */
/* ------------------------------------------------------------------ */
function deriveSignalsFromGauges(g = {}) {
  const out = {};
  const squeeze = g?.fuel?.pct ?? 0;
  const momentum = g?.speed?.pct ?? 50;
  const breadth = g?.rpm?.pct ?? 50;
  const liquidity = g?.oil?.psi ?? 100;
  const volatility = g?.water?.pct ?? 20;

  if (squeeze >= 70) out.sigCompression = { active:true, severity:"warn" };
  if (momentum > 85) out.sigOverheat = { active:true, severity:(momentum>92?"danger":"warn") };
  if (momentum > 92 && squeeze < 70) out.sigTurbo = { active:true };
  if (breadth > 60 && squeeze < 70) out.sigBreakout = { active:true };
  if (breadth < 40) out.sigDistribution = { active:true };
  if (squeeze < 40) out.sigExpansion = { active:true };
  if (momentum > 70 && breadth < 50) out.sigDivergence = { active:true };
  if (liquidity < 40) out.sigLowLiquidity = { active:true, severity:(liquidity<30?"danger":"warn") };
  if (volatility > 70) out.sigVolatilityHigh = { active:true, severity:(volatility>85?"danger":"warn") };

  return out;
}

/* ------------------------------------------------------------------ */
/* Main Row Component                                                  */
/* ------------------------------------------------------------------ */
export default function RowEngineLights() {
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  const [lights, setLights] = useState(() => computeSignalList({}));
  const [stale, setStale] = useState(false);
  const firstPaintRef = useRef(false);

  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);

  const [legendOpen, setLegendOpen] = useState(false);

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

  // Prefer liveIntraday if available
  const source = (replayOn && replayData) ? replayData : (live?.liveIntraday || live || {});
  const ts =
    source?.engineLights?.updatedAt ??
    source?.marketMeter?.updatedAt ??
    source?.meta?.ts ??
    source?.updated_at ??
    source?.ts ??
    null;

  useEffect(() => {
    if (!source || typeof source !== "object") {
      if (firstPaintRef.current) setStale(true);
      return;
    }
    const backendList = computeSignalList(source?.signals || {});
    let list = backendList;

    const hasActive = backendList.some(s => s.active);
    const gauges = source?.gauges;
    if (!hasActive && gauges) {
      const derived = deriveSignalsFromGauges(gauges);
      list = computeSignalList(derived);
    }

    setLights(list);
    setStale(false);
    firstPaintRef.current = true;
  }, [source]);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights">
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Engine Lights</div>
        <button
          onClick={()=> setLegendOpen(true)}
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
        {stale && <span className="small muted" style={{ marginLeft:8 }}>refreshing…</span>}
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:12, overflow:"hidden", whiteSpace:"nowrap" }}>
        <div style={{ display:"flex", flexWrap:"nowrap", overflow:"hidden" }}>
          {lights.map(l => (
            <Light key={l.key} label={l.label} tone={l.tone} active={l.active} />
          ))}
        </div>
      </div>

      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={()=> setLegendOpen(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:60
          }}
        >
          <div
            onClick={(e)=> e.stopPropagation() }
            style={{
              width:"min(880px, 92vw)", background:"#0b0b0c",
              border:"1px solid #2b2b2b", borderRadius:12, padding:16,
              boxShadow:"0 10px 30px rgba(0,0,0,0.35)"
            }}
          >
            <EngineLightsLegendContent />
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button
                onClick={()=> setLegendOpen(false)}
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
      )}

      {!firstPaintRef.current && loading && (
        <div className="small muted" style={{ marginTop:6 }}>Loading…</div>
      )}
      {!firstPaintRef.current && error && (
        <div className="small muted" style={{ marginTop:6 }}>Failed to load signals.</div>
      )}
    </section>
  );
}
