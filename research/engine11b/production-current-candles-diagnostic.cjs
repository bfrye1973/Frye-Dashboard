// Read-only acceptance: verify futures 5m/10m OHLC actually spans the
// immutable Engine11 archive end to the current market session.
const frames={
  "5m":{end:"2026-10-30T20:55:00.000Z",resolutionSeconds:300},
  "10m":{end:"2026-10-30T20:50:00.000Z",resolutionSeconds:600},
};
(async()=>{
 for(const [frame,config] of Object.entries(frames)){
  const url=new URL("https://frye-market-backend-1.onrender.com/api/v1/futures/ohlc");
  url.searchParams.set("symbol","ES");
  url.searchParams.set("timeframe",frame);
  url.searchParams.set("limit","1500");
  url.searchParams.set("debug","1");
  const start=Date.now();
  const response=await fetch(url,{signal:AbortSignal.timeout(40000),cache:"no-store"});
  if(!response.ok)throw Error(frame+"_HTTP_"+response.status);
  const payload=await response.json();
  const contract=String(payload.resolvedSymbol||"").toUpperCase();
  if(contract!=="ESZ6")throw Error(frame+"_PHYSICAL_CONTRACT_MISMATCH_"+contract);
  const rows=payload.bars;
  if(!Array.isArray(rows)||!rows.length)throw Error(frame+"_EMPTY");
  const sec=v=>Number(v)>1e12?Math.floor(Number(v)/1000):Number(v);
  const first=sec(rows[0].time),last=sec(rows.at(-1).time);
  const archive=Date.parse(config.end)/1000;
  const added=rows.filter(b=>sec(b.time)>archive).length;
  if(added===0||last<=archive)throw Error(frame+"_CURRENT_SOURCE_MISSING");
  if(first>archive+config.resolutionSeconds*3) {
    throw Error(frame+"_CURRENT_SOURCE_HAS_UNFILLED_ARCHIVE_GAP");
  }
  console.log("ENGINE11B_PRODUCTION_CURRENT_CANDLES "+JSON.stringify({
    frame,contract,count:rows.length,afterArchive:added,
    first:new Date(first*1000).toISOString(),
    last:new Date(last*1000).toISOString(),
    archiveLast:config.end,elapsedMs:Date.now()-start,
  }));
 }
})().catch(e=>{console.error("ENGINE11B_CURRENT_CANDLES_NO_GO",e.message);process.exitCode=1});
