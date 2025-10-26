import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApiSafe";
import { LastUpdated } from "../../components/LastUpdated";
import {
  MarketMeterIntradayLegend,
  MarketMeterDailyLegend,
} from "../../components/MarketMeterLegend";

const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL; // /live/intraday
const HOURLY_URL   = process.env.REACT_APP_HOURLY_URL;   // /live/hourly
const EOD_URL      = process.env.REACT_APP_EOD_URL;      // /live/eod
const SANDBOX_URL  = process.env.REACT_APP_INTRADAY_SANDBOX_URL || "";
const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "";

/* ------------------------------ utils ------------------------------ */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const clamp   = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n)));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
function fmtIso(ts){ try{ return new Date(ts).toLocaleString(); } catch{ return ts; } }
const isStale = (ts, maxMs = 12*60*1000) => !ts || Date.now()-new Date(ts).getTime() > maxMs;
function tsOf(x){ return x?.updated_at || x?.ts || null; }
function newer(a,b){ const ta=tsOf(a), tb=tsOf(b); if(!ta) return b; if(!tb) return a; return new Date(ta).getTime() >= new Date(tb).getTime() ? a : b; }
function mapPsiToPct(psi){ if(!Number.isFinite(psi)) return NaN; return clamp((psi/120)*100,0,100); }

/* ------------ tone helpers (keep existing behaviour) ------------- */
function toneForBreadth(v){ if(!Number.isFinite(v)) return "info"; if(v>=65) return "ok"; if(v>=35) return "warn"; return "danger"; }
function toneForMomentum(v){ if(!Number.isFinite(v)) return "info"; if(v>=65) return "ok"; if(v>=35) return "warn"; return "danger"; }
/* 10m Squeeze = PSI/compression (higher=tighter/worse) */
function toneForSqueeze(v){ if(!Number.isFinite(v)) return "info"; if(v>=85) return "danger"; if(v>=65) return "warn"; if(v>=35) return "warn"; return "ok"; }
/* 1h Squeeze = Expansion% (higher=better) */
function toneForSqueeze1h(v){ if(!Number.isFinite(v)) return "info"; if(v>=65) return "ok"; if(v>=35) return "warn"; return "danger"; }
function toneForLiquidity(v){ if(!Number.isFinite(v)) return "info"; if(v>=60) return "ok"; if(v>=40) return "warn"; return "danger"; }
function toneForVol(v){ if(!Number.isFinite(v)) return "info"; if(v>60) return "danger"; if(v>30) return "warn"; return "ok"; }
function toneForPercent(v){ if(!Number.isFinite(v)) return "info"; if(v>=60) return "ok"; if(v>=45) return "warn"; return "danger"; }
function toneForDailyTrend(s){ if(!Number.isFinite(s)) return "info"; if(s>5) return "ok"; if(s>=-5) return "warn"; return "danger"; }
function toneForLuxDaily(v){ if(!Number.isFinite(v)) return "info"; if(v>=85) return "danger"; if(v>=80) return "warn"; return "ok"; }
function toneForVolBand(b){ return b==="high"?"danger":b==="elevated"?"warn":b?"ok":"info"; }
function toneForLiqBand(b){ return b==="good"?"ok":b==="normal"?"warn":b?"danger":"info"; }
function toneForOverallState(state,score){ const s=(state||"").toLowerCase(); if(s==="bull") return "ok"; if(s==="bear") return "danger"; if(s==="neutral") return "warn"; return toneForPercent(score); }

/* ---------------------------- Stoplight ---------------------------- */
function Stoplight({ label, value, unit="%", toneOverride="info" }) {
  const v = Number.isFinite(value) ? value : NaN;
  const colors = {
    ok:{bg:"#22c55e",glow:"rgba(34,197,94,.45)"},
    warn:{bg:"#fbbf24",glow:"rgba(251,191,36,.45)"},
    danger:{bg:"#ef4444",glow:"rgba(239,68,68,.45)"},
    info:{bg:"#334155",glow:"rgba(51,65,85,.35)"}
  }[toneOverride];
  const valText = Number.isFinite(v) ? `${v.toFixed(1)}${unit}` : "—";
  return (
    <div style={{ textAlign:"center", minWidth:92 }}>
      <div style={{
        width:54, height:54, borderRadius:"50%", background:colors.bg, boxShadow:`0 0 12px ${colors.glow}`,
        display:"flex", alignItems:"center", justifyContent:"center", border:"4px solid #0c1320", margin:"0 auto"
      }}>
        <div style={{ fontWeight:800, color:"#0b1220" }}>{valText}</div>
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:"#e5e7eb", marginTop:4 }}>{label}</div>
    </div>
  );
}

/* -------------------------- Δ5m sandbox -------------------------- */
function useSandboxDeltas(){
  const [delta,setDelta]=React.useState({dB:null,dM:null,riskOn:null});
  const [ts,setTs]=React.useState(null);
  React.useEffect(()=>{
    let stop=false;
    async function pull(){
      if(!SANDBOX_URL) return;
      try{
        const u=SANDBOX_URL.includes("?")?`${SANDBOX_URL}&t=${Date.now()}`:`${SANDBOX_URL}?t=${Date.now()}`;
        const r=await fetch(u,{cache:"no-store"}); const j=await r.json();
        if(stop) return;
        setDelta({
          dB:Number(j?.deltas?.market?.dBreadthPct ?? null),
          dM:Number(j?.deltas?.market?.dMomentumPct ?? null),
          riskOn:Number(j?.deltas?.market?.riskOnPct ?? null),
        });
        setTs(j?.deltasUpdatedAt || null);
      }catch{ if(!stop){ setDelta({dB:null,dM:null,riskOn:null}); setTs(null); } }
    }
    pull(); const id=setInterval(pull,60_000); return ()=>{stop=true; clearInterval(id);};
  },[]);
  return { delta, ts };
}

/* -------------------------- Replay UI ----------------------------- */
function ReplayControls({ on, setOn, granularity, setGranularity, ts, setTs, options, loading }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={()=>setOn(!on)}
        className={`px-3 py-1 rounded-full border text-sm ${on?"border-yellow-400 text-yellow-300 bg-neutral-800":"border-neutral-700 text-neutral-300 bg-neutral-900 hover:border-neutral-500"}`}
      >
        {on ? "Replay: ON" : "Replay: OFF"}
      </button>
      <select
        value={granularity}
        onChange={(e)=>setGranularity(e.target.value)}
        disabled={!on}
        className="px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm"
      >
        <option value="10min">10m</option>
        <option value="1h">1h</option>
        <option value="1d">1d</option>
      </select>
      <select
        value={ts || ""}
        onChange={(e)=>setTs(e.target.value)}
        disabled={!on || loading || options.length===0}
        className="min-w-[220px] px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm"
      >
        {loading && <option value="">Loading…</option>}
        {!loading && options.length===0 && <option value="">No snapshots</option>}
        {!loading && options.length>0 && (
          <>
            <option value="">Select time…</option>
            {options.map(o=><option key={o.ts} value={o.ts}>{fmtIso(o.ts)}</option>)}
          </>
        )}
      </select>
    </div>
  );
}

/* ========================== Main ========================== */
export default function RowMarketOverview(){
  const { data: polled } = useDashboardPoll("dynamic");

  // single-row timeframe switch
  const [tf,setTf] = React.useState("10m"); // "10m"|"1h"|"eod"

  // legend state (unchanged)
  const [legendOpen,setLegendOpen]=React.useState(null);

  // live pulls
  const [live10,setLive10]=React.useState(null);
  const [live1h,setLive1h]=React.useState(null);
  const [liveEOD,setLiveEOD]=React.useState(null);

  React.useEffect(()=>{
    let stop=false;
    async function pull(){
      try{
        if(INTRADAY_URL){ const r=await fetch(`${INTRADAY_URL}?t=${Date.now()}`,{cache:"no-store"}); const j=await r.json(); if(!stop) setLive10(j); }
        if(HOURLY_URL){  const r=await fetch(`${HOURLY_URL}?t=${Date.now()}`,{cache:"no-store"}); const j=await r.json(); if(!stop) setLive1h(j); }
        if(EOD_URL){     const r=await fetch(`${EOD_URL}?t=${Date.now()}`,{cache:"no-store"});  const j=await r.json(); if(!stop) setLiveEOD(j); }
      }catch{}
    }
    pull(); const id=setInterval(pull,60_000); return ()=>{stop=true; clearInterval(id);};
  },[]);

  // Δ5m for stamps
  const { delta, ts:deltaTs } = useSandboxDeltas();

  // Choose latest intraday (keeps your replay behaviour unchanged)
  const chosen = newer(live10, polled);
  const d10 = chosen || {};
  const m10 = d10?.metrics ?? {};
  const i10 = d10?.intraday ?? {};

  const d1h = live1h || {}; const m1h=d1h?.metrics ?? {}; const h1=d1h?.hourly ?? {};
  const dd  = liveEOD || {};

  // Build single-row values based on TF
  let title="Intraday Scalp Lights (10m)";
  let squeezeTone=toneForSqueeze;
  let breadth   = num(m10.breadth_10m_pct ?? m10.breadth_pct);
  let momentum  = num(m10.momentum_combo_pct ?? m10.momentum_pct);
  let squeeze   = num(m10.squeeze_intraday_pct ?? m10.squeeze_pct);
  let liquidity = num(m10.liquidity_psi ?? m10.liquidity_pct);
  let volatility= num(m10.volatility_pct);
  let rising    = num(i10?.sectorDirection10m?.risingPct);
  let riskon    = num(i10?.riskOn10m?.riskOnPct);
  let overallScore = num(i10?.overall10m?.score);
  let overallState = i10?.overall10m?.state || null;
  let rowTs = d10?.updated_at;

  if(tf==="1h" && live1h){
    title="Hourly Valuation (1h)";
    squeezeTone=toneForSqueeze1h;
    breadth   = num(m1h.breadth_1h_pct);
    momentum  = num(m1h.momentum_combo_1h_pct ?? m1h.momentum_1h_pct);
    squeeze   = num(m1h.squeeze_1h_pct);                 // Expansion%
    liquidity = num(m1h.liquidity_1h);
    volatility= num(m1h.volatility_1h_scaled ?? m1h.volatility_1h_pct);
    rising    = num(h1?.sectorDirection1h?.risingPct);
    riskon    = num(h1?.riskOn1h?.riskOnPct);
    overallScore = num(h1?.overall1h?.score);
    overallState = h1?.overall1h?.state || null;
    rowTs = d1h?.updated_at;
  }
  if(tf==="eod" && liveEOD){
    title="Daily Structure (EOD)";
    // keep right-hand daily block for detail; single-row keeps TF controls only
    rowTs = dd?.updated_at;
  }

  return (
    <section id="row-2" className="panel" style={{padding:10}}>
      {/* Header */}
      <div className="panel-head" style={{alignItems:"center"}}>
        <div className="panel-title">Market Meter — Stoplights</div>

        {/* timeframe buttons (single-row view) */}
        <div style={{ marginLeft: 8, display:"flex", gap: 6 }}>
          {["10m","1h","eod"].map(k=>(
            <button key={k}
              onClick={()=>setTf(k)}
              className={`px-2 py-1 rounded-md text-sm ${tf===k?"bg-yellow-500 text-black":"bg-neutral-800 text-neutral-300"}`}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Legend buttons (unchanged) */}
        <div style={{ marginLeft: 8 }}>
          <button onClick={()=>setLegendOpen("intraday")}
            className="px-2 py-1 rounded-md bg-neutral-900 text-neutral-200 border border-neutral-700 text-sm" style={{marginRight:6}}>
            Intraday Legend
          </button>
          <button onClick={()=>setLegendOpen("daily")}
            className="px-2 py-1 rounded-md bg-neutral-900 text-neutral-200 border border-neutral-700 text-sm">
            Daily Legend
          </button>
        </div>

        <div className="spacer"/>
        <LastUpdated ts={rowTs}/>
      </div>

      {/* SINGLE LINE of lights */}
      <div className="small" style={{ color:"#9ca3af", fontWeight:800, marginTop:6 }}>{title}</div>
      <div style={{
        display:"flex",
        gap:12,
        alignItems:"center",
        whiteSpace:"nowrap",
        overflowX:"auto",
        paddingBottom:4
      }}>
        <Stoplight label={`Overall (${tf})`} value={overallScore} toneOverride={toneForOverallState(overallState, overallScore)} />
        <Stoplight label="Breadth"          value={breadth}      toneOverride={toneForBreadth(breadth)} />
        <Stoplight label="Momentum"         value={momentum}     toneOverride={toneForMomentum(momentum)} />
        <Stoplight label="Squeeze"          value={squeeze}      toneOverride={squeezeTone(squeeze)} />
        <Stoplight label="Liquidity"        value={liquidity}    unit="PSI" toneOverride={toneForLiquidity(liquidity)} />
        <Stoplight label="Volatility"       value={volatility}   toneOverride={toneForVol(volatility)} />
        <Stoplight label={`Sector Dir (${tf})`} value={rising}   toneOverride={toneForPercent(rising)} />
        <Stoplight label={`Risk-On (${tf})`}   value={riskon}    toneOverride={toneForPercent(riskon)} />
      </div>

      {/* Time stamps under the row (like your original) */}
      <div style={{ display:"flex", gap:18, color:"#9ca3af", fontSize:12, marginTop:4, flexWrap:"wrap" }}>
        {tf==="10m" && (
          <>
            <div>Last 10-min: <strong>{fmtIso(live10?.updated_at)}</strong></div>
            <div>Δ5m updated: <strong>{fmtIso(deltaTs) || "—"}</strong></div>
          </>
        )}
        {tf==="1h"  && <div>Last 1-hour: <strong>{fmtIso(live1h?.updated_at)}</strong></div>}
        {tf==="eod" && <div>Daily updated: <strong>{fmtIso(liveEOD?.updated_at)}</strong></div>}
      </div>

      {/* Legend modals */}
      {legendOpen && (
        <div
          role="dialog" aria-modal="true" onClick={()=>setLegendOpen(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }}
        >
          <div
            onClick={(e)=>e.stopPropagation()}
            style={{ width:"min(880px,92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b", borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)" }}
          >
            {legendOpen==="intraday" && <MarketMeterIntradayLegend/>}
            {legendOpen==="daily"    && <MarketMeterDailyLegend/>}
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button
                onClick={()=>setLegendOpen(null)}
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
