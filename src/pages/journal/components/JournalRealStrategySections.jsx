// Read-only Engine 10 nine-section REAL Journal scorecards.
// Uses the canonical backend summary; never alters Journal trades or fees.
import React,{useEffect,useState} from "react";
import {API_BASE} from "../journalConstants.js";

const GROUPS=[
 ["SWING","SWING — Historical"],["INTRADAY","INTRADAY — Historical"],
 ["SUBMICRO","SUBMICRO"],["MICRO","MICRO"],["SUBMINUTE","SUBMINUTE"],
 ["MINUTE","MINUTE"],["MINOR","MINOR"],["INTERMEDIATE","INTERMEDIATE"],["PRIMARY","PRIMARY"]
];
const money=n=>Number.isFinite(Number(n))?Number(n).toLocaleString("en-US",{style:"currency",currency:"USD"}):"—";
export default function JournalRealStrategySections(){
 const [data,setData]=useState(null),[error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const res=await fetch(`${API_BASE}/api/v1/trade-journal/real-performance`,{cache:"no-store"});
    if(!res.ok)throw Error("Real strategy reporting not available");
    const json=await res.json();
    if(!json.ok||json.schema!=="engine10.realPerformanceSections.v1")throw Error("Invalid Engine 10 reporting response");
    if(active){setData(json);setError("");}
   }catch(e){if(active){setError(String(e.message||e));setData(null);}}
  };
  load();const timer=setInterval(load,30000);
  return()=>{active=false;clearInterval(timer);};
 },[]);
 const panel={background:"#0b1419",border:"1px solid #293841",borderRadius:12,padding:14};
 return <section aria-label="Seven REAL strategy accounts" style={{marginTop:18,marginBottom:18}}>
  <h3 style={{fontSize:17,fontWeight:900,margin:"0 0 8px"}}>REAL ACCOUNT PERFORMANCE</h3>
  <p style={{fontSize:12,opacity:.75,margin:"0 0 14px"}}>Two preserved historical scorecards · Seven Elliott Wave strategy scorecards · Broker-derived realized P&amp;L</p>
  {error?<div role="status" style={panel}>Nine-account reporting is not active yet. Historical Journal remains available. ({error})</div>:null}
  {data?<><div style={{...panel,marginBottom:12}}>
    <strong>ALL REAL</strong>
    <div style={{fontSize:22,fontWeight:900,marginTop:6}}>{money(data.allReal?.netRealized)}</div>
    <div style={{fontSize:12,opacity:.8}}>Gross {money(data.allReal?.grossRealized)} · Fees {money(data.allReal?.fees)} · Open contracts {data.allReal?.openContracts??"—"} · Closed contracts {data.allReal?.closedContracts??"—"}</div>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
    {GROUPS.map(([id,label])=>{const g=data.sections?.[id]||{};return <div key={id} style={panel}>
      <strong style={{fontSize:12}}>{label}</strong>
      <div style={{fontSize:19,fontWeight:900,marginTop:6}}>{money(g.netRealized)}</div>
      <div style={{fontSize:12,opacity:.8}}>Open {g.openContracts??0} · Closed {g.closedContracts??0}</div>
      <div style={{fontSize:12,opacity:.8}}>Fees {money(g.fees)} · Win {g.winRate==null?"—":(g.winRate*100).toFixed(1)+"%"}</div>
      <div style={{fontSize:12,opacity:.8}}>Profit factor {g.profitFactor??"—"} · Drawdown {money(g.maxDrawdown)}</div>
     </div>})}
   </div>
   {data.unknownRealCampaigns?.length>0?<p role="alert" style={{color:"#fbbf24"}}>{data.unknownRealCampaigns.length} REAL campaigns require account classification. ALL REAL may be incomplete.</p>:null}
  </>:null}
 </section>;
}
