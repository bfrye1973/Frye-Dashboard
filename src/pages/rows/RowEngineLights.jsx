// src/pages/rows/EngineLights.jsx
// v4.1 — Hybrid renderer (R11 + Legacy), strict /live binding, 30s poll

import React, { useEffect, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

/* ---------------- URLs ---------------- */
function resolveLiveIntraday() {
  const env = (process.env.REACT_APP_INTRADAY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const win = (typeof window !== "undefined" && window.__LIVE_INTRADAY_URL) ? String(window.__LIVE_INTRADAY_URL).trim() : "";
  if (win) return win.replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/intraday";
}
function guardLive(url) {
  return url.replace(/\/api\/live\//, "/live/").replace(/\/api\/?(\?|$)/, "/");
}

/* ---------------- Light pill ---------------- */
function Light({ label, tone = "info", active = true, title }) {
  const palette =
    {
      ok:     { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", sh:"#16a34a" },
      warn:   { bg:"#facc15", fg:"#111827", bd:"#ca8a04", sh:"#ca8a04" },
      danger: { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", sh:"#b91c1c" },
      info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", sh:"#334155" },
      off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", sh:"#111827" },
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
        transition: "opacity 120ms ease",
        whiteSpace:"nowrap"
      }}
    >
      {label}
    </span>
  );
}

/* ---------------- Signal dictionaries ---------------- */
// Legacy family (before R11)
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

// R11 core 10-minute family
const R11_CORE_DEF = [
  { k:"sigOverallBull",     label:"Overall Bull",     tone:()=>"ok" },
  { k:"sigOverallBear",     label:"Overall Bear",     tone:()=>"danger" },
  { k:"sigEMA10BullCross",  label:"EMA10 Bull Cross", tone:()=>"ok" },
  { k:"sigEMA10BearCross",  label:"EMA10 Bear Cross", tone:()=>"danger" },
  { k:"sigAccelUp",         label:"Accel Up",         tone:()=>"ok" },
  { k:"sigAccelDown",       label:"Accel Down",       tone:()=>"danger" },
  { k:"sigRiskOn",          label:"Risk-On",          tone:()=>"ok" },
  { k:"sigRiskOff",         label:"Risk-Off",         tone:()=>"danger" },
  { k:"sigSectorThrust",    label:"Sector Thrust",    tone:()=>"ok" },
  { k:"sigSectorWeak",      label:"Sector Weak",      tone:()=>"danger" },
];

// R11 NOW 5-minute sandbox family
const R11_NOW_DEF = [
  { k:"sigNowAccelUp",   label:"Now Accel Up",   tone:()=>"ok" },
  { k:"sigNowAccelDown", label:"Now Accel Down", tone:()=>"danger" },
  { k:"sigNowBull",      label:"Now Bull",       tone:()=>"ok" },
  { k:"sigNowBear",      label:"Now Bear",       tone:()=>"danger" },
];

/* ---------------- Render helpers ---------------- */
function toPills(defs, sigs) {
  return defs.map(({k,label,tone}) => {
    const s = sigs?.[k] || {};
    const active = !!s.active;
    const tn = active ? tone(s) : "off";
    const reason = (s.reason || "").trim();
    const when = s.lastChanged ? ` • ${new Date(s.lastChanged).toLocaleString()}` : "";
    const title = `${label} — ${active ? s.severity?.toUpperCase() || "ON" : "OFF"}${reason ? ` • ${reason}` : ""}${when}`;
    return { key:k, label, active, tone:tn, title };
  });
}

// family detector
function detectFamily(signals) {
  const keys = Object.keys(signals || {});
  const hasR11Core = keys.some(k => /^sig(Overall|EMA10|Accel|Risk|Sector)/.test(k));
  const hasR11Now  = keys.some(k => /^sigNow/.test(k));
  const hasLegacy  = keys.some(k => /^sig(Breakout|Distribution|Compression|Expansion|Overheat|Turbo|Divergence|LowLiquidity|VolatilityHigh)$/.test(k));
  return { hasR11Core, hasR11Now, hasLegacy };
}

/* --------------------------- Main ---------------------------- */
export default function EngineLights() {
  const LIVE_URL = resolveLiveIntraday();
  const [ts, setTs] = useState(null);
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState(null);
  const [signals, setSignals] = useState({});
  const [err, setErr] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const timerRef = useRef(null);

  async function fetchLive(abortSignal) {
    const url = guardLive(`${LIVE_URL}?t=${Date.now()}`);
    try {
      const res = await fetch(url, { cache: "no-store", signal: abortSignal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const j = await res.json();
      const eng = j?.engineLights || {};
      setSignals(eng?.signals || {});
      setTs(eng?.updatedAt || j?.updated_at || j?.ts || null);
      setLive(!!eng?.live);
      setMode(eng?.mode || null);
      setErr(null);
      try { console.log("[EngineLights] bound", { url, ts: eng?.updatedAt, keys: Object.keys(eng?.signals||{}) }); } catch {}
    } catch (e) {
      console.warn("[EngineLights] fetch failed:", e);
      setErr(String(e));
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchLive(ctrl.signal);
    timerRef.current = setInterval(() => fetchLive(ctrl.signal), 30_000);
    return () => { try { ctrl.abort(); } catch {} if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIVE_URL]);

  // build pill groups
  const fam = detectFamily(signals);
  const legacyPills = fam.hasLegacy   ? toPills(LEGACY_DEF,   signals) : [];
  const corePills   = fam.hasR11Core  ? toPills(R11_CORE_DEF, signals) : [];
  const nowPills    = fam.hasR11Now   ? toPills(R11_NOW_DEF,  signals) : [];

  // stable key to force repaint when any signal flips
  const stableKey = `${ts || "no-ts"}•${Object.entries(signals).map(([k,v])=>`${k}:${v?.active?1:0}-${v?.severity||""}`).join("|")}`;

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights" key={stableKey}>
      {/* Header */}
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Engine Lights</div>
        <button
          onClick={()=> setLegendOpen(true)}
          style={{ background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b", borderRadius:8, padding:"6px 10px", fontWeight:600, cursor:"pointer", marginLeft:8 }}
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

      {/* Pills */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {fam.hasR11Core && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {corePills.map(p => <Light key={p.key} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {fam.hasR11Now && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {nowPills.map(p => <Light key={p.key} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {fam.hasLegacy && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {legacyPills.map(p => <Light key={p.key} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {!fam.hasR11Core && !fam.hasR11Now && !fam.hasLegacy && (
          <div className="small muted">No signals present in payload.</div>
        )}
      </div>

      {/* Legend modal */}
      {legendOpen && (
        <div role="dialog" aria-modal="true" onClick={()=> setLegendOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }}>
          <div onClick={(e)=> e.stopPropagation()} style={{ width:"min(880px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b", borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)" }}>
            <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>Engine Lights — Legend</div>
            <p className="small muted" style={{ marginBottom:8 }}>
              This row auto-detects the signal family:
              <br/>• R11 Core (Overall/EMA10/Accel/Risk/Sector)
              <br/>• R11 NOW (5-min sandbox)
              <br/>• Legacy (Breakout/Distribution/…)
            </p>
            <div className="small muted">Hover a pill to see <em>reason</em> and <em>last changed</em>.</div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button onClick={()=> setLegendOpen(false)} style={{ background:"#eab308", color:"#111827", border:"none", borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
