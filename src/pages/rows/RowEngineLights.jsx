// src/pages/rows/EngineLights.jsx
// v6.0 — Stable/compact Engine Lights row (10m pills + NOW + Legacy; 1h timestamp chip)
// - No TrendCard / TrendRow (prevents undefined build errors)
// - No runtime process.env usage (guarded fallbacks)
// - Lux colors (ok=green, danger=red, warn=amber)
// - One section (row-3) only; compact vertical stack

import React, { useEffect, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

/* ---------------- URL helpers (safe, no process.env at runtime) ---------------- */
function safeEnv(name) {
  try {
    // some bundlers replace process.env at build time; this keeps us from crashing at runtime
    // if it's not injected.
    // eslint-disable-next-line no-undef
    return (typeof process !== "undefined" && process.env && process.env[name]) || "";
  } catch {
    return "";
  }
}
function resolveLiveIntraday() {
  const env = (safeEnv("REACT_APP_INTRADAY_URL") || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const win = (typeof window !== "undefined" && window.__LIVE_INTRADAY_URL) ? String(window.__LIVE_INTRADAY_URL).trim() : "";
  if (win) return win.replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/intraday";
}
function resolveLiveHourly() {
  const env = (safeEnv("REACT_APP_HOURLY_URL") || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const win = (typeof window !== "undefined" && window.__LIVE_HOURLY_URL) ? String(window.__LIVE_HOURLY_URL).trim() : "";
  if (win) return win.replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/hourly";
}
function guardLive(url) {
  return url.replace(/\/api\/live\//, "/live/").replace(/\/api\/?(\?|$)/, "/");
}

/* ---------------- Light pill (Lux palette) ---------------- */
function Light({ label, tone = "info", active = true, title }) {
  const palette =
    {
      ok:     { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", sh:"#16a34a" },  // green
      warn:   { bg:"#facc15", fg:"#111827", bd:"#ca8a04", sh:"#ca8a04" },  // amber
      danger: { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", sh:"#b91c1c" },  // red
      info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", sh:"#334155" },  // blue
      off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", sh:"#111827" },  // muted
    }[tone] || { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", sh:"#111827" };

  return (
    <span
      title={title || label}
      style={{
        display:"inline-flex", alignItems:"center",
        padding:"6px 10px", marginRight:8,
        borderRadius:8, fontWeight:700, fontSize:12,
        background: palette.bg, color: palette.fg, border:`1px solid ${palette.bd}`,
        boxShadow: `0 0 10px ${palette.sh}55`,
        opacity: active ? 1 : 0.45, filter: active ? "none" : "grayscale(40%)",
        transition: "opacity 120ms ease", whiteSpace:"nowrap"
      }}
    >
      {label}
    </span>
  );
}

/* ---------------- Families ---------------- */
const LEGACY_DEF = [
  { k:"sigBreakout",       label:"Breakout",         tone:(s)=> s.severity==="danger"?"danger":"ok" },
  { k:"sigDistribution",   label:"Distribution",     tone:()=>"danger" },
  { k:"sigCompression",    label:"Compression",      tone:()=>"warn" },
  { k:"sigExpansion",      label:"Expansion",        tone:()=>"ok" },
  { k:"sigOverheat",       label:"Overheat",         tone:(s)=> s.severity==="danger"?"danger":"warn" },
  { k:"sigTurbo",          label:"Turbo",            tone:()=>"ok" },
  { k:"sigDivergence",     label:"Divergence",       tone:()=>"warn" },
  { k:"sigLowLiquidity",   label:"Low Liquidity",    tone:(s)=> s.severity==="danger"?"danger":"warn" },
  { k:"sigVolatilityHigh", label:"Volatility High",  tone:(s)=> s.severity==="danger"?"danger":"warn" },
];

const CORE_10M_DEF = [
  { k:"sigOverallBull",     label:"Overall Bull",     tone:()=>"ok" },
  { k:"sigOverallBear",     label:"Overall Bear",     tone:()=>"danger" },
  { k:"sigEMA10BullCross",  label:"EMA10 Bull Cross", tone:()=>"ok" },
  { k:"sigEMA10BearCross",  label:"EMA10 Bear Cross", tone:()=>"danger" },
  { k:"sigEMA10BullCrossEarlyWarn", label:"EMA10 Bull ⚠", tone:()=>"warn" },
  { k:"sigEMA10BearCrossEarlyWarn", label:"EMA10 Bear ⚠", tone:()=>"warn" },
  { k:"sigAccelUp",         label:"Accel Up",         tone:()=>"ok" },
  { k:"sigAccelDown",       label:"Accel Down",       tone:()=>"danger" },
  { k:"sigRiskOn",          label:"Risk-On",          tone:()=>"ok" },
  { k:"sigRiskOff",         label:"Risk-Off",         tone:()=>"danger" },
  { k:"sigSectorThrust",    label:"Sector Thrust",    tone:()=>"ok" },
  { k:"sigSectorWeak",      label:"Sector Weak",      tone:()=>"danger" },
];

const NOW_5M_DEF = [
  { k:"sigNowAccelUp",   label:"Now Accel Up",   tone:()=>"ok" },
  { k:"sigNowAccelDown", label:"Now Accel Down", tone:()=>"danger" },
  { k:"sigNowBull",      label:"Now Bull",       tone:()=>"ok" },
  { k:"sigNowBear",      label:"Now Bear",       tone:()=>"danger" },
];

function toPills(defs, sigs) {
  return defs.map(({k,label,tone}) => {
    const s = sigs?.[k] || {};
    const active = !!s.active;
    const tn = active ? tone(s) : "off";
    const reason = (s.reason || "").trim();
    const when = s.lastChanged ? ` • ${new Date(s.lastChanged).toLocaleString()}` : "";
    const title = `${label} — ${active ? (s.severity?.toUpperCase() || "ON") : "OFF"}${reason ? ` • ${reason}` : ""}${when}`;
    return { key:k, label, active, tone:tn, title };
  });
}
function detectFamily(signals) {
  const keys = Object.keys(signals || {});
  const hasCore = keys.some(k => /^sig(Overall(Bull|Bear)|EMA10|Accel(Up|Down)|Risk(On|Off)|Sector(Thrust|Weak))/.test(k));
  const hasNow  = keys.some(k => /^sigNow/.test(k));
  const hasLeg  = keys.some(k => /^sig(Breakout|Distribution|Compression|Expansion|Overheat|Turbo|Divergence|LowLiquidity|VolatilityHigh)$/.test(k));
  return { hasCore, hasNow, hasLeg };
}

/* ---------------- Component ---------------- */
export default function EngineLights() {
  const LIVE10 = resolveLiveIntraday();
  const LIVE1H = resolveLiveHourly();

  const [ts10, setTs10] = useState(null);
  const [ts1h, setTs1h] = useState(null);
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState(null);
  const [signals, setSignals] = useState({});
  const [err, setErr] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const poll10Ref = useRef(null);
  const poll1hRef = useRef(null);

  async function fetch10m(abortSignal) {
    try {
      const res = await fetch(guardLive(`${LIVE10}?t=${Date.now()}`), { cache:"no-store", signal:abortSignal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const eng = j?.engineLights || {};
      setSignals(eng?.signals || {});
      setTs10(eng?.updatedAt || j?.updated_at || j?.ts || null);
      setLive(!!eng?.live);
      setMode(eng?.mode || null);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
  }
  async function fetch1h(abortSignal) {
    try {
      const res = await fetch(guardLive(`${LIVE1H}?t=${Date.now()}`), { cache:"no-store", signal:abortSignal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setTs1h(j?.updated_at || j?.updated_at_utc || j?.ts || null);
    } catch {}
  }

  useEffect(() => {
    const c10 = new AbortController(); const c1h = new AbortController();
    fetch10m(c10.signal);    fetch1h(c1h.signal);
    poll10Ref.current = setInterval(() => fetch10m(c10.signal), 30_000);
    poll1hRef.current = setInterval(() => fetch1h(c1h.signal), 60_000);
    return () => { try { c10.abort(); c1h.abort(); } catch {} if (poll10Ref.current) clearInterval(poll10Ref.current); if (poll1hRef.current) clearInterval(poll1hRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIVE10, LIVE1H]);

  const fam = detectFamily(signals);
  const corePills = fam.hasCore ? toPills(CORE_10M_DEF, signals) : [];
  const nowPills  = fam.hasNow  ? toPills(NOW_5M_DEF,  signals) : [];
  const legPills  = fam.hasLeg  ? toPills(LEGACY_DEF,   signals) : [];

  const stableKey = `${ts10 || "no-ts"}•${Object.entries(signals).map(([k,v])=>`${k}:${v?.active?1:0}-${v?.severity||""}`).join("|")}`;

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights" key={stableKey}>
      {/* Header: compact; timestamps left */}
      <div className="panel-head" style={{ alignItems:"center", gap:8 }}>
        <div className="panel-title">Engine Lights</div>
        <button onClick={()=> setLegendOpen(true)} style={{ background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b", borderRadius:8, padding:"6px 10px", fontWeight:600, cursor:"pointer", marginLeft:8 }}>Legend</button>
        <div className="spacer" />
        {live && (
          <span className="small" style={{ marginRight:8, padding:"3px 8px", borderRadius:6, background:"#16a34a", color:"#0b1220", fontWeight:800, border:"1px solid #0f7a2a" }}>LIVE</span>
        )}
        <span className="small muted" style={{ marginRight:12 }}><strong>10m:</strong> <LastUpdated ts={ts10} /></span>
        <span className="small muted"><strong>1h:</strong> <LastUpdated ts={ts1h} /></span>
      </div>

      {/* Pill rows: compact vertical stack */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {fam.hasCore && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {corePills.map(p => <Light key={p.key} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {fam.hasNow && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {nowPills.map(p => <Light key={p.key} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {fam.hasLeg && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {legPills.map(p => <Light key={p.key} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {!fam.hasCore && !fam.hasNow && !fam.hasLeg && (
          <div className="small muted">No signals present in payload.</div>
        )}
      </div>

      {/* Legend */}
      {legendOpen && (
        <div role="dialog" aria-modal="true" onClick={()=> setLegendOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }}>
          <div onClick={(e)=> e.stopPropagation()} style={{ width:"min(880px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b", borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)" }}>
            <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>Engine Lights — Legend</div>
            <div className="small muted">10m Core, NOW (5m), and Legacy families are auto-detected. Colors are Lux-aligned: green=ok, red=danger, amber=warn.</div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button onClick={()=> setLegendOpen(false)} style={{ background:"#eab308", color:"#111827", border:"none", borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
