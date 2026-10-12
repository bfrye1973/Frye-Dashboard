// Engine 8D — explicit, PAPER-only seven-account instruction plan.
// Pure planning: NO fetch, fills, strategy engine, or broker access.
export const SEVEN_PAPER_BUY_PLAN=Object.freeze([
  Object.freeze({accountId:"PAPER-01-SUBMICRO",name:"SUBMICRO",qty:3}),
  Object.freeze({accountId:"PAPER-02-MICRO",name:"MICRO",qty:3}),
  Object.freeze({accountId:"PAPER-03-SUBMINUTE",name:"SUBMINUTE",qty:1}),
  Object.freeze({accountId:"PAPER-04-MINUTE",name:"MINUTE",qty:1}),
  Object.freeze({accountId:"PAPER-05-MINOR",name:"MINOR",qty:1}),
  Object.freeze({accountId:"PAPER-06-INTERMEDIATE",name:"INTERMEDIATE",qty:1}),
  Object.freeze({accountId:"PAPER-07-PRIMARY",name:"PRIMARY",qty:1}),
]);
export const MANUAL_PAPER_BATCH_STORAGE_KEY="frye.engine8.manualPaperBatch.pending.v1";
export function buildSevenPaperBuyPlan({overview,contract,price,newRequestId}={}){
  if(overview?.ok!==true||overview?.initialized!==true||
      !Array.isArray(overview.accounts)||overview.accounts.length!==7)
    throw Error("All seven authenticated PAPER accounts must be available.");
  const symbol=String(contract||"").trim().toUpperCase();
  if(!/^MES[HMUZ]\d{2}$/.test(symbol))throw Error("Enter an explicit MES futures expiration, such as MESZ26.");
  const p=Number(price);
  if(!Number.isFinite(p)||p<=0||Math.abs(p*4-Math.round(p*4))>1e-8)
    throw Error("Simulated entry must be a valid 0.25-point MES price.");
  if(typeof newRequestId!=="function")throw Error("Secure request identity generator unavailable.");
  const margin=Number(overview.riskPolicy?.simulatedInitialMargin?.MES);
  const fee=Number(overview.riskPolicy?.feePerContractPerSide?.MES);
  const maxQty=Number(overview.riskPolicy?.maxContractsPerAccount);
  if(!Number.isFinite(margin)||margin<=0||!Number.isFinite(fee)||fee<0||
    !Number.isSafeInteger(maxQty)||maxQty<3)
    throw Error("Valid simulated MES risk policy is required.");
  const ids=new Set();
  const entries=SEVEN_PAPER_BUY_PLAN.map(row=>{
    const a=overview.accounts.find(x=>x.accountId===row.accountId);
    if(!a||ids.has(a.accountId)||a.accountMode!=="PAPER"||
      a.tradingBlocked || Number(a.pendingJournalInstructions)>0 ||
      Number(a.openContracts)!==0 || Object.keys(a.positions||{}).length!==0 ||
      !Number.isFinite(Number(a.availableFunds)) ||
      Number(a.availableFunds)<margin*row.qty+fee*row.qty ||
      row.qty>maxQty)
      throw Error(row.name+" is not FLAT, ready, or sufficiently funded. No batch will be sent.");
    ids.add(a.accountId);
    const requestId=String(newRequestId());
    if(requestId.length<8)throw Error("Unique request identity is required.");
    return {accountId:row.accountId,name:row.name,contract:symbol,price:p,
      action:"BUY",intent:"OPEN_LONG",qty:row.qty,idempotencyKey:requestId,
      status:"READY",executionId:null,tradeId:null};
  });
  if(ids.size!==7||new Set(entries.map(x=>x.idempotencyKey)).size!==7)
    throw Error("Seven distinct accounts and request identities are required.");
  return {version:1,planId:String(newRequestId()),createdAt:new Date().toISOString(),
    contract:symbol,price:p,totalContracts:11,entries};
}
export function isSevenPaperBuyPlan(value){
  return value?.version===1 && Array.isArray(value.entries) && value.entries.length===7 &&
    value.totalContracts===11 && value.entries.every((e,i)=>
      e.accountId===SEVEN_PAPER_BUY_PLAN[i].accountId &&
      e.qty===SEVEN_PAPER_BUY_PLAN[i].qty &&
      e.contract===value.contract && e.price===value.price &&
      typeof e.idempotencyKey==="string" && e.idempotencyKey.length>=8 &&
      ["READY","SUBMITTING","CONFIRMED","UNCERTAIN"].includes(e.status));
}
export function makePaperBatchTicket(entry){
  return {accountId:entry.accountId,contract:entry.contract,qty:entry.qty,price:entry.price,
    action:"BUY",intent:"OPEN_LONG",idempotencyKey:entry.idempotencyKey,
    paper:true,ownerConfirmation:"CONFIRM_PAPER"};
}
