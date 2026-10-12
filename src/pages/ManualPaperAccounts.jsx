import React,{useCallback,useEffect,useMemo,useState} from "react";
import {useDashboardSnapshot} from "../hooks/useDashboardSnapshot";

const ROOT=(
  process.env.REACT_APP_API_BASE ||
  (typeof window!=="undefined" ? window.__API_BASE__ : "") ||
  "https://frye-market-backend-1.onrender.com/api"
).replace(/\/$/,"").replace(/\/api$/,"");
const API=ROOT+"/api/trading/manual-paper";
const ACCOUNT_SLOTS=[
 ["PAPER-01-SUBMICRO","SUBMICRO"],
 ["PAPER-02-MICRO","MICRO / INTRADAY"],
 ["PAPER-03-SUBMINUTE","SUBMINUTE"],
 ["PAPER-04-MINUTE","MINUTE"],
 ["PAPER-05-MINOR","MINOR"],
 ["PAPER-06-INTERMEDIATE","INTERMEDIATE"],
 ["PAPER-07-PRIMARY","PRIMARY"],
];
// Engine 22 alone owns count truth. This component never derives its own count.
const DEGREE_KEYS={
  "PAPER-01-SUBMICRO":"submicro",
  "PAPER-02-MICRO":"micro",
  "PAPER-03-SUBMINUTE":"subminute",
  "PAPER-04-MINUTE":"minute",
  "PAPER-05-MINOR":"minor",
  "PAPER-06-INTERMEDIATE":"intermediate",
  "PAPER-07-PRIMARY":"primary",
};
const WAVE_PATTERN=/^W[1-5]$/i;
const publishedWave=x=>typeof x==="string"&&WAVE_PATTERN.test(x.trim())?x.trim().toUpperCase():null;
const present=x=>x!==undefined&&x!==null&&String(x).trim()!==""?String(x):null;
function readEngine22Wave(snapshot,accountId){
  const degree=DEGREE_KEYS[accountId];
  const source=snapshot?.strategies?.["intraday_scalp@10m"]?.engine22WaveStrategy;
  if(!source||!degree)return null;
  const v3=source.engine22V3Projection?.available===true &&
    source.engine22V3Projection?.shadowOnly===true
      ?source.engine22V3Projection:null;
  // The Strategies page currently labels the legacy operational MICRO as
  // SUBMICRO. Keep that exact presentation mapping, not the independent V3 MICRO.
  const operationalSubmicro=degree==="submicro";
  const stateKey=operationalSubmicro?"micro":degree;
  const legacy=source.degreeStates?.degrees?.[stateKey] ||
    source.degreeStates?.[stateKey] || null;
  const legacyDisplay=source.engine22Display?.degrees?.[stateKey]||null;
  const canonical=v3?.degreeStates?.[degree]||null;
  const v3Display=v3?.engine22Display?.degrees?.[degree]||null;
  // Independent MICRO may ONLY use its published V3 record.
  if(degree==="micro"&&!canonical&&!v3Display)return null;
  const state=degree==="micro"?canonical:(operationalSubmicro?legacy:(legacy||canonical));
  const display=degree==="micro"?v3Display:(operationalSubmicro?legacyDisplay:(legacyDisplay||v3Display));
  const wave=publishedWave(state?.activeWave) ||
    publishedWave(state?.parentWave) ||
    publishedWave(display?.badge);
  if(!wave)return null;
  const direction=present(display?.direction)||present(state?.direction);
  const status=present(state?.stage)||present(state?.lifecycle)||present(display?.headline);
  const next=present(state?.nextExpectedWave)||present(state?.internalStructure?.nextExpectedInternalWave);
  const levels=Array.isArray(display?.levels)?display.levels.filter(x=>
    x&&x.price!==undefined&&x.price!==null&&x.label).slice(0,3):[];
  return {wave,direction,status,next,levels,
    source:degree==="submicro"?"Engine 22 operational Submicro":
      degree==="micro"?"Engine 22 V3 independent Micro":"Engine 22"};
}
function WaveContext({snapshot,accountId,loading,error}){
  const wave=readEngine22Wave(snapshot,accountId);
  return <div style={{background:"#091925",border:"1px solid #26435b",
    borderRadius:9,padding:"11px 12px",margin:"12px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:8,
      flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
      <strong style={{color:"#7dd3fc",fontSize:12}}>ENGINE 22 — CURRENT WAVE</strong>
      <span style={{fontSize:10,color:"#94a3b8"}}>READ ONLY</span>
    </div>
    {wave?<React.Fragment>
      <div style={{display:"flex",gap:12,alignItems:"baseline",flexWrap:"wrap"}}>
        <strong style={{fontSize:24,color:"#e2f6ff"}}>{wave.wave}</strong>
        <strong style={{fontSize:12,color:wave.direction==="DOWN"?"#fca5a5":"#86efac"}}>
          {wave.direction||"DIRECTION NOT PUBLISHED"}</strong>
      </div>
      <div style={{fontSize:12,color:"#cbd5e1",marginTop:3}}>
        {wave.status||"Status not published"}</div>
      {wave.next&&<div style={{fontSize:12,marginTop:4}}>Next expected: {wave.next}</div>}
      {wave.levels.length>0&&<div style={{fontSize:11,color:"#a8c6da",marginTop:7}}>
        {wave.levels.map((level,i)=><span key={i} style={{marginRight:11}}>
          {level.label}: {level.price}</span>)}
      </div>}
      <div style={{fontSize:10,color:"#8195a7",marginTop:7}}>{wave.source}</div>
    </React.Fragment>:<div style={{fontSize:12,color:"#fbbf24"}}>
      {error?"Engine 22 data unavailable":loading?"Loading current wave…":"Wave count not published for this degree"}
    </div>}
  </div>;
}

const panel={background:"#101722",border:"1px solid #293649",borderRadius:12,padding:16};
const control={background:"#0c1421",color:"#edf2f7",border:"1px solid #405166",
  borderRadius:7,padding:"10px 12px",width:"100%",boxSizing:"border-box"};
const money=value=>Number.isFinite(Number(value))
  ?Number(value).toLocaleString("en-US",{style:"currency",currency:"USD"}):"—";
const requestId=()=>{
  if(typeof crypto!=="undefined"&&crypto.randomUUID)return "MANUAL-"+crypto.randomUUID();
  throw Error("Browser secure random identity unavailable");
};
export default function ManualPaperAccountsPage(){
  const {data:waveSnapshot,err:waveError,loading:waveLoading}=useDashboardSnapshot("ES",{pollMs:20000,includeContext:1});
  // Access tokens are never persisted in localStorage, cookies, or bundled secrets.
  const [token,setToken]=useState("");
  const [pairing,setPairing]=useState("");
  const [overview,setOverview]=useState(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [ticket,setTicket]=useState({accountId:"PAPER-01-SUBMICRO",contract:"",
    action:"BUY",intent:"OPEN_LONG",qty:"",price:""});
  const [confirmed,setConfirmed]=useState(false);
  const [prepared,setPrepared]=useState(null);
  const [pendingKey,setPendingKey]=useState("");
  const auth=useMemo(()=>token?{Authorization:"Bearer "+token}:{},[token]);
  const api=useCallback(async(path,options={})=>{
    const res=await fetch(API+path,{...options,headers:{
      "Content-Type":"application/json",...auth,...(options.headers||{})
    },cache:"no-store"});
    const data=await res.json().catch(()=>({ok:false,reason:"INVALID_SERVER_RESPONSE"}));
    if(!res.ok||data.ok===false)throw Error(data.reason||"Request rejected");
    return data;
  },[auth]);
  const refresh=useCallback(async()=>{
    if(!token)return;
    try{setOverview(await api("/overview"));}
    catch(e){setError(e.message);setOverview(null);}
  },[token,api]);
  useEffect(()=>{refresh();},[refresh]);
  async function redeem(e){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    try{
      const res=await fetch(API+"/access/redeem",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({pairingCode:pairing.trim()})});
      const result=await res.json();
      if(!res.ok||!result.ok)throw Error(result.reason||"Access denied");
      setToken(result.accessToken);setPairing("");
      setMessage("Authenticated PAPER-only session. No REAL broker permission.");
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  async function initialize(){
    if(!window.confirm("Create exactly seven independent $10,000 PAPER accounts? This action never resets existing accounts."))return;
    setBusy(true);setError("");
    try{
      const result=await api("/initialize",{method:"POST",body:"{}"});
      setMessage(result.created?"Seven PAPER accounts initialized.":"Existing PAPER accounts preserved.");
      await refresh();
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  function prepare(e){
    e.preventDefault();setError("");setMessage("");setConfirmed(false);
    try{
      if(!ticket.accountId||!ticket.contract||!ticket.qty||!ticket.price)
        throw Error("Account, futures expiration, quantity and price are required.");
      if(!Number.isSafeInteger(Number(ticket.qty))||Number(ticket.qty)<=0)
        throw Error("Quantity must be a positive whole number.");
      if(!Number.isFinite(Number(ticket.price))||Number(ticket.price)<=0||
        Math.abs(Number(ticket.price)*4-Math.round(Number(ticket.price)*4))>1e-8)
        throw Error("Futures price must use quarter-point ticks.");
      const id=requestId();
      setPrepared({...ticket,qty:Number(ticket.qty),price:Number(ticket.price),
        contract:ticket.contract.trim().toUpperCase(),idempotencyKey:id});
    }catch(e){setError(e.message);}
  }
  async function execute(){
    if(!prepared||!confirmed)return;
    setBusy(true);setError("");setMessage("");
    try{
      const result=await api("/execute",{method:"POST",
        body:JSON.stringify({...prepared,paper:true,ownerConfirmation:"CONFIRM_PAPER"})});
      setMessage("PAPER execution recorded. Engine 10 Trade ID: "+result.tradeId);
      setPrepared(null);setConfirmed(false);await refresh();
    }catch(e){
      setError(e.message);
      setPendingKey(prepared.idempotencyKey);
      setMessage("Execution status uncertain. Do NOT submit a replacement instruction. Check Journal recovery.");
    }finally{setBusy(false);}
  }
  async function retryJournal(){
    if(!pendingKey||!window.confirm("Retry Engine 10 Journal delivery ONLY for the original PAPER fill? No new order will be placed."))return;
    setBusy(true);setError("");
    try{
      const result=await api("/retry-journal",{method:"POST",
        body:JSON.stringify({idempotencyKey:pendingKey})});
      setMessage("Original Journal delivery acknowledged: "+result.tradeId);
      setPendingKey("");await refresh();
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  const accounts=overview?.accounts||[];
  const isActive=Boolean(token&&overview?.ok&&overview?.initialized===true);
  return <main style={{color:"#e5edf6",padding:20,maxWidth:1440,margin:"auto"}}>
    <header style={{marginBottom:20}}>
      <h1 style={{margin:"0 0 8px"}}>Seven Manual PAPER Accounts</h1>
      <strong style={{color:"#fbbf24"}}>PAPER ONLY — NO REAL BROKER ORDERS</strong>
      <p style={{color:"#9fb0c2"}}>Seven independent simulated accounts. No automated strategy execution.</p>
    </header>
    {!token&&<form onSubmit={redeem} style={{...panel,maxWidth:560,marginBottom:20}}>
      <h3>Secure operator pairing</h3>
      <p>Use a one-time access code issued by an authorized Engine 8 administrator. Never enter the Engine 8 admin secret here.</p>
      <input style={control} value={pairing} onChange={e=>setPairing(e.target.value)}
        placeholder="One-time pairing code" autoComplete="off"/>
      <button disabled={busy||!pairing} style={{marginTop:12}} type="submit">Unlock PAPER workspace</button>
    </form>}
    {token&&!overview&&<div style={panel}>Account data unavailable. Your server session may have expired. No simulated balances are being guessed.</div>}
    {token&&overview&&overview.initialized===false&&<div style={panel}>
      <p>Accounts not initialized. Starting capital will be $70,000 across seven independent accounts.</p>
      <button onClick={initialize} disabled={busy}>Initialize seven $10,000 PAPER accounts</button>
    </div>}
    {error&&<p role="alert" style={{color:"#f87171"}}>{error}</p>}
    {message&&<p role="status" style={{color:"#86efac"}}>{message}</p>}
    <div style={{...panel,margin:"18px 0"}}>
      <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:12}}>
        <strong>TOTAL STARTING PAPER CAPITAL: $70,000</strong>
        <span>Current aggregate equity: {isActive?money(overview.totalEquity):"Awaiting secure account data"}</span>
      </div>
    </div>
    {overview?.riskPolicy&&<div style={{...panel,margin:"0 0 18px"}}>
      <strong>Simulated futures margin and fee model</strong>
      <p style={{margin:"7px 0 0"}}>ES: margin {money(overview.riskPolicy.simulatedInitialMargin.ES)} per contract,
        fee {money(overview.riskPolicy.feePerContractPerSide.ES)} per side.
        MES: margin {money(overview.riskPolicy.simulatedInitialMargin.MES)} per contract,
        fee {money(overview.riskPolicy.feePerContractPerSide.MES)} per side.
        Maximum {overview.riskPolicy.maxContractsPerAccount} contracts per account.</p>
      <small>Explicit manual simulated fill prices. No live automatic marks or broker execution.</small>
    </div>}
    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,540px),1fr))",gap:12}}>
      {ACCOUNT_SLOTS.map(([id,label])=>{
        const a=accounts.find(item=>item.accountId===id);
        return <article key={id} style={panel}>
          <div style={{color:"#8fb3e8",fontSize:12}}>{id}</div>
          <h3 style={{margin:"7px 0 14px"}}>{label}</h3>
          <WaveContext snapshot={waveSnapshot} accountId={id} loading={waveLoading} error={waveError}/>
          <div>Starting: <strong>$10,000.00</strong></div>
          <div>Equity: <strong>{a?money(a.equity):"—"}</strong></div>
          <div>Realized: {a?money(a.realizedPnL):"—"}</div>
          <div>Unrealized: {a?money(a.unrealizedPnL):"—"}</div>
          <div>Open contracts: {a?a.openContracts:"—"}</div>
          <div>Open positions: {a?Object.keys(a.positions||{}).length:"—"}</div>
          <div>Buying power: {a?money(a.availableFunds):"—"}</div>
          <div>Margin used: {a?money(a.marginUsed):"—"}</div>
          <div>Simulated fees: {a?money(a.feesPaid):"—"}</div>
          <div>Closed contracts: {a?a.closedContracts:"—"}</div>
          <div>Profit factor: {a?(a.profitFactor??"—"):"—"}</div>
          <div>Current drawdown: {a?money(a.currentDrawdown):"—"}</div>
          <div>Maximum drawdown: {a?money(a.maxDrawdown):"—"}</div>
          <div>Win %: {a?a.winPercentage+"%":"—"}</div>
          {a&&<details style={{marginTop:12,borderTop:"1px solid #344457",paddingTop:8}}>
            <summary style={{cursor:"pointer"}}>Positions and execution history</summary>
            {Object.values(a.positions||{}).map(p=><p key={p.symbol} style={{fontSize:12}}>
              {p.symbol} · {p.side} · {p.qty} contracts · Avg {p.averageEntryPrice}
            </p>)}
            {!Object.keys(a.positions||{}).length&&<p style={{fontSize:12}}>No open positions.</p>}
            {(a.executions||[]).slice().reverse().map(ex=><p key={ex.executionId} style={{fontSize:12}}>
              {ex.opening?"ENTRY":"EXIT"} · {ex.symbol} · {ex.qty} at {ex.price} · {ex.executionId}
            </p>)}
          </details>}
          {a?.tradingBlocked&&<strong style={{color:"#f87171"}}>JOURNAL RECONCILIATION REQUIRED</strong>}
        </article>;
      })}
    </section>
    <section style={{...panel,marginTop:20}}>
      <h2>Owner-authorized manual PAPER ticket</h2>
      <p style={{color:"#a1b2c6"}}>Explicit quantity and price only; no strategy signals can generate orders.</p>
      <form onSubmit={prepare} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
        <label>Account<select style={control} value={ticket.accountId} onChange={e=>setTicket({...ticket,accountId:e.target.value})}>
          {ACCOUNT_SLOTS.map(([id,name])=><option key={id} value={id}>{name}</option>)}
        </select></label>
        <label>Contract with expiration<input style={control} placeholder="MESZ26" value={ticket.contract}
          onChange={e=>setTicket({...ticket,contract:e.target.value})}/></label>
        <label>Action<select style={control} value={ticket.action} onChange={e=>setTicket({...ticket,action:e.target.value})}>
          {["BUY","SELL","REDUCE","CLOSE"].map(a=><option key={a}>{a}</option>)}
        </select></label>
        <label>Intent<select style={control} value={ticket.intent} onChange={e=>setTicket({...ticket,intent:e.target.value})}>
          {["OPEN_LONG","OPEN_SHORT","CLOSE_LONG","CLOSE_SHORT"].map(a=><option key={a}>{a}</option>)}
        </select></label>
        <label>Contracts<input type="number" min="1" step="1" style={control} value={ticket.qty}
          onChange={e=>setTicket({...ticket,qty:e.target.value})}/></label>
        <label>Manual simulated fill price<input type="number" min="0.25" step="0.25" style={control} value={ticket.price}
          onChange={e=>setTicket({...ticket,price:e.target.value})}/></label>
        <button disabled={!isActive||busy} type="submit" style={{...control,background:"#254464",cursor:"pointer"}}>Review PAPER order</button>
      </form>
      {prepared&&<div style={{marginTop:18,padding:15,border:"1px solid #f59e0b",borderRadius:8}}>
        <h3>Confirmation required</h3>
        <p>{prepared.action} {prepared.qty} {prepared.contract} ({prepared.intent}) in {prepared.accountId} at {prepared.price}</p>
        <p>Simulation only. No REAL broker order.</p>
        <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
          I explicitly authorize this exact PAPER instruction.</label>
        <button type="button" disabled={!confirmed||busy||!isActive} onClick={execute}
          style={{display:"block",marginTop:12}}>Confirm and execute PAPER only</button>
      </div>}
      {pendingKey&&<div style={{marginTop:16}}>
        <strong>Journal recovery for original instruction: {pendingKey}</strong>
        <button type="button" disabled={busy} onClick={retryJournal}
          style={{display:"block",marginTop:9}}>Retry original Journal event only</button>
      </div>}
    </section>
  </main>;
}
