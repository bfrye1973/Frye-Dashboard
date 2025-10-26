// src/pages/rows/EngineLights.jsx
// v8.0 — Lux-aligned colors; Engine Lights + inline Lux Trend capsules (10m / 1h / Daily)
//         Renders everything in the SAME row with separate 10m/1h/Daily timestamps.

import React, { useEffect, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

/* ---------------------- Endpoint resolution ---------------------- */
function normalize(u) { return (u || "").trim().replace(/\/+$/, ""); }

function urlIntraday() {
  const env = normalize(process.env.REACT_APP_INTRADAY_URL || "");
  if (env) return env;
  const win = typeof window !== "undefined" ? normalize(window.__LIVE_INTRADAY_URL || "") : "";
  return normalize("https://frye-market-backend-1.onrender.com/live/intraday");
}
function urlHourly() {
  const env = normalize(process.env.REACT_APP_HOURLY_URL || "");
  if (env) return env;
  const win = typeof window !== "undefined" ? normalize(window.__LIVE_HOURLY_URL || "") : "";
  return normalize("https://frye-market-backend-1.onrender.com/live/hourly");
}
function urlDaily() {
  const env = normalize(process.env.REACT_APP_DAILY_URL || "");
  if (env) return env;
  const win = typeof window !== "undefined" ? normalize(window.__LIVE_DAILY_URL || "") : "";
  // default to /live/daily, fall back logic will try /live/eod
  return normalize("https://frye-market-backend-1.onrender.com/live/daily");
}
function guardLive(u) {
  return u.replace(/\/api\/live\//, "/live/").replace(/\/api\/?(\?|$)/, "/");
}

/* ---------------------- Lux color palette ----------------------- */
const LUX = {
  green:  { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", sh:"#16a34a" }, // bullish / expansion
  red:    { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", sh:"#b91c1c" }, // bearish / risk-off
  purple: { bg:"#8b5cf6", fg:"#0b1220", bd:"#7c3aed", sh:"#7c3aed" }, // compression / neutral / early-warn
  off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", sh:"#111827" }, // inactive
  info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", sh:"#334155" }, // neutral info
};
function toneToPalette(t) {
  return (
    { luxGreen:LUX.green, luxRed:LUX.red, luxPurple:LUX.purple, off:LUX.off, info:LUX.info }[t] ||
    LUX.off
  );
}

/* ---------------------- UI controls ---------------------- */
function Pill({ label, tone = "info", active = true, title }) {
  const p = toneToPalette(active ? tone : "off");
  return (
    <span
      title={title || label}
      style={{
        display:"inline-block",
        background:p.bg, color:p.fg, border:`1px solid ${p.bd}`, boxShadow:`0 0 10px ${p.sh}55`,
        borderRadius:10, padding:"6px 10px", fontWeight:700, fontSize:12,
        opacity: active ? 1 : 0.45, filter: active ? "none" : "grayscale(40%)",
        marginRight:8, whiteSpace:"nowrap"
      }}
    >
      {label}
    </span>
  );
}

function Capsule({ title, color, ts, reason }) {
  const p = toneToPalette(color || "off");
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:8, marginLeft:12}}>
      <span title={reason || title}
        style={{
          background:p.bg,color:p.fg,border:`1px solid ${p.bd}`,boxShadow:`0 0 10px ${p.sh}55`,
          borderRadius:10,padding:"6px 12px",fontWeight:700
        }}>
        {title}
      </span>
      <span className="small muted"><LastUpdated ts={ts} /></span>
    </div>
  );
}

/* ---------------------- Families ---------------------- */
// 10m core family
const DEF_10M = [
  { k:"sigOverallBull",     label:"Overall Bull",     tone:()=>"luxGreen" },
  { k:"sigOverallBear",     label:"Overall Bear",     tone:()=>"luxRed" },
  { k:"sigEMA10BullCross",  label:"EMA10 Bull Cross", tone:()=>"luxGreen" },
  { k:"sigEMA10BearCross",  label:"EMA10 Bear Cross", tone:()=>"luxRed" },
  { k:"sigEMA10BullCrossEarlyWarn", label:"EMA10 Bull ⚠", tone:()=>"luxPurple" },
  { k:"sigEMA10BearCrossEarlyWarn", label:"EMA10 Bear ⚠", tone:()=>"luxPurple" },
  { k:"sigExpansion",       label:"Expansion",        tone:()=>"luxGreen" },
  { k:"sigCompression",     label:"Compression",      tone:()=>"luxPurple" },
  { k:"sigAccelUp",         label:"Accel Up",         tone:()=>"luxGreen" },
  { k:"sigAccelDown",       label:"Accel Down",       tone:()=>"luxRed" },
  { k:"sigRiskOn",          label:"Risk-On",          tone:()=>"luxGreen" },
  { k:"sigRiskOff",         label:"Risk-Off",         tone:()=>"luxRed" },
  { k:"sigSectorThrust",    label:"Sector Thrust",    tone:()=>"luxGreen" },
  { k:"sigSectorWeak",      label:"Sector Weak",      tone:()=>"luxRed" },
];

// 1h family (mirrored into intraday)
const DEF_1H = [
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
const DEF_NOW = [
  { k:"sigNowAccelUp",   label:"Now Accel Up",   tone:()=>"luxGreen" },
  { k:"sigNowAccelDown", label:"Now Accel Down", tone:()=>"luxRed" },
  { k:"sigNowBull",      label:"Now Bull",       tone:()=>"luxGreen" },
  { k:"sigNowBear",      label:"Now Bear",       tone:()=>"luxRed" },
];

// Legacy
const DEF_LEGACY = [
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

/* ---------------------- React component ---------------------- */
export default function EngineLights() {
  const INTRA = urlIntraday();
  const H1    = urlHourly();
  const DAILY = urlDaily();

  // 10m / 1h / daily timestamps
  const [ts10, setTs10]     = useState(null);
  const [ts1h, setTs1h]     = useState(null);
  const [tsDaily, setTsDaily] = useState(null);

  // strategy capsules
  const [trend10, setTrend10]   = useState({ state:null, reason:"", ts:null });
  const [trend1h, setTrend1h]   = useState({ state:null, reason:"", ts:null });
  const [trendDaily, setTrendDaily] = useState({ state:null, reason:"", ts:null });

  // pills
  const [signals, setSignals]   = useState({});

  const [live, setLive]         = useState(false);
  const [mode, setMode]         = useState(null);
  const [err, setErr]           = useState(null);

  const poll10Ref = useRef(null);
  const poll1hRef = useRef(null);
  const pollDYRef = useRef(null);

  const [legendOpen, setLegendOpen] = useState(false);

  async function fetch10m(abortSignal) {
    try {
      const res = await fetch(guardLive(`${INTRA}?t=${Date.now()}`), {cache:"no-store", signal:abortSignal});
      if (!res.ok) throw new Error("10m feed error "+res.status);
      const j = await res.json();
      const eng = j?.engineLights || {};
      setSignals(eng?.signals || {});
      setTs10(eng?.updatedAt || j?.updated_at || j?.ts || null);
      setLive(!!eng?.live);
      setMode(eng?.mode || null);

      const st = (j?.intraday?.strategy) || {};
      if (st?.trend10m) setTrend10({ state:st.trend10m.state, reason:st.trend10m.reason || "", ts:st.trend10m.updatedAt || j.updated_at || j.ts || null });
      if (st?.trend1h)  setTrend1h ({ state:st.trend1h.state,  reason:st.trend1h.reason  || "", ts:st.trend1h.updatedAt  || j.updated_at || j.ts || null });

      setErr(null);
    } catch (e) { setErr(String(e)); }
  }

  async function fetch1h(abortSignal) {
    try {
      const res = await fetch(guardLive(`${H1}?t=${Date.now()}`), {cache:"no-store", signal:abortSignal});
      if (!res.ok) return;
      const j = await res.json();
      setTs1h(j?.updated_at || j?.updated_at_utc || j?.ts || null);
      if (!trend1h.state && j?.strategy?.trend1h) {
        const s=j.strategy.trend1h;
        setTrend1h({ state:s.state, reason:s.reason || "", ts:s.updatedAt || j.updated_at || j.updated_at_utc || j.ts || null });
      }
    } catch (e) {}
  }

  async function fetchDaily(abortSignal) {
    async function pull(u){
      const res=await fetch(u, {cache:"no-store", signal:abortSignal});
      if(!res.ok) throw new Error(String(res.status));
      return res.json();
    }
    try {
      const j = await pull(guardLive(`${DAILY}?t=${Date.now()}`));
      setTsDaily(j?.updated_at || j?.updated_at_utc || j?.ts || null);
      if (j?.strategy?.trendDaily) {
        const s=j.strategy.trendDaily;
        setTrendDaily({ state:s.state, reason:s.reason || "", ts:s.updatedAt || j.updated_at || j.updated_at_utc || j.ts || null });
      }
    } catch(_e1) {
      // fallback to /live/eod
      try {
        const eod = await fetch("https://frye-market-backend-1.onrender.com/live/eod?t="+Date.now(), {cache:"no-store", signal:abortSignal});
        if (eod.ok){
          const j=await eod.json();
          setTsDaily(j?.updated_at || j?.updated_at_utc || j?.ts || null);
          if (j?.strategy?.trendDaily){
            const s=j.strategy.trendDaily;
            setTrendDaily({ state:s.state, reason:s.reason||"", ts:s.updatedAt || j.updated_at || j.updated_at_utc || j.ts || null });
          }
        }
      } catch(__) {}
    }
  }

  useEffect(() => {
    const c10=new AbortController(), c1=new AbortController(), cd=new AbortController();
    fetch10m(c10.signal);   // 10m pills + 10m trend
    fetch1h(c1.signal);     // 1h timestamp (and fallback trend)
    fetchDaily(cd.signal);  // daily capsule

    poll10Ref.current = setInterval(()=> fetch10m(c10.signal), 30_000);
    poll1hRef.current  = setInterval(()=> fetch1h(c1.signal),  60_000);
    pollDYRef.current  = setInterval(()=> fetchDaily(cd.signal), 600_000);

    return () => {
      try{ c10.abort(); c1.abort(); cd.abort(); }catch{}
      if (poll10Ref.current) clearInterval(poll10Ref.current);
      if (poll1hRef.current) clearInterval(poll1hRef.current);
      if (pollDYRef.current) clearInterval(pollDYRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* tone/channel detection */
  function mapTone(s) {
    if (!s) return "off";
    const st = s.state?.toLowerCase?.() || "";
    if (st.includes("green"))  return "luxGreen";
    if (st.includes("red"))    return "luxRed";
    if (st.includes("purple")) return "luxPurple";
    return "off";
  }

  const fam = (() => {
    const keys = Object.keys(signals || {});
    const has10m = keys.some(k=>/^sig(Overall(Bull|Bear)|EMA10|Accel|Risk|Sector|Compression|Expansion)/.test(k));
    const has1h  = keys.some(k=>/^sig(EMA1h|SMI1h|Overall.*1h|.*1h$)/.test(k));
    const hasNow = keys.some(k=>/^sigNow/.test(k));
    const hasLegacy = keys.some(k=>/^sig(Breakout|Distribution|Compression|Expansion|Overheat|Turbo|Divergence|LowLiqu|VolatilityHigh)/.test(k));
    return {has10m:has10m, has1h, hasNow, hasLegacy};
  })();

  const pills10m = fam.has10m   ? DEF_10M.map(d => ({
      ...d, active: !!(signals[d.k]?.active),
      tone: (signals[d.k]?.active ? (typeof d.tone==="function" ? d.tone(signals[d.k]) : d.tone) : "off"),
      title: `${d.label} — ${(signals[d.k]?.severity || "off").toUpperCase()} ${signals[d.k]?.reason?("• "+signals[d.k].reason):""}`
  })) : [];

  const pills1h  = fam.has1h    ? DEF_1H.map(d => ({
      ...d, active: !!(signals[d.k]?.active),
      tone: (signals[d.k]?.active ? (typeof d.tone==="function" ? d.tone(signals[d.k]) : d.tone) : "off"),
      title: `${d.label} — ${(signals[d.k]?.severity || "off").toUpperCase()} ${signals[d.k]?.reason?("• "+signals[d.k].reason):""}`
  })) : [];

  const pillsNOW = fam.hasNow   ? DEF_NOW.map(d => ({
      ...d, active: !!(signals[d.k]?.active),
      tone: (signals[d.k]?.active ? (typeof d.tone==="function" ? d.tone(signals[d.k]) : d.tone) : "off"),
      title: `${d.label} — ${(signals[d.k]?.severity || "off").toUpperCase()} ${signals[d.k]?.reason?("• "+signals[d.k].reason):""}`
  })) : [];

  const pillsLegacy = fam.hasLegacy ? DEF_LEGACY.map(d => ({
      ...d, active: !!(signals[d.k]?.active),
      tone: (signals[d.k]?.active ? (typeof d.tone==="function" ? d.tone(signals[d.k]) : d.tone) : "off"),
      title: `${d.label} — ${(signals[d.k]?.severity || "off").toUpperCase()}`
  })) : [];

  const color10   = mapTone(trend10);
  const color1h   = mapTone(trend1h);
  const colorDaily= mapTone(trendDaily);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights">
      {/* TOP BAR: header + capsules + timestamps */}
      <div className="panel-head" style={{ display:"flex", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
          <div className="panel-title">Engine Lights</div>
          <button
            onClick={() => setLegendOpen(true)}
            style={{ background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b",
                     borderRadius:8, padding:"6px 10px", fontWeight:600, cursor:"pointer" }}>
            Legend
          </button>
          {err && <span className="small muted" style={{ marginLeft:8 }} title={err}>fetch error</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center" }}>
          <Capsule title="10m Trend"  color={color10}   ts={trend10.ts || ts10}   reason={trend10.reason} />
          <Capsule title="1h Trend"   color={color1h}   ts={trend1h.ts || ts1h}   reason={trend1h.reason} />
          <Capsule title="Daily Trend" color={colorDaily} ts={trendDaily.ts || tsDaily} reason={trendDaily.reason} />
        </div>
      </div>

      {/* TS chips below header for quick glance */}
      <div style={{display:"flex", gap:16, padding:"2px 8px 10px 8px"}}>
        <span className="small muted"><strong>10m:</strong> <LastUpdated ts={ts10} /></span>
        <span className="small muted"><strong>1h:</strong> <LastUpdated ts={ts1h} /></span>
        <span className="small muted"><strong>Daily:</strong> <LastUpdated ts={tsDaily} /></span>
      </div>

      {/* PILLS (stacked; 10m first, then 1h, then NOW, then legacy) */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {pills10m.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center" }}>
            {pills10m.map(p => <Pill key={p.k} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {pills1h.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center" }}>
            {pills1h.map(p => <Pill key={p.k} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {pillsNOW.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center" }}>
            {pillsNOW.map(p => <Pill key={p.k} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {pillsLegacy.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center" }}>
            {pillsLegacy.map(p => <Pill key={p.k} label={p.label} tone={p.tone} active={p.active} title={p.title} />)}
          </div>
        )}
        {!pills10m.length && !pills1h.length && !pillsNOW.length && !pillsLegacy.length && (
          <div className="small muted">No signals present in Engine Lights.</div>
        )}
      </div>

      {/* Legend modal */}
      {legendOpen && (
        <div role="dialog" aria-modal="true" onClick={()=> setTimeout(()=>setLegendOpen(false),0)}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }}>
          <div onClick={(e)=>e.stopPropagation()}
               style={{ width:"min(900px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b", borderRadius:12, padding:16 }}>
            <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>Engine Lights — Lux Mode</div>
            <ul className="small muted" style={{lineHeight:1.4}}>
              <li>Colors: <strong>Green</strong>=bullish/expansion • <strong>Purple</strong>=compression/neutral • <strong>Red</strong>=bearish/risk-off</li>
              <li>Capsules show Lux Trend for <strong>10m / 1h / Daily</strong> with independent timestamps.</li>
              <li>Pills cover 10m core, mirrored 1h crosses, NOW (5m), and legacy signals.</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
