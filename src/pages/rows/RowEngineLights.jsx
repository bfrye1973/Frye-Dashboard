// src/pages/rows/EngineLights.jsx
// v3.0 — Strict /live binding from FRONTEND env (no /api), 30s poll, guard fixer
// Source of truth: REACT_APP_INTRADAY_URL → engineLights.signals

import React, { useEffect, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

/* -------------------------- helpers -------------------------- */
// Read /live/intraday from FRONTEND env (never from /api)
function resolveLiveIntraday() {
  const env = (process.env.REACT_APP_INTRADAY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  // Optional global override if you use window.__LIVE_INTRADAY_URL
  const win = (typeof window !== "undefined" && window.__LIVE_INTRADAY_URL) ? String(window.__LIVE_INTRADAY_URL).trim() : "";
  if (win) return win.replace(/\/+$/, "");
  // Hard fallback (safe default)
  return "https://frye-market-backend-1.onrender.com/live/intraday";
}

// If someone accidentally prepends /api, fix it at runtime.
function guardLive(url) {
  return url
    .replace(/\/api\/live\//, "/live/")
    .replace(/\/api\/?(\?|$)/, "/"); // drop trailing /api
}

/* -------------------------- Light pill --------------------------- */
function Light({ label, tone = "info", active = true }) {
  const palette =
    {
      ok:     { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", shadow:"#16a34a" },
      warn:   { bg:"#facc15", fg:"#111827", bd:"#ca8a04", shadow:"#ca8a04" },
      danger: { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", shadow:"#b91c1c" },
      info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" },
      off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", shadow:"#111827" },
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

/* --------------------- Legend --------------------- */
function Swatch({ color, label, note }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
      <span style={{ width:36, height:12, borderRadius:12, background:color, display:"inline-block", border:"1px solid rgba(255,255,255,0.1)" }} />
      <span style={{ color:"#e5e7eb", fontSize:12, fontWeight:700 }}>{label}</span>
      <span style={{ color:"#cbd5e1", fontSize:12 }}>— {note}</span>
    </div>
  );
}

function EngineLightsLegendContent(){
  return (
    <div>
      <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>Engine Lights — Legend</div>
      <Swatch color="#22c55e" label="Breakout"         note="Market setting up for move" />
      <Swatch color="#ef4444" label="Distribution"     note="Breadth negative, possible reversal" />
      <Swatch color="#facc15" label="Compression"      note="Squeeze ≥ 70 — direction unclear" />
      <Swatch color="#22c55e" label="Expansion"        note="Post-squeeze ranges opening" />
      <Swatch color="#facc15" label="Overheat"         note="Momentum > 85 (danger > 92)" />
      <Swatch color="#22c55e" label="Turbo"            note="Momentum > 92 with expansion" />
      <Swatch color="#facc15" label="Divergence"       note="Momentum strong, breadth weak" />
      <Swatch color="#facc15" label="Low Liquidity"    note="PSI < 40 (danger < 30)" />
      <Swatch color="#ef4444" label="Volatility High"  note="Volatility > 70 (danger > 85)" />
    </div>
  );
}

/* --------------------- Signal defs & tone --------------------- */
const SIGNAL_DEFS = [
  { key:"sigBreakout",       label:"Breakout" },
  { key:"sigDistribution",   label:"Distribution" },
  { key:"sigCompression",    label:"Compression" },
  { key:"sigExpansion",      label:"Expansion" },
  { key:"sigOverheat",       label:"Overheat" },
  { key:"sigTurbo",          label:"Turbo" },
  { key:"sigDivergence",     label:"Divergence" },
  { key:"sigLowLiquidity",   label:"Low Liquidity" },
  { key:"sigVolatilityHigh", label:"Volatility High" },
];

function computeSignalList(sigObj = {}) {
  return SIGNAL_DEFS.map(def => {
    const sig = sigObj?.[def.key] || {};
    const active = !!sig.active;
    const sev = String(sig.severity || "").toLowerCase();
    let tone = "off";
    if (active) {
      switch (def.key) {
        case "sigBreakout":        tone = sev === "danger" ? "danger" : "ok"; break;
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
    return { key:def.key, label:def.label, active, tone };
  });
}

function buildStableKey(ts, signals) {
  const parts = [ts || "no-ts"];
  try {
    const sigSig = Object.entries(signals || {})
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([k,v]) => `${k}:${(v?.active?1:0)}-${(v?.severity||"")}`)
      .join("|");
    parts.push(sigSig);
  } catch {}
  return parts.join("•");
}

/* --------------------------- Main ---------------------------- */
export default function EngineLights() {
  const LIVE_URL = resolveLiveIntraday();

  const [payload, setPayload] = useState({ eng: null, signals: {}, ts: null, live: false, mode: null, err: null });
  const [lights, setLights] = useState(() => computeSignalList({}));
  const [legendOpen, setLegendOpen] = useState(false);
  const timerRef = useRef(null);

  async function fetchLive(abortSignal) {
    // Always call /live — NEVER /api
    const url = guardLive(`${LIVE_URL}?t=${Date.now()}`);
    try {
      const res = await fetch(url, { cache: "no-store", signal: abortSignal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const j = await res.json();

      const eng = j?.engineLights || {};
      const signals = (eng?.signals && typeof eng.signals === "object") ? eng.signals : {};
      const ts = eng?.updatedAt || j?.updated_at || j?.ts || null;
      const live = !!eng?.live;
      const mode = eng?.mode || null;

      // Debug once per tick
      try { console.log("[EngineLights] bound", { url, ts, keys: Object.keys(signals) }); } catch {}

      setPayload({ eng, signals, ts, live, mode, err: null });
      setLights(computeSignalList(signals));
    } catch (e) {
      console.warn("[EngineLights] fetch failed:", e);
      setPayload(p => ({ ...p, err: String(e) }));
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchLive(ctrl.signal);
    // 30s poll so the row feels live for scalping
    timerRef.current = setInterval(() => fetchLive(ctrl.signal), 30_000);
    return () => {
      try { ctrl.abort(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIVE_URL]);

  const { ts, live, mode, signals, err } = payload;
  const stableKey = buildStableKey(ts, signals);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights" key={stableKey}>
      {/* Header */}
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
        {live && (
          <span
            className="small"
            style={{ marginRight:8, padding:"3px 8px", borderRadius:6, background:"#16a34a", color:"#0b1220", fontWeight:800, border:"1px solid #0f7a2a" }}
            title={mode ? `Mode: ${mode}` : "Live intraday"}
          >
            LIVE
          </span>
        )}
        <LastUpdated ts={ts} />
        {err && <span className="small muted" style={{ marginLeft:8 }} title={err}>fetch error</span>}
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
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }}
        >
          <div
            onClick={(e)=> e.stopPropagation()}
            style={{ width:"min(880px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b", borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)" }}
          >
            <EngineLightsLegendContent />
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button
                onClick={()=> setLegendOpen(false)}
                style={{ background:"#eab308", color:"#111827", border:"none", borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
