import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";
const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ROUTE = `${API_ROOT}/live/eod-shadow`;

const COLORS = {
  bg:"#020617", panel:"#0b1220", border:"#263244", text:"#f8fafc",
  muted:"#94a3b8", green:"#22c55e", red:"#ef4444", yellow:"#fbbf24",
  blue:"#38bdf8", purple:"#c084fc"
};

const LEGACY = {
  "10/29":{
    "tech":[224,157,27,23],"consumer discretionary":[205,99,14,17],"healthcare":[379,68,37,11],
    "financials":[333,100,30,21],"energy":[96,39,5,7],"industrials":[254,83,29,10],"materials":[84,66,2,11]
  },
  "10/28":{
    "tech":[215,119,25,19],"consumer discretionary":[102,128,8,16],"healthcare":[285,127,30,9],
    "financials":[194,96,24,22],"energy":[87,30,4,4],"industrials":[169,88,16,8],"materials":[70,36,3,5]
  },
  "10/27":{
    "tech":[203,175,25,34],"consumer discretionary":[120,117,9,19],"healthcare":[211,164,27,7],
    "financials":[277,126,37,25],"energy":[90,37,2,4],"industrials":[150,93,26,13],"materials":[60,99,4,15]
  }
};

const REBUILT = {
  "10/29":{
    "tech":[223,158,30,23],"consumer discretionary":[179,105,36,6],"healthcare":[339,79,43,18],
    "financials":[301,105,48,31],"energy":[90,31,6,4],"industrials":[253,106,46,11],"materials":[79,43,6,9]
  },
  "10/28":{
    "tech":[227,177,30,18],"consumer discretionary":[99,113,17,13],"healthcare":[258,97,31,18],
    "financials":[198,103,36,36],"energy":[85,25,11,4],"industrials":[172,108,26,12],"materials":[64,75,4,4]
  },
  "10/27":{
    "tech":[195,222,22,9],"consumer discretionary":[103,107,9,10],"healthcare":[162,148,22,18],
    "financials":[285,127,47,31],"energy":[89,38,4,4],"industrials":[143,127,19,11],"materials":[52,123,4,6]
  }
};


const PRIMARY_LEGACY = {
  "10/29":{
    indices:{QQQ:"RED",SPY:"RED",MDY:"GREEN",IWM:"GREEN"},
    caps:{
      all:[2160,1047,301,259],
      large:[392,125,37,14],
      mid:[476,155,44,21],
      small:[1292,767,220,224]
    }
  },
  "10/28":{
    indices:{QQQ:"GREEN",SPY:"GREEN",MDY:"GREEN",IWM:"GREEN"},
    caps:{
      all:[1626,1035,258,251],
      large:[212,104,30,11],
      mid:[333,159,32,15],
      small:[1081,772,196,225]
    }
  },
  "10/27":{
    indices:{QQQ:"YELLOW",SPY:"GREEN",MDY:"GREEN",IWM:"GREEN"},
    caps:{
      all:[1626,1205,276,297],
      large:[224,99,46,17],
      mid:[382,170,39,16],
      small:[1020,936,191,264]
    }
  }
};

const PRIMARY_REBUILT = {
  "10/29":{
    indices:{ES:"RED",QQQ:"RED",MDY:"GREEN",IWM:"GREEN"},
    caps:{
      all:[1660,859,222,129],
      large:[341,142,60,32],
      mid:[420,159,44,16],
      small:[897,553,117,77]
    }
  },
  "10/28":{
    indices:{ES:"YELLOW",QQQ:"GREEN",MDY:"GREEN",IWM:"GREEN"},
    caps:{
      all:[null,null,null,null],
      large:[null,null,null,null],
      mid:[null,null,null,null],
      small:[null,null,null,null]
    }
  },
  "10/27":{
    indices:{ES:"GREEN",QQQ:"GREEN",MDY:"GREEN",IWM:"GREEN"},
    caps:{
      all:[null,null,null,null],
      large:[null,null,null,null],
      mid:[null,null,null,null],
      small:[null,null,null,null]
    }
  }
};

function canon(s=""){
  const k=String(s).trim().toLowerCase();
  if(k==="technology"||k==="information technology") return "tech";
  if(k==="health care") return "healthcare";
  return k;
}
function pct(a,b){ const d=Number(a)+Number(b); return d>0 ? 100*Number(a)/d : 50; }
function colorScore(x){ return x>=60?COLORS.green:x<=40?COLORS.red:COLORS.yellow; }

function trendArrow(current, prior){
  const a=Number(current), b=Number(prior);
  if(!Number.isFinite(a)||!Number.isFinite(b)) return "→";
  return a>b?"↑":a<b?"↓":"→";
}

function breadthState(current, prior){
  const nh=Number(current?.nh), nl=Number(current?.nl);
  const pnh=Number(prior?.nh), pnl=Number(prior?.nl);
  if(![nh,nl,pnh,pnl].every(Number.isFinite)){
    return {key:"UNAVAILABLE",label:"WAITING FOR PRIOR DAY",color:COLORS.muted,detail:"Prior-session breadth is unavailable."};
  }
  if(nh>nl && nh>pnh && nl<pnl){
    return {key:"BULLISH_EXPANSION",label:"BULLISH EXPANSION",color:COLORS.green,detail:"New highs are expanding while new lows contract."};
  }
  if(nl>nh && nl>pnl && nh<pnh){
    return {key:"BEARISH_EXPANSION",label:"BEARISH EXPANSION",color:COLORS.red,detail:"New lows are expanding while new highs contract."};
  }
  if(nh>nl && nh<pnh){
    return {key:"BULLISH_CONTRACTION",label:"PULLBACK IN UPTREND",color:COLORS.yellow,detail:"New highs are contracting but still exceed new lows."};
  }
  if(nl>nh && nl<pnl){
    return {key:"BEARISH_CONTRACTION",label:"PULLBACK IN DOWNTREND",color:COLORS.yellow,detail:"New lows are contracting but still exceed new highs."};
  }
  return {key:"MIXED",label:"MIXED ENVIRONMENT",color:COLORS.yellow,detail:"Breadth is mixed or changing without a clean expansion/contraction pattern."};
}

function MiniLines({rows, aKey, bKey, aLabel, bLabel}){
  if(!rows.length) return null;
  const W=340,H=90,P=14;
  const vals=rows.flatMap(r=>[Number(r[aKey]||0),Number(r[bKey]||0)]);
  const max=Math.max(1,...vals);
  const path=(key)=>rows.map((r,i)=>{
    const x=P+(rows.length===1?0:(i/(rows.length-1))*(W-P*2));
    const y=H-P-(Number(r[key]||0)/max)*(H-P*2);
    return `${i?"L":"M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return <div style={{background:"#fff",borderRadius:8,padding:8}}>
    <div style={{fontSize:12,fontWeight:800,color:"#334155",marginBottom:4}}>{aLabel} vs {bLabel}</div>
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",display:"block"}}>
      <path d={path(aKey)} fill="none" stroke="#16a34a" strokeWidth="3"/>
      <path d={path(bKey)} fill="none" stroke="#ef4444" strokeWidth="3"/>
    </svg>
  </div>
}

export default function Engine25EodStructureDetail(){
  const [data,setData]=useState(null);
  const [error,setError]=useState(null);
  const [date,setDate]=useState("10/29");

  useEffect(()=>{ let alive=true;
    async function load(){
      try{ const r=await fetch(ROUTE,{cache:"no-store"}); const j=await r.json();
        if(!r.ok||j?.ok===false) throw new Error(j?.error||`HTTP ${r.status}`);
        if(alive){setData(j);setError(null);}
      }catch(e){if(alive)setError(e?.message||String(e));}
    }
    load(); const id=setInterval(load,60000); return()=>{alive=false;clearInterval(id)};
  },[]);

  const current=Array.isArray(data?.sectorCards)?data.sectorCards:[];
  const currentRows=current.map(c=>{
    const prior=data?.sectorPrior?.[c.sector]||null;
    const state=breadthState(c,prior);
    return {
      sector:c.sector,nh:c.nh,nl:c.nl,up:c.up,down:c.down,
      breadth:pct(c.nh,c.nl),momentum:pct(c.up,c.down),
      prior,state
    };
  });

  const overallBreadthState=breadthState(
    data?.capGroups?.all||null,
    data?.capGroups?.all?.prior||null
  );

  const validationRows=useMemo(()=>{
    const legacy=LEGACY[date]||{}, rebuilt=REBUILT[date]||{};
    return Object.keys(legacy).map(k=>{
      const a=legacy[k],b=rebuilt[k];
      return {sector:k,lnh:a[0],lnl:a[1],lup:a[2],ldn:a[3],rnh:b[0],rnl:b[1],rup:b[2],rdn:b[3]};
    });
  },[date]);

  const chartRows=currentRows.slice().sort((a,b)=>String(a.sector).localeCompare(String(b.sector)));

  const cell=(v,color)=>({padding:"7px 9px",textAlign:"right",borderBottom:"1px solid #223047",color:color||COLORS.text,fontWeight:800});
  const head={padding:"7px 9px",textAlign:"right",background:"#172033",color:"#cbd5e1",fontSize:11,textTransform:"uppercase"};
  return <div
    style={{
      height:"calc(100vh - 34px)",
      overflowY:"auto",
      overflowX:"hidden",
      background:COLORS.bg,
      color:COLORS.text,
      padding:"18px 22px 40px",
      fontFamily:"Arial,Helvetica,sans-serif",
      boxSizing:"border-box",
      scrollbarGutter:"stable",
    }}
  >
    <div style={{maxWidth:1900,margin:"0 auto",display:"grid",gap:14,minWidth:0}}>
      <div
        style={{
          position:"sticky",
          top:0,
          zIndex:20,
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          gap:12,
          padding:"8px 0 10px",
          background:"linear-gradient(180deg, rgba(2,6,23,1) 72%, rgba(2,6,23,.94) 88%, rgba(2,6,23,0))",
          backdropFilter:"blur(4px)",
        }}
      >
        <div>
          <div style={{fontSize:25,fontWeight:1000}}>ENGINE 25 — EOD STRUCTURE DETAIL</div>
          <div style={{color:COLORS.muted,marginTop:4}}>Reconstructed EOD v1 shadow · spreadsheet-style validation view</div>
        </div>
        <Link to="/" style={{color:COLORS.blue,fontWeight:900,textDecoration:"none"}}>← BACK TO MARKET X-RAY</Link>
      </div>

      {error&&<div style={{border:"1px solid #7f1d1d",padding:10,borderRadius:8,color:"#fecaca"}}>{error}</div>}

      <div
        style={{
          position:"sticky",
          top:64,
          zIndex:15,
          padding:"6px 0 8px",
          background:"linear-gradient(180deg, rgba(2,6,23,.98), rgba(2,6,23,.94))",
          borderBottom:"1px solid rgba(148,163,184,.08)",
        }}
      >
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:8}}>
        {[
          ["EOD STRUCTURE",data?.score,data?.state],
          ["BREADTH",data?.breadthScore,"10NH vs 10NL"],
          ["MOMENTUM",data?.momentumScore,"3ADR up vs down"],
          ["SESSION",data?.completedSessionDate,"last completed equity day"],
          ["MODE","SHADOW","does not alter production EOD"],
        ].map(([l,v,note])=><div key={l} style={{background:COLORS.panel,border:"1px solid "+COLORS.border,borderRadius:9,padding:10}}>
          <div style={{fontSize:10,color:COLORS.muted,fontWeight:900}}>{l}</div>
          <div style={{fontSize:23,fontWeight:1000,marginTop:3,color:typeof v==="number"?colorScore(v):COLORS.text}}>{v??"—"}</div>
          <div style={{fontSize:10,color:COLORS.muted,marginTop:3}}>{note}</div>
        </div>)}
        </div>
      </div>

      <div
        style={{
          border:"1px solid "+overallBreadthState.color+"66",
          borderLeft:"4px solid "+overallBreadthState.color,
          borderRadius:10,
          padding:"10px 12px",
          background:"#0b1220"
        }}
      >
        <div style={{fontSize:10,color:COLORS.muted,fontWeight:900,letterSpacing:".05em"}}>BREADTH ENVIRONMENT</div>
        <div style={{fontSize:20,fontWeight:1000,color:overallBreadthState.color,marginTop:2}}>{overallBreadthState.label}</div>
        <div style={{fontSize:11,color:COLORS.muted,marginTop:3}}>{overallBreadthState.detail}</div>
      </div>

      <div style={{background:COLORS.panel,border:"1px solid "+COLORS.border,borderRadius:10,padding:12}}>
        <div style={{fontWeight:1000,fontSize:16,marginBottom:8}}>PRIMARY — INDICES VS MAs + MARKET-CAP BREADTH</div>
        <div style={{color:COLORS.muted,fontSize:11,marginBottom:10}}>
          Index colors follow the old spreadsheet rule: green = 10/20 MAs both upsloping, yellow = mixed slope, red = both downsloping.
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginBottom:10}}>
          {["ES","QQQ","MDY","IWM"].map(sym=>{
            const r=data?.indicesVsMAs?.[sym]||null;
            const state=String(r?.state||"UNAVAILABLE").toUpperCase();
            const color=state==="GREEN"?COLORS.green:state==="RED"?COLORS.red:state==="YELLOW"?COLORS.yellow:COLORS.muted;
            return <div key={sym} style={{border:"1px solid "+color+"77",background:"#0f172a",borderRadius:8,padding:9}}>
              <div style={{fontSize:10,color:COLORS.muted,fontWeight:900}}>{sym}</div>
              <div style={{fontSize:19,fontWeight:1000,color,marginTop:2}}>{state}</div>
              <div style={{fontSize:10,color:COLORS.muted,marginTop:3}}>
                {r?.available===true
                  ? `10MA ${r.ma10Upsloping?"↑":"↓"} · 20MA ${r.ma20Upsloping?"↑":"↓"} · ${r.sessionDate||"—"}`
                  : r?.reason||"waiting for feed"}
              </div>
            </div>
          })}
        </div>

        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",minWidth:900,borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              <th style={{...head,textAlign:"left"}}>Universe</th>
              <th style={head}>Members</th><th style={head}>10NH</th><th style={head}>10NL</th>
              <th style={head}>5U*</th><th style={head}>5D*</th>
              <th style={head}>Breadth %</th><th style={head}>Momentum %</th><th style={head}>Breadth State</th>
            </tr></thead>
            <tbody>
              {[
                ["All Stocks","all"],
                ["Large Cap","large"],
                ["Mid Cap","mid"],
                ["Small Cap","small"],
              ].map(([label,key])=>{
                const g=data?.capGroups?.[key]||{};
                const prior=g?.prior||null;
                const state=breadthState(g,prior);
                return <tr key={key}>
                  <td style={{...cell(label),textAlign:"left"}}>{label}</td>
                  <td style={cell(g.members)}>{g.members??"—"}</td>
                  <td style={cell(g.nh,COLORS.green)}>{g.nh??"—"} <span style={{color:COLORS.muted}}>{trendArrow(g.nh,prior?.nh)}</span></td>
                  <td style={cell(g.nl,COLORS.red)}>{g.nl??"—"} <span style={{color:COLORS.muted}}>{trendArrow(g.nl,prior?.nl)}</span></td>
                  <td style={cell(g.up,COLORS.green)}>{g.up??"—"} <span style={{color:COLORS.muted}}>{trendArrow(g.up,prior?.up)}</span></td>
                  <td style={cell(g.down,COLORS.red)}>{g.down??"—"} <span style={{color:COLORS.muted}}>{trendArrow(g.down,prior?.down)}</span></td>
                  <td style={cell(g.breadth_pct,colorScore(Number(g.breadth_pct??50)))}>{g.breadth_pct==null?"—":Number(g.breadth_pct).toFixed(1)}</td>
                  <td style={cell(g.momentum_pct,colorScore(Number(g.momentum_pct??50)))}>{g.momentum_pct==null?"—":Number(g.momentum_pct).toFixed(1)}</td>
                  <td style={cell(state.label,state.color)}>{state.label}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>

        <div style={{fontSize:10,color:COLORS.muted,marginTop:7,lineHeight:1.45}}>
          Cap buckets: Large ≥ $10B · Mid $2B–$10B · Small &lt; $2B. Classification coverage: {data?.capGroups?.classificationCoveragePct??"—"}%.
          {data?.capGroups?.marketCapAvailable===false ? ` Market-cap feed unavailable: ${data?.capGroups?.marketCapReason||"unknown"}.` : ""}
        </div>
      </div>

      <div style={{background:COLORS.panel,border:"1px solid "+COLORS.border,borderRadius:10,padding:12,overflowX:"auto"}}>
        <div style={{fontWeight:1000,fontSize:16,marginBottom:8}}>CURRENT RECONSTRUCTED EOD — RAW SECTOR COUNTS</div>
        <table style={{width:"100%",minWidth:900,borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>
            <th style={{...head,textAlign:"left"}}>Sector</th><th style={head}>10NH</th><th style={head}>10NL</th>
            <th style={head}>Breadth %</th><th style={head}>5U*</th><th style={head}>5D*</th><th style={head}>Momentum %</th><th style={head}>Breadth State</th>
          </tr></thead>
          <tbody>{currentRows.map(r=><tr key={r.sector}>
            <td style={{...cell(r.sector),textAlign:"left"}}>{r.sector}</td>
            <td style={cell(r.nh,COLORS.green)}>{r.nh} <span style={{color:COLORS.muted}}>{trendArrow(r.nh,r.prior?.nh)}</span></td>
            <td style={cell(r.nl,COLORS.red)}>{r.nl} <span style={{color:COLORS.muted}}>{trendArrow(r.nl,r.prior?.nl)}</span></td>
            <td style={cell(r.breadth,colorScore(r.breadth))}>{r.breadth.toFixed(1)}</td>
            <td style={cell(r.up,COLORS.green)}>{r.up} <span style={{color:COLORS.muted}}>{trendArrow(r.up,r.prior?.up)}</span></td>
            <td style={cell(r.down,COLORS.red)}>{r.down} <span style={{color:COLORS.muted}}>{trendArrow(r.down,r.prior?.down)}</span></td>
            <td style={cell(r.momentum,colorScore(r.momentum))}>{r.momentum.toFixed(1)}</td>
            <td style={cell(r.state.label,r.state.color)}>{r.state.label}</td>
          </tr>)}</tbody>
        </table>
        <div style={{fontSize:10,color:COLORS.muted,marginTop:7}}>*5U / 5D are legacy display labels. Reconstructed v1 momentum is the 4-session close move versus ±3× ADR20.</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(420px,1fr))",gap:12,minWidth:0}}>
        <MiniLines rows={chartRows} aKey="nh" bKey="nl" aLabel="10NH" bLabel="10NL"/>
        <MiniLines rows={chartRows} aKey="up" bKey="down" aLabel="5U" bLabel="5D"/>
      </div>

      <div style={{background:COLORS.panel,border:"1px solid "+COLORS.border,borderRadius:10,padding:12}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontWeight:1000,fontSize:16}}>LEGACY SPREADSHEET CHECK</div>
            <div style={{color:COLORS.muted,fontSize:11,marginTop:2}}>Old sheet numbers beside the historical reconstruction we validated.</div>
          </div>
          <div style={{display:"flex",gap:6}}>{["10/27","10/28","10/29"].map(d=><button key={d} onClick={()=>setDate(d)}
            style={{border:"1px solid "+(date===d?COLORS.blue:COLORS.border),background:date===d?"#082f49":"#0f172a",color:date===d?"#bae6fd":"#cbd5e1",borderRadius:7,padding:"6px 10px",fontWeight:900,cursor:"pointer"}}>{d}</button>)}</div>
        </div>

        <div style={{marginBottom:12,border:"1px solid "+COLORS.border,borderRadius:8,padding:10,background:"#09111f"}}>
          <div style={{fontWeight:1000,fontSize:13,marginBottom:7}}>PRIMARY CHECK — INDICES VS MAs</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>
            {["ES","QQQ","MDY","IWM"].map(sym=>{
              const legacySym=sym==="ES"?"SPY":sym;
              const sheet=PRIMARY_LEGACY?.[date]?.indices?.[legacySym]||"—";
              const rebuilt=PRIMARY_REBUILT?.[date]?.indices?.[sym]||"—";
              const stateColor=s=>s==="GREEN"?COLORS.green:s==="RED"?COLORS.red:s==="YELLOW"?COLORS.yellow:COLORS.muted;
              return <div key={sym} style={{border:"1px solid "+COLORS.border,borderRadius:7,padding:8,background:"#0f172a"}}>
                <div style={{fontSize:10,color:COLORS.muted,fontWeight:900}}>{sym}{sym==="ES"?" (replaces SPY)":""}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:5}}>
                  <div>
                    <div style={{fontSize:9,color:COLORS.muted}}>SHEET</div>
                    <div style={{fontWeight:1000,color:stateColor(sheet)}}>{sheet}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:COLORS.muted}}>REBUILT</div>
                    <div style={{fontWeight:1000,color:stateColor(rebuilt)}}>{rebuilt}</div>
                  </div>
                </div>
              </div>
            })}
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontWeight:1000,fontSize:13,marginBottom:7}}>PRIMARY CHECK — ALL / LARGE / MID / SMALL</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",minWidth:980,borderCollapse:"collapse",fontSize:11}}>
              <thead><tr>
                <th style={{...head,textAlign:"left"}}>Universe</th>
                <th style={head}>Sheet 10NH</th><th style={head}>Rebuilt 10NH</th>
                <th style={head}>Sheet 10NL</th><th style={head}>Rebuilt 10NL</th>
                <th style={head}>Sheet 5U</th><th style={head}>Rebuilt 5U</th>
                <th style={head}>Sheet 5D</th><th style={head}>Rebuilt 5D</th>
              </tr></thead>
              <tbody>{[
                ["All Stocks","all"],["Large Cap","large"],["Mid Cap","mid"],["Small Cap","small"]
              ].map(([label,key])=>{
                const a=PRIMARY_LEGACY?.[date]?.caps?.[key]||[];
                const b=PRIMARY_REBUILT?.[date]?.caps?.[key]||[];
                const show=v=>v==null?"—":v;
                return <tr key={key}>
                  <td style={{...cell(label),textAlign:"left"}}>{label}</td>
                  <td style={cell(a[0])}>{show(a[0])}</td><td style={cell(b[0],COLORS.green)}>{show(b[0])}</td>
                  <td style={cell(a[1])}>{show(a[1])}</td><td style={cell(b[1],COLORS.red)}>{show(b[1])}</td>
                  <td style={cell(a[2])}>{show(a[2])}</td><td style={cell(b[2],COLORS.green)}>{show(b[2])}</td>
                  <td style={cell(a[3])}>{show(a[3])}</td><td style={cell(b[3],COLORS.red)}>{show(b[3])}</td>
                </tr>
              })}</tbody>
            </table>
          </div>
          <div style={{fontSize:10,color:COLORS.muted,marginTop:5}}>
            Rebuilt cap values are shown where historical cap reconstruction has been completed. Blank values remain explicit rather than estimated.
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",minWidth:900,borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              <th style={{...head,textAlign:"left"}}>Sector</th>
              <th style={head}>Sheet 10NH</th><th style={head}>Rebuilt 10NH</th>
              <th style={head}>Sheet 10NL</th><th style={head}>Rebuilt 10NL</th>
              <th style={head}>Sheet 5U</th><th style={head}>Rebuilt 5U</th>
              <th style={head}>Sheet 5D</th><th style={head}>Rebuilt 5D</th>
            </tr></thead>
            <tbody>{validationRows.map(r=><tr key={r.sector}>
              <td style={{...cell(r.sector),textAlign:"left",textTransform:"capitalize"}}>{r.sector}</td>
              <td style={cell(r.lnh)}>{r.lnh}</td><td style={cell(r.rnh,COLORS.green)}>{r.rnh}</td>
              <td style={cell(r.lnl)}>{r.lnl}</td><td style={cell(r.rnl,COLORS.red)}>{r.rnl}</td>
              <td style={cell(r.lup)}>{r.lup}</td><td style={cell(r.rup,COLORS.green)}>{r.rup}</td>
              <td style={cell(r.ldn)}>{r.ldn}</td><td style={cell(r.rdn,COLORS.red)}>{r.rdn}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>

      <div style={{color:COLORS.muted,fontSize:11,lineHeight:1.5}}>
        Frozen v1 formula: breadth = 10-session HIGH/LOW event with 2-session carry. Momentum = 4-session close move versus ±3× 20-session ADR. This page is research/shadow only.
      </div>

      <div style={{height:24}} />
    </div>
  </div>;
}
