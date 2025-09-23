// src/pages/rows/RowEngineLights.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

/* ------------------------------------------------------------------ */
/* Light pill (colored badge)                                          */
/* ------------------------------------------------------------------ */
function Light({ label, tone = "info", active = true }) {
  const palette =
    {
      ok:     { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", shadow:"#16a34a" }, // green
      warn:   { bg:"#facc15", fg:"#111827", bd:"#ca8a04", shadow:"#ca8a04" }, // yellow
      danger: { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", shadow:"#b91c1c" }, // red
      info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" }, // muted blue
      off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", shadow:"#111827" }, // dark/off
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
        opacity: active ? 1 : 0.45, filter: active ? "none" : "grayscale(40%)",
        transition: "opacity 120ms ease",
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
      <Swatch color="#22c55e" label="Breakout"         note="Market setting up for move (breadth + momentum strong)" />
      <Swatch color="#ef4444" label="Distribution"     note="Breadth negative, possible reversal" />
      <Swatch color="#facc15" label="Compression"      note="Squeeze ≥ 70, direction unclear" />
      <Swatch color="#22c55e" label="Expansion"        note="Post-squeeze ranges opening" />
      <Swatch color="#facc15" label="Overheat"         note="Momentum > 85 (danger > 92)" />
      <Swatch color="#22c55e" label="Turbo"            note="Momentum > 92 with expansion" />
      <Swatch color="#facc15" label="Divergence"       note="Momentum strong, breadth weak" />
      <Swatch color="#facc15" label="Low Liquidity"    note="PSI < 40 (danger < 30)" />
      <Swatch color="#ef4444" label="Volatility High"  note="Volatility > 70 (danger > 85)" />
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
/* Derive fallback signals from METRICS (preferred) then GAUGES        */
/* ------------------------------------------------------------------ */
function deriveFromMetricsOrGauges(source = {}) {
  // Prefer new metrics/*
  const m = source?.metrics || null;
  const g = source?.gauges  || null;

  // read from metrics
  let breadth    = Number(m?.breadth_pct);
  let momentum   = Number(m?.momentum_pct);
  let squeeze    = Number(m?.squeeze_intraday_pct);
  let liquidity  = Number(m?.liquidity_psi);
  let volatility = Number(m?.volatility_pct);

  // if metrics missing, read from legacy gauges
  if (!Number.isFinite(breadth)    && g?.rpm)    breadth    = Number(g.rpm.pct);
  if (!Number.isFinite(momentum)   && g?.speed)  momentum   = Number(g.speed.pct);
  if (!Number.isFinite(squeeze)    && g?.fuel)   squeeze    = Number(g.fuel.pct);
  if (!Number.isFinite(liquidity)  && g?.oil)    liquidity  = Number(g.oil.psi ?? g.oilPsi);
  if (!Number.isFinite(volatility) && g?.water)  volatility = Number(g.water.pct ?? g.volatilityPct);

  const out = {};
  const F = (x) => Number.isFinite(x);

  if (F(squeeze) && squeeze >= 70) out.sigCompression   = { active:true, severity:(squeeze>=85?"danger":"warn") };
  if (F(momentum) && momentum > 92 && F(squeeze) && squeeze < 70) out.sigTurbo = { active:true };
  if (F(momentum) && momentum > 85) out.sigOverheat     = { active:true, severity:(momentum>92?"danger":"warn") };
  if (F(breadth) && breadth < 40)   out.sigDistribution = { active:true };
  if (F(breadth) && F(squeeze) && breadth > 60 && squeeze < 70) out.sigBreakout = { active:true };
  if (F(squeeze) && squeeze < 40)   out.sigExpansion    = { active:true };
  if (F(momentum) && F(breadth) && momentum > 70 && breadth < 50) out.sigDivergence = { active:true };
  if (F(liquidity) && liquidity < 40) out.sigLowLiquidity = { active:true, severity:(liquidity<30?"danger":"warn") };
  if (F(volatility) && volatility > 70) out.sigVolatilityHigh = { active:true, severity:(volatility>85?"danger":"warn") };

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

  // Replay bridge
  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);
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

  // Choose source: replay → backend poll
  const source = (replayOn && replayData) ? replayData : (live || {});

  // Prefer the new backend section (engineLights) for timestamp + signals
  const eng = source?.engineLights || {};
  const backendSignals = eng?.signals || source?.signals || null;

  // Timestamp priority: engineLights.updatedAt → updated_at (AZ) → ts
  const ts =
    eng?.updatedAt ??
    source?.updated_at ??
    source?.ts ??
    null;

  // Live badge if backend marked it
  const isLive = !!eng?.live;
  const modeLabel = eng?.mode || null; // "intraday" | "daily" | "eod" (informational)

  // Compute lights whenever source changes
  useEffect(() => {
    if (!source || typeof source !== "object") {
      if (firstPaintRef.current) setStale(true);
      return;
    }

    // 1) Use backend signals if provided
    let list = null;
    if (backendSignals && typeof backendSignals === "object") {
      list = computeSignalList(backendSignals);
    }

    // 2) If no active signals from backend, derive from METRICS/GAUGES
    if (!list || !list.some(s => s.active)) {
      const derived = deriveFromMetricsOrGauges(source);
      list = computeSignalList(derived);
    }

    setLights(list);
    setStale(false);
    firstPaintRef.current = true;
  }, [source, backendSignals]);

  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights">
      {/* Header with Legend + status */}
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
        {/* LIVE badge if backend flagged it */}
        {isLive && (
          <span
            className="small"
            style={{
              marginRight:8, padding:"3px 8px", borderRadius:6,
              background:"#16a34a", color:"#0b1220", fontWeight:800, border:"1px solid #0f7a2a"
            }}
            title={modeLabel ? `Mode: ${modeLabel}` : "Live intraday"}
          >
            LIVE
          </span>
        )}
        <LastUpdated ts={ts} />
        {stale && <span className="small muted" style={{ marginLeft:8 }}>refreshing…</span>}
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
            onClick={(e)=> e.stopPropagation()}
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

      {/* Loading / error (first paint only) */}
      {!firstPaintRef.current && loading && (
        <div className="small muted" style={{ marginTop:6 }}>Loading…</div>
      )}
      {!firstPaintRef.current && error && (
        <div className="small muted" style={{ marginTop:6 }}>Failed to load signals.</div>
      )}
    </section>
  );
}
