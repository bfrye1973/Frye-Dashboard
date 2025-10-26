// src/pages/rows/EngineLights.jsx
// v6.0 — Lux-aligned tones (green/purple/red), 10m + 1h timestamps, all families

import React, { useEffect, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

/* ---------------- URL helpers ---------------- */
function resolveLiveIntraday() {
  const env = (process.env.REACT_APP_INTRADAY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const win =
    typeof window !== "undefined" && window.__LIVE_INTRADAY_URL
      ? String(window.__LIVE_INTRADAY_URL).trim()
      : "";
  if (win) return win.replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/intraday";
}
function resolveLiveHourly() {
  const env = (process.env.REACT_APP_HOURLY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const win =
    typeof window !== "undefined" && window.__LIVE_HOURLY_URL
      ? String(window.__LIVE_HOURLY_URL).trim()
      : "";
  if (win) return win.replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/hourly";
}
function guardLive(url) {
  return url.replace(/\/api\/live\//, "/live/").replace(/\/api\/?(\?|$)/, "/");
}

/* ---------------- Lux colors ---------------- */
const LUX_COLORS = {
  green:  { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", sh:"#16a34a" },  // bullish / expansion
  red:    { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", sh:"#b91c1c" },  // bearish / risk-off
  purple: { bg:"#8b5cf6", fg:"#0b1220", bd:"#7c3aed", sh:"#7c3aed" },  // compression / neutral / early-warn
  off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", sh:"#111827" },  // inactive
  info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", sh:"#334155" },  // generic info
};

/* Tone token -> palette */
function toneToPalette(t) {
  return (
    {
      "luxGreen": LUX_COLORS.green,
      "luxRed":   LUX_COLORS.red,
      "luxPurple":LUX_COLORS.purple,
      "off":      LUX_COLORS.off,
      "info":     LUX_COLORS.info,
    }[t] || LUX_COLORS.off
  );
}

/* ---------------- Light pill ---------------- */
function Light({ label, tone = "info", active = true, title }) {
  const palette = toneToPalette(active ? tone : "off");
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

/* ---------------- Signal dictionaries ---------------- */
// 10m core
const R11_CORE_DEF = [
  { k:"sigOverallBull",     label:"Overall Bull",     tone:()=>"luxGreen" },
  { k:"sigOverallBear",     label:"Overall Bear",     tone:()=>"luxRed" },
  { k:"sigEMA10BullCross",  label:"EMA10 Bull Cross", tone:()=>"luxGreen" },
  { k:"sigEMA10BearCross",  label:"EMA10 Bear Cross", tone:()=>"luxRed" },
  { k:"sigEMA10BullCrossEarlyWarn", label:"EMA10 Bull ⚠️", tone:()=>"luxPurple" },
  { k:"sigEMA10BearCrossEarlyWarn", label:"EMA10 Bear ⚠️", tone:()=>"luxPurple" },
  { k:"sigAccelUp",         label:"Accel Up",         tone:()=>"luxGreen" },
  { k:"sigAccelDown",       label:"Accel Down",       tone:()=>"luxRed" },
  { k:"sigExpansion",       label:"Expansion",        tone:()=>"luxGreen" },
  { k:"sigCompression",     label:"Compression",      tone:()=>"luxPurple" },
  { k:"sigRiskOn",          label:"Risk-On",          tone:()=>"luxGreen" },
  { k:"sigRiskOff",         label:"Risk-Off",         tone:()=>"luxRed" },
  { k:"sigSectorThrust",    label:"Sector Thrust",    tone:()=>"luxGreen" },
  { k:"sigSectorWeak",      label:"Sector Weak",      tone:()=>"luxRed" },
];

// 1h family
const R11_1H_DEF = [
  { k:"sigEMA1hBullCross",  label:"EMA1h Bull Cross",  tone:()=>"luxGreen" },
  { k:"sigEMA1hBearCross",  label:"EMA1h Bear Cross",  tone:()=>"luxRed" },
  { k:"sigSMI1hBullCross",  label:"SMI1h Bull Cross",  tone:()=>"luxGreen" },
  { k:"sigSMI1hBearCross",  label:"SMI1h Bear Cross",  tone:()=>"luxRed" },
  { k:"sigAccelUp1h",       label:"Accel Up (1h)",     tone:()=>"luxGreen" },
  { k:"sigAccelDown1h",     label:"Accel Down (1h)",   tone:()=>"luxRed" },
  { k:"sigOverallBull1h",   label:"Overall Bull (1h)", tone:()=>"luxGreen" },
  { k:"sigOverallBear1h",   label:"Overall Bear (1h)", tone:()=>"luxRed" },
];

// NOW (5m)
const R11_NOW_DEF = [
  { k:"sigNowAccelUp",   label:"Now Accel Up",   tone:()=>"luxGreen" },
  { k:"sigNowAccelDown", label:"Now Accel Down", tone:()=>"luxRed" },
  { k:"sigNowBull",      label:"Now Bull",       tone:()=>"luxGreen" },
  { k:"sigNowBear",      label:"Now Bear",       tone:()=>"luxRed" },
];

// Legacy (kept for compatibility; tones converted to Lux)
const LEGACY_DEF = [
  { k:"sigBreakout",       label:"Breakout",         tone:()=>"luxGreen" },
  { k:"sigDistribution",   label:"Distribution",     tone:()=>"luxRed" },
  { k:"sigCompression",    label:"Compression",      tone:()=>"luxPurple" },
  { k:"sigExpansion",      label:"Expansion",        tone:()=>"luxGreen" },
  { k:"sigOverheat",       label:"Overheat",         tone:()=>"luxRed" },
  { k:"sigTurbo",          label:"Turbo",            tone:()=>"luxGreen" },
  { k:"sigDivergence",     label:"Divergence",       tone:()=>"luxPurple" },
  { k:"sigLowLiquidity",   label:"Low Liquidity",    tone:()=>"luxPurple" },
  { k:"sigVolatilityHigh", label:"Volatility High",  tone:()=>"luxPurple" },
];

/* ---------------- Render helpers ---------------- */
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
  const hasR11Core = keys.some(k => /^sig(Overall(Bull|Bear)|EMA10|Accel(Up|Down)|Risk(On|Off)|Sector(Thrust|Weak)|Expansion|Compression)/.test(k));
  const hasR11H1   = keys.some(k => /^sig(EMA1h(Bull|Bear)Cross|SMI1h(Bull|Bear)Cross|Accel(Up|Down)1h|Overall(Bull|Bear)1h)$/.test(k));
  const hasR11Now  = keys.some(k => /^sigNow/.test(k));
  const hasLegacy  = keys.some(k => /^sig(Breakout|Distribution|Compression|Expansion|Overheat|Turbo|Divergence|LowLiquidity|VolatilityHigh)$/.test(k));
  return { hasR11Core, hasR11H1, hasR11Now, hasLegacy };
}

/* --------------------------- Component ---------------------------- */
export default function EngineLights() {
  const LIVE_10_URL = resolveLiveIntraday();
  const LIVE_1H_URL = resolveLiveHourly();

  const [ts10, setTs10] = useState(null);
  const [ts1h, setTs1h] = useState(null);
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState(null);
  const [signals, setSignals] = useState({});
  const [err, setErr] = useState(null);
  const poll10Ref = useRef(null);
  const poll1hRef = useRef(null);
  const [legendOpen, setLegendOpen] = useState(false);

  // 10m pills (every 30s)
  async function fetch10m(abortSignal) {
    const url = guardLive(`${LIVE_10_URL}?t=${Date.now()}`);
    try {
      const res = await fetch(url, { cache:"no-store", signal:abortSignal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const j = await res.json();
      const eng = j?.engineLights || {};
      setSignals(eng?.signals || {});
      setTs10(eng?.updatedAt || j?.updated_at || j?.ts || null);
      setLive(!!eng?.live);
      setMode(eng?.mode || null);
      setErr(null);
    } catch (e) {
      console.warn("[EngineLights] 10m fetch failed:", e);
      setErr(String(e));
    }
  }

  // 1h timestamp (every 60s)
  async function fetch1h(abortSignal) {
    const url = guardLive(`${LIVE_1H_URL}?t=${Date.now()}`);
    try {
      const res = await fetch(url, { cache:"no-store", signal:abortSignal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const j = await res.json();
      setTs1h(j?.updated_at || j?.updated_at_utc || j?.ts || null);
    } catch (e) {
      console.warn("[EngineLights] 1h fetch failed:", e);
    }
  }

  useEffect(() => {
    const c10 = new AbortController();
    const c1h = new AbortController();
    fetch10m(c10.signal);
    fetch1h(c1h.signal);
    poll10Ref.current = setInterval(() => fetch10m(c10.signal), 30_000);
    poll1hRef.current = setInterval(() => fetch1h(c1h.signal), 60_000);
    return () => {
      try { c10.abort(); c1h.abort(); } catch {}
      if (poll10Ref.current) clearInterval(poll10Ref.current);
      if (poll1hRef.current) clearInterval(poll1hRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LIVE_10_URL, LIVE_1H_URL]);

  const fam = detectFamily(signals);
  const corePills   = fam.hasR11Core ? toPills(R11_CORE_DEF, signals) : [];
  const h1Pills     = fam.hasR11H1   ? toPills(R11_1H_DEF,   signals) : [];
  const nowPills    = fam.hasR11Now  ? toPills(R11_NOW_DEF,  signals) : [];
  const legacyPills = fam.hasLegacy  ? toPills(LEGACY_DEF,   signals) : [];

  const stableKey = `${ts10 || "no-ts"}•${Object.entries(signals).map(([k,v])=>`${k}:${v?.active?1:0}-${v?.severity||""}`).join("|")}`;

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights" key={stableKey}>
      {/* Header */}
      <div className="panel-head" style={{ alignItems:"center", gap:8 }}>
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
          <span className="small"
                style={{ marginRight:8, padding:"3px 8px", borderRadius:6, background:"#16a34a", color:"#0b1220", fontWeight:800, border:"1px solid #0f7a2a" }}
                title={mode ? `Mode: ${mode}` : "Live intraday"}>
            LIVE
          </span>
        )}
        <span className="small muted" style={{ marginRight:12 }}>
          <strong>10m:</strong> <LastUpdated ts={ts10} />
        </span>
        <span className="small muted">
          <strong>1h:</strong> <LastUpdated ts={ts1h} />
        </span>
      </div>

      {/* Pills */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {fam.hasR11Core && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {corePills.map(p => <Light key={p.key} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {fam.hasR11H1 && (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {h1Pills.map(p => <Light key={p.key} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
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
        {!fam.hasR11Core && !fam.hasR11H1 && !fam.hasR11Now && !fam.hasLegacy && (
          <div className="small muted">No signals present in payload.</div>
        )}
      </div>

      {/* Legend modal */}
      {legendOpen && (
        <div role="dialog" aria-modal="true" onClick={()=> setLegendOpen(false)}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }}>
          <div onClick={(e)=> e.stopPropagation()}
               style={{ width:"min(880px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b",
                        borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)" }}>
            <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>Engine Lights — Legend</div>
            <p className="small muted" style={{ marginBottom:8 }}>
              Color scheme aligned to LuxAlgo: <strong>Green</strong> = bullish/expansion, <strong>Purple</strong> = compression/neutral/early-warn, <strong>Red</strong> = bearish/risk-off.
              <br/> Families auto-detected from payload:
              <br/>• 10m Core (Overall/EMA10/Accel/Risk/Sector, +Expansion/Compression)
              <br/>• 1h Crosses (EMA1h/SMI1h/Accel1h/Overall1h)
              <br/>• NOW (5-min sandbox)
              <br/>• Legacy (Breakout/Distribution/…)
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button onClick={()=> setLegendOpen(false)}
                      style={{ background:"#eab308", color:"#111827", border:"none", borderRadius:8,
                               padding:"8px 12px", fontWeight:700, cursor:"pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
