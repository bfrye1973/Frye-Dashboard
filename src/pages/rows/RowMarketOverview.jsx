// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";
import { MarketMeterIntradayLegend, MarketMeterDailyLegend } from "../../components/MarketMeterLegend";

// RAW GitHub live endpoints
const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;   // data-live-10min/data/outlook_intraday.json
const EOD_URL      = process.env.REACT_APP_EOD_URL;        // data-live-eod/data/outlook.json

// Backend API (replay)
const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "";

/* ------------------------------ utils ------------------------------ */
const clamp01 = (n)=> Math.max(0, Math.min(100, Number(n)));
const pct = (n)=> (Number.isFinite(n) ? n.toFixed(1) : "—");
function fmtIso(ts){ try{ return new Date(ts).toLocaleString(); }catch{ return ts; } }
const toneFor = (v)=> (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");
// Daily squeeze Lux tone: >85 red, else green
const toneForLuxSqueeze = (v)=> !Number.isFinite(v) ? "info" : (v > 85 ? "danger" : "ok");

/* ---------------------------- Stoplight ---------------------------- */
function Stoplight({ label, value, baseline, size=54, unit="%", subtitle, toneOverride }) {
  const v = Number.isFinite(value) ? clamp01(value) : NaN;
  const delta = (Number.isFinite(v) && Number.isFinite(baseline)) ? v - baseline : NaN;
  const tone = toneOverride || (Number.isFinite(v) ? (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger") : "info");
  const colors = {
    ok:{bg:"#22c55e",glow:"rgba(34,197,94,.45)"},
    warn:{bg:"#fbbf24",glow:"rgba(251,191,36,.45)"},
    danger:{bg:"#ef4444",glow:"rgba(239,68,68,.45)"},
    info:{bg:"#334155",glow:"rgba(51,65,85,.35)"}
  }[tone];
  const arrow =
    !Number.isFinite(delta) ? "→" :
    Math.abs(delta) < 0.5   ? "→" :
    delta > 0               ? "↑" : "↓";
  const deltaColor =
    !Number.isFinite(delta) ? "#94a3b8" :
    delta > 0               ? "#22c55e" :
    delta < 0               ? "#ef4444" : "#94a3b8";

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:size+36}}>
      <div title={`${label}: ${pct(v)}${unit==="%"?"%":""}`}
        style={{width:size,height:size,borderRadius:"50%",background:colors.bg,boxShadow:`0 0 12px ${colors.glow}`,
                display:"flex",alignItems:"center",justifyContent:"center",border:"4px solid #0c1320"}}>
        <div style={{fontWeight:800,fontSize:size>=100?20:16,color:"#0b1220"}}>
          {pct(v)}{unit==="%"?"%":""}
        </div>
      </div>
      <div className="small" style={{color:"#e5e7eb",fontWeight:700,fontSize:15,textAlign:"center"}}>{label}</div>
      {subtitle && <div style={{color:"#94a3b8",fontSize:12,fontWeight:600,textAlign:"center"}}>{subtitle}</div>}
      <div style={{color:deltaColor,fontSize:13,fontWeight:600}}>
        {arrow} {Number.isFinite(delta)?delta.toFixed(1):"0.0"}{unit==="%"?"%":""}
      </div>
    </div>
  );
}

/* -------------------------- Baselines ------------------------- */
const dayKey = ()=> new Date().toISOString().slice(0,10);
function useDailyBaseline(key, current){
  const [b,setB] = React.useState(null);
  React.useEffect(()=>{
    const k=`meter_baseline_${dayKey()}_${key}`;
    const s=localStorage.getItem(k);
    if(s===null && Number.isFinite(current)){ localStorage.setItem(k,String(current)); setB(current); }
    else if(s!==null){ const n=Number(s); setB(Number.isFinite(n)?n:null); }
  },[key]);
  React.useEffect(()=>{
    if(!Number.isFinite(current)) return;
    const k=`meter_baseline_${dayKey()}_${key}`;
    if(localStorage.getItem(k)===null){ localStorage.setItem(k,String(current)); setB(current); }
  },[key,current]);
  return b;
}

/* ----------------------------- Legend ------------------------------ */
function Tag({ bg, children }){ return <span style={{display:"inline-block",padding:"2px 6px",borderRadius:6,fontSize:12,marginLeft:6,background:bg,color:"#0f1115",fontWeight:700}}>{children}</span>; }
function LegendContent(){
  const h2={color:"#e5e7eb",margin:"6px 0 8px",fontSize:16,fontWeight:700};
  const ul={color:"#cbd5e1",fontSize:14,lineHeight:1.5,paddingLeft:18,margin:"4px 0 10px"};
  return (
    <div>
      <div style={h2}>Breadth</div>
      <ul style={ul}><li>0–34% <Tag bg="#ef4444">🔴 Weak</Tag></li><li>35–64% <Tag bg="#facc15">🟡 Neutral</Tag></li><li>65–84% <Tag bg="#22c55e">🟢 Strong</Tag></li><li>85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag></li></ul>
      <div style={h2}>Momentum</div>
      <ul style={ul}><li>0–34% <Tag bg="#ef4444">🔴 Bearish</Tag></li><li>35–64% <Tag bg="#facc15">🟡 Neutral</Tag></li><li>65–84% <Tag bg="#22c55e">🟢 Bullish</Tag></li><li>85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag></li></ul>
      <div style={h2}>Intraday Squeeze</div>
      <ul style={ul}><li>0–34% <Tag bg="#22c55e">🟢 Expanded</Tag></li><li>35–64% <Tag bg="#facc15">🟡 Normal</Tag></li><li>65–84% <Tag bg="#fb923c">🟠 Tight</Tag></li><li>85–100% <Tag bg="#ef4444">🔴 Critical</Tag></li></ul>
      <div style={h2}>Daily Squeeze</div>
      <p style={{color:"#cbd5e1",margin:"4px 0"}}>Lux PSI — <b>red &gt; 85%</b>, <b>green 0–84%</b>.</p>
      <div style={h2}>Volatility / Liquidity</div>
      <p style={{color:"#cbd5e1",margin:"4px 0"}}>Vol: ATR% / Liq: PSI.</p>
    </div>
  );
}

/* ------------------------------ Replay UI ----------------------------- */
function ReplayControls({ on, setOn, granularity, setGranularity, ts, setTs, options, loading }){
  return (
    <div className="flex items-center gap-2">
      <button onClick={()=>setOn(!on)}
        className={`px-3 py-1 rounded-full border text-sm ${on?"border-yellow-400 text-yellow-300 bg-neutral-800":"border-neutral-700 text-neutral-300 bg-neutral-900 hover:border-neutral-500"}`}>
        {on ? "Replay: ON" : "Replay: OFF"}
      </button>
      <select value={granularity} onChange={(e)=>setGranularity(e.target.value)} disabled={!on}
        className="px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm">
        <option value="10min">10m</option><option value="1h">1h</option><option value="1d">1d</option>
      </select>
      <select value={ts||""} onChange={(e)=>setTs(e.target.value)} disabled={!on||loading||options.length===0}
        className="min-w-[220px] px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm">
        {loading && <option value="">Loading…</option>}
        {!loading && options.length===0 && <option value="">No snapshots</option>}
        {!loading && options.length>0 && (<><option value="">Select time…</option>{options.map(o=><option key={o.ts} value={o.ts}>{fmtIso(o.ts)}</option>)}</>)}
      </select>
    </div>
  );
}

/* ------------------------------ Layout helper ----------------------------- */
const SectionLabel = ({text})=> <div className="small" style={{color:"#9ca3af",fontWeight:800}}>{text}</div>;

/* ========================== Main Row component ========================== */
export default function RowMarketOverview(){
  const { data: polled } = useDashboardPoll("dynamic");
  const [legendOpen,setLegendOpen]=React.useState(false);

  // LIVE fetch (intraday + daily)
  const [liveIntraday,setLiveIntraday]=React.useState(null);
  const [liveDaily,setLiveDaily]=React.useState(null);
  React.useEffect(()=>{ let c=false;(async()=>{
    try{ if(INTRADAY_URL){ const r=await fetch(`${INTRADAY_URL}?t=${Date.now()}`,{cache:"no-store"}); const j=await r.json(); if(!c) setLiveIntraday(j); } }catch{}
    try{ if(EOD_URL){ const r=await fetch(`${EOD_URL}?t=${Date.now()}`,{cache:"no-store"}); const j=await r.json(); if(!c) setLiveDaily(j); } }catch{}
  })(); return ()=>{c=true}; },[]);

  // Replay
  const [on,setOn]=React.useState(false);
  const [granularity,setGranularity]=React.useState("10min");
  const [tsSel,setTsSel]=React.useState("");
  const [indexOptions,setIndexOptions]=React.useState([]);
  const [loadingIdx,setLoadingIdx]=React.useState(false);
  const [snap,setSnap]=React.useState(null);
  const [loadingSnap,setLoadingSnap]=React.useState(false);
  const granParam = granularity==="10min"?"10min":(granularity==="1h"?"hourly":"eod");

  React.useEffect(()=>{ if(!on){setIndexOptions([]);return;} (async()=>{ try{ setLoadingIdx(true);
    const r=await fetch(`${API}/api/replay/index?granularity=${granParam}&t=${Date.now()}`,{cache:"no-store"}); const j=await r.json();
    const items=Array.isArray(j?.items)?j.items:[]; setIndexOptions(items); if(items.length && !tsSel) setTsSel(items[0].ts);
  }finally{ setLoadingIdx(false); } })(); },[on,granParam]);

  React.useEffect(()=>{ if(!on||!tsSel){setSnap(null);return;} (async()=>{ try{ setLoadingSnap(true);
    const r=await fetch(`${API}/api/replay/at?granularity=${granParam}&ts=${encodeURIComponent(tsSel)}&t=${Date.now()}`,{cache:"no-store"}); const j=await r.json(); setSnap(j);
  }catch{ setSnap(null);} finally{ setLoadingSnap(false); } })(); },[on,tsSel,granParam]);

  // choose data: replay → live intraday → polled
  const data  = on && snap && snap.ok!==false ? snap : (liveIntraday || polled);
  const daily = liveDaily || {};

  // intraday (LEFT) — keep these from intraday JSON
  const gg = data?.gauges ?? {};
  const od = data?.odometers ?? {};
  const ts =
    data?.marketMeter?.updatedAt ??
    data?.meta?.ts ??
    data?.updated_at ??
    data?.ts ??
    null;

  const breadth     = Number(od?.breadthOdometer ?? data?.summary?.breadthIdx ?? gg?.rpm?.pct ?? 50);
  const momentum    = Number(od?.momentumOdometer ?? data?.summary?.momentumIdx ?? gg?.speed?.pct ?? 50);
  const squeezeIntra= Number(od?.squeezeCompressionPct ?? gg?.fuel?.pct ?? 50); // <-- intraday squeeze (fuel)
  const liquidity   = Number.isFinite(gg?.oil?.psi) ? Number(gg.oil.psi) : (Number.isFinite(gg?.oilPsi)?Number(gg.oilPsi):NaN);
  const volatility  = Number.isFinite(gg?.water?.pct) ? Number(gg.water.pct) : (Number.isFinite(gg?.volatilityPct)?Number(gg?.volatilityPct):NaN);

  const sectorDirCount = data?.intraday?.sectorDirection10m?.risingCount ?? null;
  const sectorDirPct   = data?.intraday?.sectorDirection10m?.risingPct ?? null;
  const riskOn10m      = data?.intraday?.riskOn10m?.riskOnPct ?? null;

  // baselines for intraday
  const bBreadth = useDailyBaseline("breadth", breadth);
  const bMomentum= useDailyBaseline("momentum", momentum);
  const bSqueezeIn=useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bLiquidity=useDailyBaseline("liquidity", liquidity);
  const bVol      =useDailyBaseline("volatility", volatility);

  // daily (RIGHT) — use trendDaily block; fallback gauge if squeezeDaily null
  const td = daily?.trendDaily || {};
  const tdTrendState = td?.trend?.state || null; // "up" | "flat" | "down"
  const tdTrendVal   = tdTrendState==="up" ? 75 : tdTrendState==="flat" ? 50 : tdTrendState==="down" ? 25 : null;
  const tdPartPct    = td?.participation?.pctAboveMA ?? null;
  const tdVolPct     = td?.volatilityRegime?.atrPct ?? null;
  const tdLiqPsi     = td?.liquidityRegime?.psi ?? null;
  const tdRiskOn     = td?.rotation?.riskOnPct ?? null;
  const tdSdyDaily   = Number.isFinite(td?.squeezeDaily?.pct) ? Number(td.squeezeDaily.pct)
                        : (Number.isFinite(gg?.squeezeDaily?.pct) ? Number(gg.squeezeDaily.pct) : null);
  const tdUpdatedAt  = td?.updatedAt ?? null;

  return (
    <section id="row-2" className="panel" style={{padding:10}}>
      {/* Legend modal */}
      {/* eslint-disable-next-line */}
      {legendOpen && (
        <div role="dialog" aria-modal="true" onClick={()=>setLegendOpen(false)} style={...}>
          <div onClick={(e)=>e.stopPropagation()} style={...}>
            {legendOpen === "intraday" && <IntradayLegendContent />}
            {legendOpen === "daily" && <DailyLegendContent />}
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
              <button onClick={()=>setLegendOpen(false)} style={{...}}>Close</button>
             </div>
           </div>
         </div>
       )}

      {/* Header */}
      <div className="panel-title">Market Meter — Stoplights</div>

      {/* Intraday Legend Button */}
      <button 
        onClick={()=>setLegendOpen("intraday")} 
        style={{
          background:"#0b0b0b",color:"#e5e7eb",
          border:"1px solid #2b2b2b",borderRadius:8,
          padding:"6px 10px",fontWeight:600,cursor:"pointer",marginLeft:8
       }}>
       Intraday Legend
      </button>

      {/* Daily Legend Button */}
      <button 
       onClick={()=>setLegendOpen("daily")} 
       style={{
         background:"#0b0b0b",color:"#e5e7eb",
         border:"1px solid #2b2b2b",borderRadius:8,
         padding:"6px 10px",fontWeight:600,cursor:"pointer",marginLeft:8
       }}>
       Daily Legend
      </button>

      {/* Two labeled halves */}
      <div style={{display:"flex",justifyContent:"space-between",gap:18,marginTop:8,flexWrap:"wrap"}}>
        {/* LEFT: Intraday Scalp Lights */}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div className="small" style={{color:"#9ca3af",fontWeight:800}}>Intraday Scalp Lights</div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <Stoplight label="Breadth" value={breadth} baseline={bBreadth}/>
            <Stoplight label="Momentum" value={momentum} baseline={bMomentum}/>
            <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={squeezeIntra}/>
            <Stoplight label="Liquidity" value={liquidity} baseline={bLiquidity} unit=""/>
            <Stoplight label="Volatility" value={volatility} baseline={bVol}/>
            <Stoplight label="Sector Direction (10m)"
              value={data?.intraday?.sectorDirection10m?.risingPct ?? null}
              baseline={data?.intraday?.sectorDirection10m?.risingPct ?? null}
              subtitle={Number.isFinite((data?.intraday?.sectorDirection10m?.risingCount))?
                `${data?.intraday?.sectorDirection10m?.risingCount}/11 rising`:undefined}/>
            <Stoplight label="Risk On (10m)" value={riskOn10m} baseline={riskOn10m}/>
          </div>
        </div>

        {/* RIGHT: Overall Market Trend Daily */}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div className="small" style={{color:"#9ca3af",fontWeight:800}}>Overall Market Trend Daily</div>
          <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"flex-end"}}>
            <Stoplight label="Daily Trend"        value={tdTrendVal}  baseline={tdTrendVal}  subtitle={tdTrendState || undefined}/>
            <Stoplight label="Participation"      value={tdPartPct}   baseline={tdPartPct}/>
            <Stoplight label="Daily Squeeze"      value={tdSdyDaily}  baseline={tdSdyDaily} toneOverride={toneForLuxSqueeze(tdSdyDaily)}/>
            <Stoplight label="Volatility Regime"  value={tdVolPct}    baseline={tdVolPct}/>
            <Stoplight label="Liquidity Regime"   value={tdLiqPsi}    baseline={tdLiqPsi} unit=""/>
            <Stoplight label="Risk On (Daily)"    value={tdRiskOn}    baseline={tdRiskOn}/>
          </div>
          {td?.updatedAt && <div className="text-xs" style={{color:"#9ca3af",textAlign:"right"}}>Daily updated {fmtIso(td.updatedAt)}</div>}
        </div>
      </div>

      <div className="text-xs text-neutral-500" style={{marginTop:4}}>
        {on ? (ts ? `Snapshot: ${fmtIso(ts)}` : "Replay ready")
            : (ts ? `Updated ${fmtIso(ts)}` : "")}
      </div>
    </section>
  );
}
