// Read-only seven-strategy Journal control center.
// Engine 10 owns the reporting groups; local contract views use the same Journal
// trades and live display marks as JournalFull. Never write broker/Journal state.
import React, {useEffect, useMemo, useState} from "react";
import {API_BASE} from "../journalConstants.js";
import {calculateLivePosition, getGrossRealized, getActualFees, getNetRealized, getRemainingLots, getDollarsPerPoint, normalizeMarketSymbol} from "../journalTradeModel.js";
import {upper} from "../journalFormatters.js";

const STRATEGIES=[
 ["SUBMICRO","0747"],["MICRO","6380"],["SUBMINUTE","7727"],
 ["MINUTE","3914"],["MINOR","5671"],["INTERMEDIATE","2888"],["PRIMARY","0144"]
];
const HISTORICAL=[["SWING","SWING — Historical"],["INTRADAY","INTRADAY — Historical"]];
const EMPTY=Object.freeze({});
const usd=n=>n===null||n===undefined||!Number.isFinite(Number(n))?"—":
  Number(n).toLocaleString("en-US",{style:"currency",currency:"USD"});
const signed=n=>n===null||n===undefined||!Number.isFinite(Number(n))?"—":
  `${Number(n)>0?"+":""}${usd(n)}`;
const points=n=>n===null||n===undefined||!Number.isFinite(Number(n))?"—":Number(n).toFixed(2);
const percent=n=>n===null||n===undefined||!Number.isFinite(Number(n))?"—":`${(100*Number(n)).toFixed(1)}%`;
const tone=n=>n>0?"#22c55e":n<0?"#fb4b4b":"#e5e7eb";
const surface={background:"#07121e",border:"1px solid #26364a",borderRadius:9};
const heading={fontSize:12,fontWeight:950,color:"#91a0b5",letterSpacing:".04em"};
const timestamp=v=>{
 if(!v)return "—";
 const d=new Date(v);
 return Number.isFinite(d.getTime())?d.toLocaleString("en-US",{
  timeZone:"America/Phoenix",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"
 }):"—";
};
function groupFor(t){
 if(upper(t?.accountMode)!=="REAL")return null;
 const saved=upper(t?.performanceGroup);
 if(STRATEGIES.some(([g])=>g===saved)||HISTORICAL.some(([g])=>g===saved))return saved;
 const account=upper(t?.journalAccount);
 if(account==="INTRADAY"||account==="SWING")return account;
 const label=upper(t?.brokerAccountLabel||t?.realBroker?.brokerAccountLabel);
 const matching=STRATEGIES.find(([,id])=>label===`SCHWAB_${id}`);
 // Do not override old historical records without Engine 10 classification authority.
 return matching && !["INTRADAY","SWING"].includes(account)?matching[0]:null;
}
function contractCode(t){
 const first=t?.realBroker?.contracts?.[0]?.futuresContractCode;
 const raw=upper(t?.futuresContractCode||t?.realBroker?.futuresContractCode||
   first||t?.brokerSymbol||t?.realBroker?.brokerSymbol).replace(/^\//,"").split(":")[0];
 return raw||normalizeMarketSymbol(t)||"";
}
function sumLive(trades,marks){
 let total=0,unavailable=0;
 for(const t of trades){
  if(upper(t?.status)!=="OPEN"||!(Number(t?.qty?.remainingQty)>0))continue;
  const code=contractCode(t),root=normalizeMarketSymbol(t);
  const live=calculateLivePosition(t,marks?.[code]??marks?.[root]);
  if(!live.available||!Number.isFinite(live.unrealizedPnL)){unavailable++;continue;}
  total+=live.unrealizedPnL;
 }
 return {value:unavailable?null:total,unavailable};
}
function Stat({label,value,color,sub}){
 return <div style={{...surface,padding:"12px 10px",minWidth:0}}>
  <div style={{...heading,fontSize:10}}>{label}</div>
  <div style={{fontSize:19,fontWeight:950,marginTop:7,color:color||"#f8fafc",overflowWrap:"anywhere"}}>{value}</div>
  {sub?<div style={{fontSize:10,color:"#91a0b5",marginTop:5}}>{sub}</div>:null}
 </div>;
}
function Tabular({headers,rows,empty}){
 return <div style={{overflowX:"auto",...surface}}>
  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:680}}>
   <thead><tr>{headers.map(h=><th key={h} style={{textAlign:"left",padding:"11px 10px",color:"#91a0b5",borderBottom:"1px solid #26364a"}}>{h}</th>)}</tr></thead>
   <tbody>{rows.length?rows.map((cells,i)=><tr key={i}>{cells.map((cell,j)=><td key={j} style={{padding:"11px 10px",borderBottom:"1px solid #172638",whiteSpace:"nowrap"}}>{cell}</td>)}</tr>):
   <tr><td colSpan={headers.length} style={{padding:16,color:"#91a0b5"}}>{empty}</td></tr>}</tbody>
  </table>
 </div>;
}
export default function JournalRealStrategySections({trades=[],marks={}}){
 const [data,setData]=useState(null),[error,setError]=useState("");
 const [active,setActive]=useState("ALL_REAL");
 const [historyFilter,setHistoryFilter]=useState("ALL");
 const [expandedTradeId,setExpandedTradeId]=useState(null);
 useEffect(()=>{
  let alive=true;
  const load=async()=>{
   try{
    const response=await fetch(`${API_BASE}/api/v1/trade-journal/real-performance`,{cache:"no-store"});
    if(!response.ok)throw Error("Engine 10 reporting unavailable");
    const json=await response.json();
    if(!json.ok||json.schema!=="engine10.realPerformanceSections.v1")throw Error("Unexpected reporting schema");
    if(alive){setData(json);setError("");}
   }catch(e){if(alive){setError(String(e?.message||e));setData(null);}}
  };
  load();const timer=setInterval(load,30000);
  return()=>{alive=false;clearInterval(timer);};
 },[]);
 const allReal=useMemo(()=>trades.filter(t=>upper(t?.accountMode)==="REAL"),[trades]);
 const byGroup=useMemo(()=>{
  const result={ALL_REAL:allReal};
  for(const [g] of [...STRATEGIES,...HISTORICAL])result[g]=allReal.filter(t=>groupFor(t)===g);
  return result;
 },[allReal]);
 const selected=active==="ALL_REAL"?data?.allReal:data?.sections?.[active];
 const selectedTrades=byGroup[active]||[];
 const selectedLive=sumLive(selectedTrades,marks);
 const selectedOpen=selectedTrades.filter(t=>upper(t?.status)==="OPEN"&&Number(t?.qty?.remainingQty)>0);
 const activePositions=selectedOpen.flatMap(t=>{
  const code=contractCode(t);
  const market=marks?.[code]??marks?.[normalizeMarketSymbol(t)];
  const mark=market===null||market===undefined||market===""?null:Number(market);
  const multiplier=getDollarsPerPoint(t);
  const lots=getRemainingLots(t);
  const positions=lots.length?lots.map(l=>({
   qty:Number(l.qty)||0,price:l.price,
   contract:l.futuresContractCode||code,direction:t.direction,tradeId:t.tradeId,
   contractId:l.contractId||null
  })):(t.realBroker?.contracts||[]).filter(c=>upper(c.status)==="OPEN").map(c=>({
   qty:1,price:c.entryPrice,contract:c.futuresContractCode||code,
   direction:t.direction,tradeId:t.tradeId,contractId:c.contractId||null
  }));
  return positions.filter(p=>p.qty>0).map(p=>{
   const entry=p.price===null||p.price===undefined?null:Number(p.price);
   const available=Number.isFinite(mark)&&Number.isFinite(entry)&&Number.isFinite(multiplier);
   const multiplierDirection=upper(p.direction)==="SHORT"?-1:1;
   return {...p,mark:available?mark:null,
    livePnL:available?(mark-entry)*p.qty*multiplier*multiplierDirection:null};
  });
 });
 const rows=selectedTrades
  .filter(t=>historyFilter==="ALL"||upper(t?.status)===historyFilter)
  .slice().sort((a,b)=>Date.parse(b.entry?.time||b.createdAt||0)-Date.parse(a.entry?.time||a.createdAt||0));
 const cards=STRATEGIES.map(([id,last4])=>{
  const g=data?.sections?.[id]||EMPTY, ts=byGroup[id]||[];
  const live=sumLive(ts,marks);
  const open=ts.filter(t=>upper(t?.status)==="OPEN"&&Number(t.qty?.remainingQty)>0);
  const directions=[...new Set(open.map(t=>upper(t.direction)).filter(Boolean))];
  const direction=open.length?(directions.length===1?directions[0]:"MIXED"):"FLAT";
  return {id,last4,g,live,direction};
 });
 const metricValues=[
  ["STARTING CAPITAL","—","No strategy capital allocation supplied"],
  ["CURRENT REALIZED EQUITY","—","Requires strategy starting capital"],
  ["ACTUAL RETURN","—","Requires strategy starting capital"],
  ["AVG DAILY GAIN","—","Requires strategy daily equity series"],
  ["WIN RATE",selected?.winRate==null?"—":percent(selected.winRate),"Closed contracts; historical fees not allocated per contract"],
  ["THIS MONTH RETURN","—","Requires strategy capital and daily series"],
  ["MAX DRAWDOWN",selected?.maxDrawdown==null?"—":usd(selected.maxDrawdown),"Available net-outcome sample only"],
  ["CURRENT DRAWDOWN","—","Requires complete strategy equity curve"],
  ["LIVE DRAWDOWN","—","Requires complete strategy equity and marks"],
  ["ANNUALIZED SIMPLE","—","Requires defined strategy performance start"],
  ["ANNUALIZED COMPOUNDED","—","Requires defined strategy performance start"],
  ["PERFORMANCE SAMPLE",String(selected?.closedContracts??0),"All closed contract IDs; net scoring is not fully verified"],
  ["PROFIT FACTOR",selected?.profitFactor==null?"—":String(selected.profitFactor),"Only when contract-level net outcomes are available"]
 ];
 return <><style>{`
  .engine10-detail-performance-grid > div { min-height: 104px; padding: 17px 13px !important; }
  .engine10-detail-performance-grid > div > div:nth-child(2) { font-size: 24px !important; margin-top: 10px !important; }
  @media (max-width: 1250px) { .engine10-detail-performance-grid { grid-template-columns: repeat(3,minmax(0,1fr)) !important; } }
  @media (max-width: 850px) { .engine10-detail-performance-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; } }
  @media (max-width: 460px) { .engine10-detail-performance-grid { grid-template-columns: minmax(0,1fr) !important; } }
 `}</style><section aria-label="Seven REAL strategy accounts" style={{margin:"12px 12px 18px",color:"#f8fafc"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:10}}>
   <div><div style={{fontSize:19,fontWeight:950,color:"#22c55e"}}>SEVEN STRATEGY ACCOUNTS</div>
    <div style={{fontSize:11,color:"#91a0b5"}}>Select a card for full positions, performance, and trade history. Original Journal remains read-only.</div></div>
   <button type="button" onClick={()=>{setActive("ALL_REAL");setHistoryFilter("ALL");}} aria-pressed={active==="ALL_REAL"}
    style={{padding:"9px 17px",cursor:"pointer",background:active==="ALL_REAL"?"#102d4b":"#07121e",color:"#e5efff",border:"1px solid #2559a8",borderRadius:8,fontWeight:900}}>ALL REAL</button>
  </div>
  {error?<div role="status" style={{...surface,padding:12,color:"#fbbf24",marginBottom:10}}>Live Engine 10 reporting unavailable: {error}. Account values are not estimated.</div>:null}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))",gap:10}}>
   {cards.map(c=><button key={c.id} type="button" aria-pressed={active===c.id}
    onClick={()=>{setActive(c.id);setHistoryFilter("ALL");}}
    style={{...surface,textAlign:"left",cursor:"pointer",padding:13,border:active===c.id?"2px solid #60a5fa":"1px solid #26364a",
     background:active===c.id?"#0c1b2d":"#07121e",minWidth:0}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:7,alignItems:"center"}}>
     <strong style={{fontSize:15,color:active===c.id?"#93c5fd":"#f8fafc"}}>{c.id}</strong>
     <span style={{fontSize:10,color:"#91a0b5"}}>••••{c.last4}　{active===c.id?"▾":"›"}</span>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",gap:8,margin:"12px 0 7px"}}>
     <span style={{fontSize:12}}><b>{c.g.openContracts??"—"}</b> OPEN</span>
     <span style={{fontSize:11,color:c.direction==="LONG"?"#22c55e":c.direction==="SHORT"?"#fb4b4b":"#91a0b5"}}>{c.direction}</span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,borderTop:"1px solid #26364a",paddingTop:9}}>
     <div><div style={{...heading,fontSize:9}}>NET RECORDED</div><strong style={{fontSize:15,color:tone(c.g.netRealized)}}>{data?signed(c.g.netRealized):"—"}</strong></div>
     <div><div style={{...heading,fontSize:9}}>LIVE OPEN P&L</div><strong style={{fontSize:15,color:tone(c.live.value)}}>{signed(c.live.value)}</strong></div>
    </div>
   </button>)}
  </div>
  <div style={{...surface,marginTop:13,padding:14,borderColor:"#2559a8"}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
    <div><h3 style={{margin:0,color:"#93c5fd",fontSize:19}}>{active==="ALL_REAL"?"ALL REAL — PERFORMANCE & HISTORY":`${active} — PERFORMANCE & HISTORY`}</h3>
     <div style={{fontSize:11,color:"#91a0b5",marginTop:4}}>{active==="ALL_REAL"?"All nine reporting groups · existing historical accounts included":`Account ••••${STRATEGIES.find(v=>v[0]===active)?.[1]||""}`}</div></div>
    <span style={{fontSize:11,color:"#91a0b5"}}>ENGINE 10 · READ ONLY</span>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:8,marginTop:13}}>
    <Stat label="OPEN CONTRACTS" value={selected?.openContracts??"—"}/>
    <Stat label="CLOSED CONTRACTS" value={selected?.closedContracts??"—"}/>
    <Stat label="GROSS REALIZED" value={data?usd(selected?.grossRealized):"—"} color={tone(selected?.grossRealized)}/>
    <Stat label="ACTUAL FEES" value={data?usd(selected?.fees):"—"}/>
    <Stat label="NET RECORDED" value={data?signed(selected?.netRealized):"—"} color={tone(selected?.netRealized)}/>
    <Stat label="LIVE UNREALIZED" value={signed(selectedLive.value)} color={tone(selectedLive.value)} sub={selectedLive.unavailable?"Current price unavailable for some positions":""}/>
   </div>
   <h4 style={{...heading,margin:"22px 0 9px",color:"#22c55e"}}>CURRENT OPEN POSITIONS</h4>
   <Tabular headers={["Contract","Side","Open qty","Entry price","Market price","Live P&L","Contract ID"]}
    rows={activePositions.map(p=>[
     p.contract,upper(p.direction),String(p.qty),points(p.price),points(p.mark),
     <strong style={{color:tone(p.livePnL)}}>{signed(p.livePnL)}</strong>,
     <span title={p.contractId||p.tradeId}>{(p.contractId||p.tradeId||"").slice(-24)}</span>
    ])}
    empty="No open contracts recorded for this selection."/>
   <div style={{fontSize:11,color:"#91a0b5",marginTop:7}}>
    Live prices and unrealized P&L are display-only. No broker orders or Journal values are changed.
   </div>
   <h4 style={{...heading,margin:"22px 0 9px",color:"#22c55e"}}>DETAILED PERFORMANCE</h4>
   <div className="engine10-detail-performance-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10}}>
    {metricValues.map(([label,value,sub])=><Stat key={label} label={label} value={data?value:"—"} sub={sub}/> )}
   </div>
   <p style={{fontSize:11,color:"#91a0b5",margin:"9px 0 0"}}>Strategy capital-based metrics remain unavailable until approved per-strategy capital and equity baselines exist. Closed-contract net fee attribution is not yet fully verified; missing statistics are shown as — instead of invented.</p>
   <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,alignItems:"center",margin:"22px 0 9px"}}>
    <h4 style={{...heading,margin:0,color:"#22c55e"}}>COMPLETE STRATEGY TRADE HISTORY ({selectedTrades.length} CAMPAIGNS)</h4>
    <div style={{display:"flex",gap:5}}>{["ALL","OPEN","CLOSED"].map(f=><button type="button" key={f} onClick={()=>setHistoryFilter(f)} aria-pressed={historyFilter===f}
     style={{padding:"6px 10px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:900,color:"#f8fafc",background:historyFilter===f?"#17432b":"#0a1422",border:"1px solid #26364a"}}>{f}</button>)}</div>
   </div>
   <div style={{...surface,overflowX:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:830}}>
     <thead><tr>{["Opened (AZ)","Futures","Direction","Status","Open qty","Gross P&L","Fees","Net recorded","Contract detail"].map(h=>
      <th key={h} style={{textAlign:"left",padding:"12px 10px",color:"#91a0b5",borderBottom:"1px solid #26364a"}}>{h}</th>)}</tr></thead>
     <tbody>{rows.length?rows.map(t=>{
      const expanded=expandedTradeId===t.tradeId;
      const gross=getGrossRealized(t),fees=getActualFees(t),net=getNetRealized(t);
      const contracts=Array.isArray(t.realBroker?.contracts)?t.realBroker.contracts:[];
      return <React.Fragment key={t.tradeId}>
       <tr style={{background:expanded?"#0c1b2d":"transparent"}}>
        <td style={{padding:"11px 10px",borderBottom:"1px solid #172638"}}>{timestamp(t.entry?.time)}</td>
        <td style={{padding:"11px 10px"}}>{contractCode(t)}</td>
        <td style={{padding:"11px 10px"}}>{upper(t.direction)||"—"}</td>
        <td style={{padding:"11px 10px"}}>{upper(t.status)||"—"}</td>
        <td style={{padding:"11px 10px"}}>{Number(t.qty?.remainingQty)||0}</td>
        <td style={{padding:"11px 10px"}}>{usd(gross)}</td>
        <td style={{padding:"11px 10px"}}>{usd(fees)}</td>
        <td style={{padding:"11px 10px",color:tone(net),fontWeight:900}}>{signed(net)}</td>
        <td style={{padding:"8px 10px"}}><button type="button" aria-expanded={expanded}
         aria-label={`${expanded?"Hide":"Show"} contracts for trade ${t.tradeId}`}
         onClick={()=>setExpandedTradeId(expanded?null:t.tradeId)}
         style={{border:"1px solid #2559a8",color:"#93c5fd",background:expanded?"#133252":"#0a1422",
          cursor:"pointer",borderRadius:6,padding:"7px 12px",fontSize:11,fontWeight:900}}>
          {expanded?"▾ Hide":"▸ View"} {contracts.length} contracts
        </button></td>
       </tr>
       {expanded?<tr><td colSpan={9} style={{padding:"12px 16px 17px",background:"#0a1727"}}>
        <div style={{fontWeight:900,fontSize:12,color:"#93c5fd",marginBottom:9}}>
         CONTRACT HISTORY — {t.tradeId}
        </div>
        <div style={{overflowX:"auto"}}>
         <table style={{width:"100%",borderCollapse:"collapse",minWidth:920,fontSize:11}}>
          <thead><tr>{["Contract ID","State","Entry (AZ)","Entry price","Exit (AZ)","Exit price","Gross P&L","Contract fees","Net P&L","Closing broker transaction"].map(h=>
           <th key={h} style={{textAlign:"left",padding:"9px 7px",color:"#91a0b5",borderBottom:"1px solid #26364a"}}>{h}</th>)}</tr></thead>
          <tbody>{contracts.length?contracts.map((c,i)=>{
           const grossContract=c.grossRealizedPnL??c.realizedPnL;
           const knownFee=c.totalFees??c.attributedFees??c.allocatedFees??null;
           const netContract=c.netRealizedPnL??c.netPnL??null;
           return <tr key={c.contractId||i}>
            <td title={c.contractId} style={{padding:"8px 7px",overflowWrap:"anywhere",maxWidth:300}}>{c.contractId||"—"}</td>
            <td style={{padding:"8px 7px",color:upper(c.status)==="OPEN"?"#22c55e":"#93c5fd"}}>{upper(c.status)}</td>
            <td style={{padding:"8px 7px"}}>{timestamp(c.openingFillTime||c.entryTime||t.entry?.time)}</td>
            <td style={{padding:"8px 7px"}}>{points(c.entryPrice)}</td>
            <td style={{padding:"8px 7px"}}>{timestamp(c.closingFillTime||c.exitTime)}</td>
            <td style={{padding:"8px 7px"}}>{points(c.exitPrice)}</td>
            <td style={{padding:"8px 7px",color:tone(grossContract)}}>{usd(grossContract)}</td>
            <td style={{padding:"8px 7px"}}>{usd(knownFee)}</td>
            <td style={{padding:"8px 7px",color:tone(netContract)}}>{usd(netContract)}</td>
            <td style={{padding:"8px 7px"}}>{c.closingBrokerTransactionId||"—"}</td>
           </tr>;
          }):<tr><td colSpan={10} style={{padding:12,color:"#91a0b5"}}>No contract records available for this campaign.</td></tr>}</tbody>
         </table>
        </div>
        <div style={{fontSize:11,color:"#91a0b5",marginTop:9}}>
         Campaign fees: {usd(fees)}. Missing contract-level fees or net outcomes remain —; campaign fees are not assigned to contracts without evidence.
        </div>
       </td></tr>:null}
      </React.Fragment>;
     }):<tr><td colSpan={9} style={{padding:16,color:"#91a0b5"}}>No matching trades in this history selection.</td></tr>}</tbody>
    </table>
   </div>
  </div>
  <details style={{...surface,marginTop:12,padding:12}}>
   <summary style={{cursor:"pointer",fontWeight:900,color:"#fbbf24"}}>Historical performance — SWING / INTRADAY (preserved)</summary>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:9,marginTop:12}}>
    {HISTORICAL.map(([key,name])=>{const g=data?.sections?.[key];return <div key={key} style={{...surface,padding:12}}>
     <div style={{fontWeight:900,color:"#fbbf24"}}>{name}</div>
     <div style={{fontSize:20,fontWeight:950,color:tone(g?.netRealized),margin:"8px 0"}}>{data?signed(g?.netRealized):"—"}</div>
     <div style={{fontSize:11,color:"#91a0b5"}}>Open {g?.openContracts??"—"} · Closed {g?.closedContracts??"—"} · Fees {usd(g?.fees)}</div>
    </div>})}
   </div>
  </details>
  {data?.unknownRealCampaigns?.length>0?<div role="alert" style={{padding:10,color:"#fbbf24"}}>{data.unknownRealCampaigns.length} REAL campaigns remain unclassified; verify ALL REAL before using it for performance comparisons.</div>:null}
 </section></>;
}
