import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApiSafe";
import { LastUpdated } from "../../components/LastUpdated";
import {
  MarketMeterIntradayLegend,
  MarketMeterDailyLegend,
} from "../../components/MarketMeterLegend";

const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;  // /live/intraday
const HOURLY_URL   = process.env.REACT_APP_HOURLY_URL;    // /live/hourly
const EOD_URL      = process.env.REACT_APP_EOD_URL;       // /live/eod
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
function Stoplight({ label, value, unit="%", toneOverride="info", size=50, minWidth=90 }) {
  const v = Number.isFinite(value) ? value : NaN;
  const colors = {
    ok:{bg:"#22c55e",glow:"rgba(34,197,94,.45)"},
    warn:{bg:"#fbbf24",glow:"rgba(251,191,36,.45)"},
    danger:{bg:"#ef4444",glow:"rgba(239,68,68,.45)"},
    info:{bg:"#334155",glow:"rgba(51,65,85,.35)"}
  }[toneOverride];
  const valText = Number.isFinite(v) ? `${v.toFixed(1)}${unit}` : "—";
  return (
    <div style={{ textAlign:"center", minWidth }}>
      <div style={{
        width:size, height:size, borderRadius:"50%", background:colors.bg,
        boxShadow:`0 0 12px ${colors.glow}`, display:"flex", alignItems:"center",
        justifyContent:"center", border:"4px solid #0c1320", margin:"0 auto"
      }}>
        <div style={{ fontWeight:800, color:"#0b1220" }}>{valText}</div>
      </div>
      <div style={{ fontSize:12.5, fontWeight:700, color:"#e5e7eb", marginTop:4 }}>{label}</div>
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
  return { delta, ts:ts };
}

/* ========================== Main ========================== */
export default function RowMarketOverview(){
  const { data: polled } = useDashboardPoll("dynamic");

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

  // latest intraday vs polled
  const chosen = newer(live10, polled);
  const d10 = chosen || {};
  const m10 = d10?.metrics ?? {};
  const i10 = d10?.intraday ?? {};
  const ts10 = d10?.updated_at;

  const d1h = live1h || {};
  const m1h = d1h?.metrics ?? {};
  const h1  = d1h?.hourly ?? {};
  const ts1h= d1h?.updated_at;

  const dd  = liveEOD || {};
  const tsEOD = dd?.updated_at;

  /* ---- extract values ---- */
  // 10m strip
  const breadth10   = num(m10.breadth_10m_pct ?? m10.breadth_pct);
  const mom10       = num(m.momentum_combo_10m_pct ?? m.momentum_10m_pct ?? m.momentum_pct);
  const sq10        = num(m10.squeeze_intraday_pct ?? m10.squeeze_pct);     // PSI or expansion per backend
  const liq10       = num(m10.liquidity_psi ?? m10.liquidity_pct);
  const vol10       = num(m10.volatility_pct);
  const rising10    = num(i10?.sectorDirection10m?.risingPct);
  const risk10      = num(i10?.riskOn10m?.riskOnPct);
  const overall10   = num(i10?.overall10m?.score);
  const state10     = i10?.overall10m?.state || null;

  // 1h strip
  const breadth1    = num(m1h.breadth_1h_pct);
  const mom1        = num(m1h.momentum_combo_1h_pct ?? m1h.momentum_1h_pct);
  const sq1         = num(m1h.squeeze_1h_pct);                               // Expansion%
  const liq1        = num(m1h.liquidity_1h);
  const vol1        = num(m1h.volatility_1h_scaled ?? m1h.volatility_1h_pct);
  const rising1     = num(h1?.sectorDirection1h?.risingPct);
  const risk1       = num(h1?.riskOn1h?.riskOnPct);
  const overall1    = num(h1?.overall1h?.score);
  const state1      = h1?.overall1h?.state || null;

  // Daily values used for the daily strip (unchanged bindings)
  const td = dd?.trendDaily || {};
  const tdSlope   = num(td?.trend?.emaSlope);
  const tdTrend   = td?.trend?.state || null;
  const tdTrendVal= Number.isFinite(num(tdSlope)) ? (tdSlope > 5 ? 75 : tdSlope < -5 ? 25 : 50) : NaN;
  const tdPartPct = num(td?.participation?.pctAboveMA);
  const tdVolPct  = num(td?.volatilityRegime?.atrPct);
  const tdVolBand = td?.volatilityRegime?.band || null;
  const tdLiqPsi  = num(td?.liquidityRegime?.psi);
  const tdLiqBand = td?.liquidityRegime?.band || null;
  const tdRiskOn  = num(td?.rotation?.riskOnPct);
  const tdSdyDaily= Number.isFinite(num(dd?.metrics?.squeeze_daily_pct))
                    ? num(dd.metrics.squeeze_daily_pct) : NaN;

  /* ---------- layout: three strips side-by-side ---------- */
  const stripBox = {
    display:"flex", flexDirection:"column", gap:6, minWidth: 820, /* each strip stays on one line */
  };
  const lineBox = {
    display:"flex", gap:12, alignItems:"center", whiteSpace:"nowrap", overflowX:"auto", paddingBottom:2
  };

  return (
    <section id="row-2" className="panel" style={{padding:10}}>
      {/* header */}
      <div className="panel-head" style={{alignItems:"center"}}>
        <div className="panel-title">Market Meter — Stoplights</div>

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
        <LastUpdated ts={tsOf(live10 || live1h || liveEOD)} />
      </div>

      {/* three strips horizontally */}
      <div style={{ display:"flex", gap:28, alignItems:"flex-start", flexWrap:"wrap", marginTop:8 }}>

        {/* 10m strip */}
        <div style={stripBox}>
          <div className="small" style={{ color:"#9ca3af", fontWeight:800 }}>10m — Intraday Scalp</div>
          <div style={lineBox}>
            <Stoplight label="Overall" value={overall10} toneOverride={toneForOverallState(state10, overall10)} />
            <Stoplight label="Breadth" value={breadth10} toneOverride={toneForBreadth(breadth10)} />
            <Stoplight label="Momentum" value={mom10} toneOverride={toneForMomentum(mom10)} />
            <Stoplight label="Squeeze" value={sq10} toneOverride={toneForSqueeze(sq10)} />
            <Stoplight label="Liquidity" value={liq10} unit="PSI" toneOverride={toneForLiquidity(liq10)} />
            <Stoplight label="Volatility" value={vol10} toneOverride={toneForVol(vol10)} />
            <Stoplight label="Sector Dir" value={rising10} toneOverride={toneForPercent(rising10)} />
            <Stoplight label="Risk-On" value={risk10} toneOverride={toneForPercent(risk10)} />
          </div>
          <div style={{ color:"#9ca3af", fontSize:12 }}>
            Last 10-min: <strong>{fmtIso(ts10)}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;Δ5m updated: <strong>{fmtIso(deltaTs) || "—"}</strong>
          </div>
        </div>

        {/* 1h strip */}
        <div style={stripBox}>
          <div className="small" style={{ color:"#9ca3af", fontWeight:800 }}>1h — Hourly Valuation</div>
          <div style={lineBox}>
            <Stoplight label="Overall" value={overall1} toneOverride={toneForOverallState(state1, overall1)} />
            <Stoplight label="Breadth" value={breadth1} toneOverride={toneForBreadth(breadth1)} />
            <Stoplight label="Momentum" value={mom1} toneOverride={toneForMomentum(mom1)} />
            <Stoplight label="Squeeze" value={sq1} toneOverride={toneForSqueeze1h(sq1)} />
            <Stoplight label="Liquidity" value={liq1} unit="PSI" toneOverride={toneForLiquidity(liq1)} />
            <Stoplight label="Volatility" value={vol1} toneOverride={toneForVol(vol1)} />
            <Stoplight label="Sector Dir" value={rising1} toneOverride={toneForPercent(rising1)} />
            <Stoplight label="Risk-On" value={risk1} toneOverride={toneForPercent(risk1)} />
          </div>
          <div style={{ color:"#9ca3af", fontSize:12 }}>
            Last 1-hour: <strong>{fmtIso(ts1h)}</strong>
          </div>
        </div>

        {/* EOD strip (daily) */}
        <div style={stripBox}>
          <div className="small" style={{ color:"#9ca3af", fontWeight:800 }}>EOD — Daily Structure</div>
          <div style={lineBox}>
            <Stoplight label="Daily Trend" value={tdTrendVal} toneOverride={toneForDailyTrend(tdSlope)} />
            <Stoplight label="Participation" value={tdPartPct} toneOverride={toneForPercent(tdPartPct)} />
            <Stoplight label="Daily Squeeze" value={tdSdyDaily} toneOverride={toneForLuxDaily(tdSdyDaily)} />
            <Stoplight label="Vol Regime" value={tdVolPct} toneOverride={toneForVolBand(tdVolBand)} />
            <Stoplight label="Liq Regime" value={tdLiqPsi} unit="PSI" toneOverride={toneForLiqBand(tdLiqBand)} />
            <Stoplight label="Risk-On" value={tdRiskOn} toneOverride={toneForPercent(tdRiskOn)} />
          </div>
          <div style={{ color:"#9ca3af", fontSize:12 }}>
            Daily updated: <strong>{fmtIso(tsEOD)}</strong>
          </div>
        </div>

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
            <MarketMeterIntradayLegend />
            <MarketMeterDailyLegend />
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
