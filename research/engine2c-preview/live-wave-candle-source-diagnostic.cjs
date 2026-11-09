// Read-only LIVE 30m / 10m / 5m source-candle alignment diagnostic.
// No owner wave values changed and no private credentials accessed.
const assert=require("node:assert/strict");
const BASE="https://frye-market-backend-1.onrender.com";
const models=[
 ["SUBMICRO W1 LOW","2026-11-09T08:00:00Z",7390.25],
 ["SUBMICRO W1 HIGH","2026-11-09T13:00:00Z",7476],
 ["SUBMICRO W2 LOW","2026-11-09T13:20:00Z",7449.25],
 ["MICRO W1 LOW","2026-11-05T22:20:00Z",7324],
 ["MICRO W1 HIGH","2026-11-06T14:40:00Z",7469],
 ["MICRO W2 LOW","2026-11-08T23:00:00Z",7362]
];
async function get(path){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),50000);
 try{
  const r=await fetch(BASE+path,{signal:controller.signal,headers:{Accept:"application/json"}});
  const j=await r.json().catch(()=>null);
  return {status:r.status,data:j};
 }finally{clearTimeout(timer);}
}
(async()=>{
 const live=await get("/api/v1/dashboard-snapshot?symbol=ES&includeContext=1");
 assert.equal(live.status,200);
 const p=live.data?.strategies?.["intraday_scalp@10m"]?.engine22WaveStrategy?.workingWaveNodes;
 assert.equal(p?.schema,"engine22.workingWaveNodes.v1");
 for(const deg of ["micro","submicro"]){
  console.log("ENGINE22_"+deg.toUpperCase()+"_PUBLISHED",JSON.stringify(
   (p.degrees[deg]?.nodes||[]).map(n=>({label:n.label,at:n.marketAtUtc,price:n.price,source:n.modelVersion}))));
 }
 for(const tf of ["30m","10m","5m"]){
  const secs={ "30m":1800,"10m":600,"5m":300}[tf];
  const result=await get("/api/v1/futures/ohlc?symbol=ES&timeframe="+tf+"&limit=2500");
  console.log("OHLC",tf,"HTTP",result.status,"schema",Array.isArray(result.data)?"ARRAY":Object.keys(result.data||{}).join(","),"contract",result.data?.resolvedSymbol||null);
  if(result.status!==200){console.log("OHLC_BODY",JSON.stringify(result.data)?.slice(0,550));continue;}
  const bars=Array.isArray(result.data)?result.data:Array.isArray(result.data?.bars)?result.data.bars:[];
  console.log("CANDLES",tf,"count",bars.length,"first",bars[0]?.time,"last",bars.at(-1)?.time);
  for(const [name,iso,ownerPrice] of models){
   const sec=Date.parse(iso)/1000;
   const containing=bars.find(b=>Number(b.time)<=sec&&sec<Number(b.time)+secs);
   const near=bars.filter(b=>Math.abs(Number(b.time)-sec)<=5400)
    .sort((a,b)=>Math.abs(Number(a.time)-sec)-Math.abs(Number(b.time)-sec)).slice(0,3);
   const match=containing?{
    openUTC:new Date(containing.time*1000).toISOString(),open:containing.open,high:containing.high,
    low:containing.low,close:containing.close,
    insideHighLow:ownerPrice>=Number(containing.low)&&ownerPrice<=Number(containing.high),
    deltaFromHigh:Number((ownerPrice-Number(containing.high)).toFixed(2)),
    deltaFromLow:Number((ownerPrice-Number(containing.low)).toFixed(2)),
   }:null;
   console.log("ANCHOR_"+tf,JSON.stringify({name,utc:iso,ownerPrice,matched:!!containing,match,
    nearest:containing?[]:near.map(x=>({at:new Date(x.time*1000).toISOString(),low:x.low,high:x.high}))}));
  }
 }
 console.log("LIVE_READ_ONLY_WAVE_CANDLE_DIAGNOSTIC_COMPLETED");
})().catch(e=>{console.error("WAVE_CANDLE_DIAG_ERROR",e.message);process.exitCode=1;});
