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
  const down=wave?.direction?.toUpperCase().includes("DOWN");
  return <div className="mp-wave">
    <div className="mp-wave-head"><span>ENGINE 22 · ELLIOTT COUNT</span><span>READ ONLY</span></div>
    {wave?<React.Fragment>
      <div className="mp-wave-line">
        <strong className="mp-wave-number">{wave.wave}</strong>
        <strong style={{color:down?"#fca5a5":"#86efac",fontSize:11}}>
          {wave.direction||"DIRECTION UNAVAILABLE"}
        </strong>
      </div>
      <div className="mp-wave-status" title={wave.status||""}>{wave.status||"Status not published"}</div>
      {wave.next&&<div className="mp-wave-next">NEXT: {wave.next}</div>}
      {wave.levels.length>0&&<div className="mp-wave-levels">
        {wave.levels.map((level,i)=><span key={i}>{level.label} {level.price}</span>)}
      </div>}
    </React.Fragment>:<span className="mp-wave-unavailable">
      {error?"Engine 22 unavailable":loading?"Loading wave…":"Count not published"}
    </span>}
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
  return <main className="mp-dashboard">
    <style>{`
      .mp-dashboard{box-sizing:border-box;color:#e5edf6;width:100%;max-width:none;margin:0;padding:10px 14px 24px;background:#060b12}
      .mp-dashboard *{box-sizing:border-box}
      .mp-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:0 0 10px}
      .mp-heading h1{font-size:22px;letter-spacing:.02em;margin:0;font-weight:950}
      .mp-heading small{font-size:10px;letter-spacing:.06em;color:#9fb0c2;font-weight:800}
      .mp-paper-label{color:#fbbf24;font-size:12px;font-weight:900}
      .mp-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#203146;border:1px solid #203146;border-radius:8px;overflow:hidden;margin:7px 0 12px}
      .mp-summary-item{min-width:0;padding:10px 12px;background:#07121b}
      .mp-kpi-label{color:#8fa6bd;font-size:10px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
      .mp-kpi-value{font-size:20px;font-weight:1000;color:#f8fafc;margin-top:3px;line-height:1.1;font-variant-numeric:tabular-nums}
      .mp-card-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;align-items:start}
      .mp-account-card{min-width:0;border:1px solid #2e495e;border-top:3px solid #22c55e;border-radius:9px;background:linear-gradient(160deg,#07121b,#0d1725);padding:10px 11px;min-height:228px;overflow:hidden}
      .mp-account-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .mp-account-head strong{color:#f8fafc;font-size:13px;letter-spacing:.03em;white-space:nowrap}
      .mp-account-id{font-size:9px;color:#87a6c1;white-space:nowrap}
      .mp-wave{background:#071b29;border:1px solid #23465a;border-radius:6px;margin:8px 0;padding:7px 8px;min-height:74px}
      .mp-wave-head{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:#7dd3fc;font-weight:900}
      .mp-wave-head span:last-child{color:#7890a7;font-size:8px}
      .mp-wave-line{display:flex;align-items:baseline;gap:9px;margin-top:3px}
      .mp-wave-number{font-size:21px;line-height:1;color:#f8fafc}
      .mp-wave-status{color:#b7c8d8;font-size:10px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}
      .mp-wave-next{font-size:10px;color:#fbbf24;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mp-wave-levels{font-size:9px;color:#9eb8ca;margin-top:4px;display:flex;gap:7px;overflow:hidden;white-space:nowrap}
      .mp-wave-unavailable{font-size:11px;color:#fbbf24;display:block;margin-top:10px}
      .mp-main-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid #253d52;padding:6px 0}
      .mp-value{font-size:17px;font-weight:1000;font-variant-numeric:tabular-nums;white-space:nowrap}
      .mp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:8px 0 2px}
      .mp-stat-value{color:#f3f5f8;font-size:13px;font-weight:850}
      .mp-details{margin-top:6px;border-top:1px solid #253d52;padding-top:6px;font-size:11px}
      .mp-details summary{cursor:pointer;color:#7db6eb;font-weight:850}
      .mp-position-row{margin:6px 0;color:#cbd5e1;line-height:1.3}
      .mp-operator{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 10px;background:#0e1826;border:1px solid #293b52;border-radius:7px;margin-bottom:8px}
      .mp-operator input{min-width:170px;max-width:260px;flex:1;background:#0a1321;color:#f8fafc;padding:6px 9px;border:1px solid #405166;border-radius:5px}
      .mp-operator button,.mp-dashboard button{cursor:pointer}
      .mp-ticket{margin-top:10px;border:1px solid #2d4155;background:#0b1421;border-radius:8px;padding:10px}
      .mp-ticket>summary{cursor:pointer;font-size:13px;font-weight:950;color:#93c5fd}
      .mp-risk{margin-top:7px;font-size:10px;color:#91a6bc}
      .mp-banner{color:#fbbf24;font-size:11px;font-weight:850}
      @media(max-width:1380px){.mp-card-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:930px){.mp-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mp-summary{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:580px){.mp-card-grid{grid-template-columns:1fr}.mp-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.mp-dashboard{padding:8px}}
    `}</style>
    <header className="mp-heading">
      <div><h1>▣ MANUAL PAPER TRADING</h1><small>SEVEN INDEPENDENT ACCOUNTS · ENGINE 22 WAVE STRUCTURE</small></div>
      <div className="mp-paper-label">PAPER ONLY — NO REAL BROKER ORDERS</div>
    </header>
    {!token&&<form className="mp-operator" onSubmit={redeem}>
      <strong style={{fontSize:12}}>SECURE PAPER ACCESS</strong>
      <input value={pairing} onChange={e=>setPairing(e.target.value)}
        placeholder="One-time pairing code" autoComplete="off" aria-label="One-time operator pairing code"/>
      <button disabled={busy||!pairing} type="submit">Unlock PAPER workspace</button>
      <small style={{color:"#9fb0c2"}}>Engine 8 administrator pairing required; never enter the admin secret.</small>
    </form>}
    {token&&!overview&&<div style={panel}>Account data unavailable or session expired. Values will not be estimated.</div>}
    {token&&overview&&overview.initialized===false&&<div style={panel}>
      <p>Accounts not initialized. Starting capital is $70,000 across seven PAPER accounts.</p>
      <button onClick={initialize} disabled={busy}>Initialize seven $10,000 accounts</button>
    </div>}
    {error&&<p role="alert" style={{color:"#f87171"}}>{error}</p>}
    {message&&<p role="status" style={{color:"#86efac"}}>{message}</p>}
    <section className="mp-summary" aria-label="Manual PAPER overview">
      <div className="mp-summary-item"><div className="mp-kpi-label">Starting capital</div><div className="mp-kpi-value">$70,000</div></div>
      <div className="mp-summary-item"><div className="mp-kpi-label">Current equity</div><div className="mp-kpi-value">{isActive?money(overview.totalEquity):"—"}</div></div>
      <div className="mp-summary-item"><div className="mp-kpi-label">Realized P&L</div><div className="mp-kpi-value" style={{color:"#4ade80"}}>{isActive?money(accounts.reduce((n,a)=>n+a.realizedPnL,0)):"—"}</div></div>
      <div className="mp-summary-item"><div className="mp-kpi-label">Open contracts</div><div className="mp-kpi-value">{isActive?accounts.reduce((n,a)=>n+a.openContracts,0):"—"}</div></div>
      <div className="mp-summary-item"><div className="mp-kpi-label">Account count</div><div className="mp-kpi-value">7</div></div>
    </section>
    <section className="mp-card-grid" aria-label="Seven strategy PAPER accounts">
      {ACCOUNT_SLOTS.map(([id,label])=>{
        const a=accounts.find(item=>item.accountId===id);
        const tone=a?.tradingBlocked?"#f87171":!isActive?"#405872":"#22c55e";
        const pnl=a?.realizedPnL;
        return <article key={id} className="mp-account-card" style={{borderTopColor:tone}}>
          <div className="mp-account-head"><strong>{label}</strong><span className="mp-account-id">{id.replace("PAPER-","P")}</span></div>
          <WaveContext snapshot={waveSnapshot} accountId={id} loading={waveLoading} error={waveError}/>
          <div className="mp-main-metrics">
            <div><div className="mp-kpi-label">Current equity</div><div className="mp-value">{a?money(a.equity):"—"}</div></div>
            <div><div className="mp-kpi-label">Realized P&L</div><div className="mp-value" style={{color:pnl==null?"#f8fafc":pnl>=0?"#4ade80":"#f87171"}}>{a?money(pnl):"—"}</div></div>
          </div>
          <div className="mp-stats">
            <div><div className="mp-kpi-label">Open</div><div className="mp-stat-value">{a?a.openContracts:"—"}</div></div>
            <div><div className="mp-kpi-label">Unrealized</div><div className="mp-stat-value">{a?money(a.unrealizedPnL):"—"}</div></div>
            <div><div className="mp-kpi-label">Win %</div><div className="mp-stat-value">{a?a.winPercentage+"%":"—"}</div></div>
          </div>
          <details className="mp-details">
            <summary>Positions · Performance · History</summary>
            <div className="mp-position-row">Starting: $10,000 · Buying power: {a?money(a.availableFunds):"—"}</div>
            <div className="mp-position-row">Margin: {a?money(a.marginUsed):"—"} · Fees: {a?money(a.feesPaid):"—"}</div>
            <div className="mp-position-row">Closed: {a?a.closedContracts:"—"} · Profit factor: {a?(a.profitFactor??"—"):"—"}</div>
            <div className="mp-position-row">Drawdown: {a?money(a.currentDrawdown):"—"} · Max: {a?money(a.maxDrawdown):"—"}</div>
            {a&&Object.values(a.positions||{}).map(p=><div key={p.symbol} className="mp-position-row">
              {p.symbol} · {p.side} · {p.qty} contracts · Average {p.averageEntryPrice}</div>)}
            {(a?.executions||[]).slice().reverse().map(ex=><div key={ex.executionId} className="mp-position-row">
              {ex.opening?"ENTRY":"EXIT"} · {ex.symbol} · {ex.qty} @ {ex.price} · {ex.executionId}</div>)}
            {a&&Object.keys(a.positions||{}).length===0&&<div className="mp-position-row">No open positions.</div>}
          </details>
          {a?.tradingBlocked&&<div style={{fontSize:10,color:"#f87171",fontWeight:900,marginTop:5}}>JOURNAL RECONCILIATION REQUIRED</div>}
        </article>;
      })}
    </section>
    {overview?.riskPolicy&&<div className="mp-risk">
      SIMULATED POLICY · ES margin {money(overview.riskPolicy.simulatedInitialMargin.ES)} ·
      MES margin {money(overview.riskPolicy.simulatedInitialMargin.MES)} ·
      ES fee {money(overview.riskPolicy.feePerContractPerSide.ES)}/side ·
      MES fee {money(overview.riskPolicy.feePerContractPerSide.MES)}/side ·
      Max {overview.riskPolicy.maxContractsPerAccount} contracts/account
    </div>}
    <details className="mp-ticket"><summary>MANUAL TRADE TICKET — expand to BUY, SELL, REDUCE or CLOSE</summary>
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
    </details>
  </main>;
}
