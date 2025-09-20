// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

// LIVE endpoints (raw GitHub)
const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;   // data-live-10min/data/outlook_intraday.json
const EOD_URL      = process.env.REACT_APP_EOD_URL;        // data-live-eod/data/outlook.json

// Backend API for replay
const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "";

/* ------------------------------ utils ------------------------------ */
function fmtIso(ts){ try{ return new Date(ts).toLocaleString(); }catch{ return ts; } }
const clamp01 = (n)=> Math.max(0, Math.min(100, Number(n)));
const pct = (n)=> (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v)=> (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

/* ---------------------------- Stoplight ---------------------------- */
function Stoplight({ label, value, baseline, size=54, unit="%", subtitle }) {
  const v = Number.isFinite(value) ? clamp01(value) : NaN;
  const delta = (Number.isFinite(v) && Number.isFinite(baseline)) ? v - baseline : NaN;
  const tone = Number.isFinite(v) ? toneFor(v) : "info";
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
      <div style={h2}>Overall Market Indicator</div>
      <div style={h2}>Daily Squeeze</div>
      <div style={h2}>Liquidity</div>
      <div style={h2}>Volatility</div>
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
      <select value={granularity} onChange={(e)=>setGranularity(e.target.value)} disabled={!on} className="px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm">
        <option value="10min">10m</option><option value="1h">1h</option><option value="1d">1d</option>
      </select>
      <select value={ts||""} onChange={(e)=>setTs(e.target.value)} disabled={!on||loading||options.length===0} className="min-w-[220px] px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm">
        {loading && <option value="">Loading…</option>}
        {!loading && options.length===0 && <option value="">No snapshots</option>}
        {!loading && options.length>0 && (<><option value="">Select time…</option>{options.map(o=><option key={o.ts} value={o.ts}>{fmtIso(o.ts)}</option>)}</>)}
      </select>
    </div>
  );
}

/* ------------------------------ Layout helper ----------------------------- */
function SectionLabel({text}){ return <div className="small" style={{color:"#9ca3af",fontWeight:800}}>{text}</div>; }

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
  const [indexOptions,setIndexOptions]=React.useState([]); const [loadingIdx,setLoadingIdx]=React.useState(false);
  const [snap,setSnap]=React.useState(null); const [loadingSnap,setLoadingSnap]=React.useState(false);
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

  // intraday gauges
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
  const squeezeIntra= Number(od?.squeezeCompressionPct ?? gg?.fuel?.pct ?? 50);
  const liquidity   = Number.isFinite(gg?.oil?.psi) ? Number(gg.oil.psi) : (Number.isFinite(gg?.oilPsi)?Number(gg.oilPsi):NaN);
  const volatility  = Number.isFinite(gg?.water?.pct) ? Number(gg.water.pct) : (Number.isFinite(gg?.volatilityPct)?Number(gg?.volatilityPct):NaN);
  const squeezeDailyIntra = Number.isFinite(gg?.squeezeDaily?.pct) ? Number(gg.squeezeDaily.pct) : null;

  const sectorDirCount = data?.intraday?.sectorDirection10m?.risingCount ?? null;
  const sectorDirPct   = data?.intraday?.sectorDirection10m?.risingPct ?? null;
  const riskOn10m      = data?.intraday?.riskOn10m?.riskOnPct ?? null;

  // baselines
  const bBreadth = useDailyBaseline("breadth", breadth);
  const bMomentum= useDailyBaseline("momentum", momentum);
  const bSqueezeIn=useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bLiquidity=useDailyBaseline("liquidity", liquidity);
  const bVol      =useDailyBaseline("volatility", volatility);

  // overall meter (not used on right now but keep calc if needed)
  const expansion  = 100 - clamp01(squeezeIntra);
  const baseMeter  = 0.4*breadth + 0.4*momentum + 0.2*expansion;
  const SdyIntra   = Number.isFinite(squeezeDailyIntra) ? clamp01(squeezeDailyIntra)/100 : 0;
  const meterValue = Math.round((1 - SdyIntra)*baseMeter + SdyIntra*50);

  // daily trend block (RIGHT)
  const td = daily?.trendDaily || {};
  const tdTrendState = td?.trend?.state || null;                       // "up" | "flat" | "down"
  const tdTrendVal   = tdTrendState==="up" ? 75 : tdTrendState==="flat" ? 50 : tdTrendState==="down" ? 25 : null;
  const tdPartPct    = td?.participation?.pctAboveMA ?? null;          // %
  const tdVolPct     = td?.volatilityRegime?.atrPct ?? null;           // %
  const tdLiqPsi     = td?.liquidityRegime?.psi ?? null;               // PSI
  const tdRiskOn     = td?.rotation?.riskOnPct ?? null;                // %
  const tdSdyDaily   = Number.isFinite(td?.squeezeDaily?.pct) ? Number(td.squeezeDaily.pct) : null;
  const tdUpdatedAt  = td?.updatedAt ?? null;

  return (
    <section id="row-2" className="panel" style={{padding:10}}>
      {/* Legend modal */}
      {legendOpen && (
        <div role="dialog" aria-modal="true" onClick={()=>setLegendOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:60}}>
          <div onClick={(e)=>e.stopPropagation()}
            style={{width:"min(880px,92vw)",background:"#0b0b0c",border:"1px solid #2b2b2b",borderRadius:12,padding:16,boxShadow:"0 10px 30px rgba(0,0,0,0.35)"}}>
            <LegendContent/>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
              <button onClick={()=>setLegendOpen(false)} style={{background:"#eab308",color:"#111827",border:"none",borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer"}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="panel-head" style={{alignItems:"center"}}>
        <div className="panel-title">Market Meter — Stoplights</div>
        <button onClick={()=>setLegendOpen(true)} style={{background:"#0b0b0b",color:"#e5e7eb",border:"1px solid #2b2b2b",borderRadius:8,padding:"6px 10px",fontWeight:600,cursor:"pointer",marginLeft:8}}>Legend</button>
        <div className="spacer" />
        <LastUpdated ts={ts}/>
        <ReplayControls
          on={on} setOn={setOn}
          granularity={granularity} setGranularity={setGranularity}
          ts={tsSel} setTs={setTsSel}
          options={indexOptions} loading={loadingIdx}
        />
      </div>

      {/* Two labeled halves in one row */}
      <div style={{display:"flex",justifyContent:"space-between",gap:18,marginTop:8,flexWrap:"wrap"}}>
        {/* LEFT: Intraday Scalp Lights */}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div className="small" style={{color:"#9ca3af",fontWeight:800}}>Intraday Scalp Lights</div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <Stoplight label="Breadth" value={breadth} baseline={bBreadth}/>
            <Stoplight label="Momentum" value={momentum} baseline={bMomentum}/>
            <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={bSqueezeIn}/>
            <Stoplight label="Liquidity" value={liquidity} baseline={bLiquidity} unit=""/>
            <Stoplight label="Volatility" value={volatility} baseline={bVol}/>
            <Stoplight label="Sector Direction (10m)" value={data?.intraday?.sectorDirection10m?.risingPct ?? null}
              baseline={data?.intraday?.sectorDirection10m?.risingPct ?? null}
              subtitle={Number.isFinite(sectorDirCount)?`${sectorDirCount}/11 rising`:undefined}/>
            <Stoplight label="Risk On (10m)" value={riskOn10m} baseline={riskOn10m}/>
          </div>
        </div>

        {/* RIGHT: Overall Market Trend Daily (with Daily Squeeze + Indicator) */}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div className="small" style={{color:"#9ca3af",fontWeight:800}}>Overall Market Trend Daily</div>
          <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"flex-end"}}>
            <Stoplight label="Indicator"          value={Math.round((tdPartPct??50)*0.4 + (tdTrendVal??50)*0.4 + (100-(squeezeIntra??50))*0.2)} baseline={50}/>
            <Stoplight label="Daily Trend"        value={tdTrendVal}  baseline={tdTrendVal}  subtitle={td?.trend?.state || undefined}/>
            <Stoplight label="Participation"      value={tdPartPct}   baseline={tdPartPct}/>
            <Stoplight label="Daily Squeeze"      value={tdSdyDaily}  baseline={tdSdyDaily}/>
            <Stoplight label="Volatility Regime"  value={tdVolPct}    baseline={tdVolPct}/>
            <Stoplight label="Liquidity Regime"   value={tdLiqPsi}    baseline={tdLiqPsi} unit=""/>
            <Stoplight label="Risk On (Daily)"    value={tdRiskOn}    baseline={tdRiskOn}/>
          </div>
          {tdUpdatedAt && <div className="text-xs" style={{color:"#9ca3af",textAlign:"right"}}>Daily updated {fmtIso(tdUpdatedAt)}</div>}
        </div>
      </div>

      <div className="text-xs text-neutral-500" style={{marginTop:4}}>
        {on ? (ts ? `Snapshot: ${fmtIso(ts)}` : "Replay ready")
            : (ts ? `Updated ${fmtIso(ts)}` : "")}
      </div>
    </section>
  );
}
