// ONE-TIME READ-ONLY production acceptance. Run from isolated GitHub Actions.
// Never print account information, tokens, whole dashboard snapshots or positions.
const assert=require("node:assert/strict");
const backend="https://frye-market-backend-1.onrender.com";
const frontend="https://frye-dashboard.onrender.com";
async function get(url,timeout=55000){
 const controller=new AbortController();
 const timeoutId=setTimeout(()=>controller.abort(),timeout);
 try{
  const r=await fetch(url,{method:"GET",cache:"no-store",signal:controller.signal,
   headers:{Accept:"application/json"}});
  return r;
 }finally{clearTimeout(timeoutId);}
}
const same=(actual,expected,label)=>assert.equal(actual,expected,label);
(async()=>{
 const live=await get(backend+"/api/v1/dashboard-snapshot?symbol=ES&includeContext=1");
 same(live.status,200,"LIVE_ES_SNAPSHOT_HTTP");
 const snap=await live.json();
 const strategy=snap?.strategies?.["intraday_scalp@10m"]?.engine22WaveStrategy;
 assert.ok(strategy,"LIVE_ENGINE22_STRATEGIES_PACKET_MISSING");
 const wave=strategy.currentWavelength;
 const packet=strategy.workingWaveNodes;
 same(packet?.schema,"engine22.workingWaveNodes.v1","LIVE_WORKING_NODES_SCHEMA");
 same(packet.authority,"ENGINE22","LIVE_NODE_AUTHORITY");
 same(packet.readOnly,true,"LIVE_NODE_READ_ONLY");
 same(packet.ownerCountPromotion,false,"LIVE_NO_COUNT_PROMOTION");
 same(packet.noExecution,true,"LIVE_NO_TRADING_AUTHORITY");
 same(packet.symbol,"ES","LIVE_ES_ONLY");
 assert.equal(packet.degreeOrder?.length,7,"SEVEN_DEGREE_ENVELOPE");
 assert.ok(typeof packet.fingerprint==="string"&&packet.fingerprint.length>=32,
  "LIVE_NODE_FINGERPRINT_MISSING");
 const micro=packet.degrees?.micro?.nodes;
 const submicro=packet.degrees?.submicro?.nodes;
 assert.ok(Array.isArray(micro)&&micro.length>=3,"LIVE_MICRO_NODES_MISSING");
 assert.ok(Array.isArray(submicro)&&submicro.length>=3,"LIVE_SUBMICRO_NODES_MISSING");
 const old=wave.degrees.micro.ownerMicroW3Nov9ReclassifiedResearch;
 const internal=wave.degrees.submicro.ownerSubmicroW3Nov9InternalResearch;
 const find=(list,label)=>list.find(v=>v.label===label);
 const mW2=find(micro,"W2 research anchor");
 assert.ok(mW2,"MICRO_W2_NODE_MISSING");
 same(mW2.price,7362,"OWNER_MICRO_W2_PRICE");
 same(mW2.marketAtUtc,"2026-11-08T23:00:00.000Z","OWNER_MICRO_W2_16AZ");
 same(old.anchors.w2Low,mW2.price,"MICRO_SNAPSHOT_SHARED_PRICE");
 same(new Date(old.anchors.w2LowAtUtc).toISOString(),mW2.marketAtUtc,
   "MICRO_SNAPSHOT_SHARED_UTC");
 same(old.anchors.priorAnchorRevision?.w2LowAtUtc,
   "2026-11-08T22:00:00Z","OWNER_OLD_TIMESTAMP_PRESERVED");
 const expected=[
  ["W1 Low",7390.25,"2026-11-09T08:00:00.000Z"],
  ["W1 High",7476,"2026-11-09T13:00:00.000Z"],
  ["W2 research anchor",7449.25,"2026-11-09T13:20:00.000Z"]
 ];
 for(const [label,price,at] of expected){
   const n=find(submicro,label);
   assert.ok(n,"SUBMICRO_MISSING_"+label);
   same(n.price,price,"SUBMICRO_PRICE_"+label);
   same(n.marketAtUtc,at,"SUBMICRO_TIME_"+label);
 }
 same(internal.anchors.w2Low,7449.25,"SUBMICRO_SHARED_MODEL_PRICE");
 same(internal.anchors.w2LowAtUtc,"2026-11-09T13:20:00Z",
  "SUBMICRO_SHARED_MODEL_UTC");
 for(const n of [...micro,...submicro]){
   same(n.approvalStatus,"RESEARCH","NO_FAKE_WAVE_APPROVAL");
   same(n.plotAllowed,false,"NO_FAKE_CANONICAL_PLOT_PERMISSION");
   same(n.presentationAllowed,true,"OWNER_RESEARCH_PRESENTATION");
   same(n.waveCompletionConfirmed,false,"NO_FAKE_COMPLETION");
   same(n.noExecution,true,"NO_EXECUTION");
   assert.ok(typeof n.nodeId==="string"&&n.nodeId.length>=10);
   assert.ok(Number.isInteger(n.price*4),"ES_QUARTER_TICK_ONLY");
 }
 console.log("PASS LIVE_ES_STRATEGIES_WORKING_NODE_PACKET",JSON.stringify({
   source:"SAME_ENGINE22_PUBLISHED_CURRENT_WAVELENGTH",
   fingerprintPresent:true,degreeOrder:packet.degreeOrder,
   currentSourceDegrees:packet.degreeOrder.filter(x=>packet.degrees?.[x]?.available===true),
   dynamicMicroNodes:micro.length,dynamicSubmicroNodes:submicro.length,
   microW2:{price:mW2.price,utc:mW2.marketAtUtc,
    oldUtc:old.anchors.priorAnchorRevision?.w2LowAtUtc},
   submicro:expected,ownerApproval:false,
   revisionHistoryReady:snap?.strategies?.["intraday_scalp@10m"]?.engine22WaveHistory?.available===true,
 }));
 const chart=await get(frontend+"/chart?symbol=ES&tf=10m&engine2cChart=live");
 same(chart.status,200,"LIVE_FRONTEND_CHART_HTTP");
 const html=await chart.text();
 assert.ok(html.includes("root")||html.includes("react"),"FRONTEND_APP_HTML_MISSING");
 console.log("PASS LIVE_CHART_HTML_HTTP");
 const rawHistory=await get(backend+"/api/engine22/wave-history/nodes/current");
 assert.ok([401,403,503].includes(rawHistory.status),
  "PRIVATE_HISTORY_UNEXPECTED_UNAUTHENTICATED_STATUS_"+rawHistory.status);
 console.log("PASS HISTORY_REQUIRES_OWNER_ACCESS",JSON.stringify({
   unauthenticatedHttp:rawHistory.status,
   persistentJournalRecoveryProven:false
 }));
})().catch(e=>{console.error("FAIL READ_ONLY_LIVE_SYNC_CHECK",e?.message||e);
  process.exitCode=1;});
