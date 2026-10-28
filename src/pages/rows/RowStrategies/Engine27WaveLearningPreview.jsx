import React, {useState} from "react";

// Read-only owner-chart reference preview. This is NOT historical journal data.
// Do not fabricate Replay events, trade success, or Fibonacci touch history.
const TIMELINES = {
 MICRO: {
  label:"Micro",reference:"W3 UP",
  entries:[
   {at:"Oct 25 · 3:00 PM",text:"W1 low",price:"7,651.75"},
   {at:"Oct 26 · 8:00 AM",text:"W1 high",price:"7,739.50"},
   {at:"Oct 27 · 1:00 AM",text:"W2 low",price:"7,699.50"},
   {at:"Oct 27 · time not verified",text:"W3 UP working interpretation published",price:null}
  ]},
 SUBMICRO:{
  label:"Submicro",reference:"W5 UP watch",
  entries:[
   {at:"Oct 27 · 1:45 AM",text:"W1 low",price:"7,703.75"},
   {at:"Oct 27 · 5:15 AM",text:"W1 high",price:"7,749.25"},
   {at:"Oct 27 · 7:15 AM",text:"W2 low",price:"7,712.75"},
   {at:"Oct 27 · 9:00 AM",text:"W3 high",price:"7,772.25"},
   {at:"Oct 27 · 11:30 AM",text:"W4 low",price:"7,750.50"},
   {at:"Not confirmed",text:"W5 UP — projected watch",price:null}
  ]}
};
const card={border:"1px solid #334155",borderRadius:10,padding:12,background:"#0b1220",color:"#e2e8f0"};
const muted={color:"#94a3b8",fontSize:12};
export default function Engine27WaveLearningPreview({snapshot}){
 const [degree,setDegree]=useState("MICRO");
 const [tab,setTab]=useState("timeline");
 const active=TIMELINES[degree];
 const published=snapshot?.engine27Strategies?.engine27WorkingSevenDegrees?.degrees?.[degree.toLowerCase()];
 const levels=Array.isArray(published?.potentialCompletion?.levels)?published.potentialCompletion.levels:[];
 const lastTouch=levels.filter(x=>x?.status==="TOUCHED"&&x?.touchedAt&&Number.isFinite(Date.parse(x.touchedAt)))
   .sort((a,b)=>Date.parse(b.touchedAt)-Date.parse(a.touchedAt))[0]??null;
 return <details style={{marginTop:12,border:"1px solid #334155",borderRadius:8,padding:8}}>
  <summary style={{cursor:"pointer",fontWeight:900,color:"#cbd5e1",fontSize:12}}>ENGINE 27 — WAVE LEARNING & PERFORMANCE — expand history</summary>
  <section style={{...card,marginTop:8}} aria-label="Engine 27 Wave Learning preview">
  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
   <div><strong style={{fontSize:18}}>ENGINE 27 — WAVE LEARNING</strong><div style={muted}>Historical research timeline · no duplicate Engine 22 Fibonacci tables</div></div>
   <span style={{...muted,border:"1px solid #475569",borderRadius:16,padding:"4px 9px"}}>RESEARCH PREVIEW — NOT LIVE JOURNAL</span>
  </div>
  <div style={{display:"flex",gap:8,marginTop:14}}>
   {Object.keys(TIMELINES).map(d=><button key={d} type="button" onClick={()=>setDegree(d)}
    style={{background:degree===d?"#1d4ed8":"#1e293b",border:"1px solid #475569",color:"#fff",padding:"8px 14px",borderRadius:7,cursor:"pointer"}}>{TIMELINES[d].label}</button>)}
  </div>
  <div style={{marginTop:12,padding:12,background:"#111d2e",borderRadius:8}}>
   <strong>{active.label} — Current: {published?.activeWave||"UNAVAILABLE"} {published?.waveDirection||""}</strong>
   <div style={muted}>Current model is sourced from Engine 22. Timeline below preserves earlier owner-nominated UP-wave history, not contemporaneous Replay proof.</div>
  </div>
  <div style={{marginTop:8,fontSize:12,color:"#94a3b8"}}>Latest time-verified published Fib touch: {lastTouch?`${lastTouch.label??lastTouch.key} at ${lastTouch.price}`:"UNAVAILABLE"} · Candle rejection / 0.500–0.618 research: AWAITING VERIFIED BAR DATA</div>
  <div style={{display:"flex",gap:8,marginTop:12}}>
   {[["timeline","Timeline"],["behavior","Market behavior"],["trades","Trades"]].map(([id,label])=>
     <button key={id} type="button" onClick={()=>setTab(id)}
      style={{cursor:"pointer",background:tab===id?"#334155":"transparent",color:"#e2e8f0",border:"1px solid #475569",padding:"7px 11px",borderRadius:6}}>{label}</button>)}
  </div>
  {tab==="timeline" ? <div style={{display:"grid",gap:9,marginTop:12}}>
    {active.entries.map((e,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"minmax(135px,1fr) 2fr auto",gap:8,alignItems:"center",padding:"10px",borderLeft:"2px solid #64748b",background:"#101827"}}>
      <span style={muted}>{e.at} AZ</span><span>{e.text}</span><strong>{e.price||"—"}</strong>
    </div>)}
   </div> : <div style={{padding:"18px 4px",...muted}}>
    {tab==="trades"?"No Engine 10 as-of-wave trade joins validated. Results are unavailable.":"Engine 26 zone reactions and Engine 3/4 participation history await verified source-event linkage."}
   </div>}
  <p style={{...muted,marginTop:12}}>
   Original-time Engine 12 observations, verified physical ES contracts, and journal events are not yet loaded. Owner reference pivots are not confirmed wave-completion events.
  </p>
 </section></details>;
}
