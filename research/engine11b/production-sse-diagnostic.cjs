// Engine11B: READ-ONLY production one-minute ES SSE wire diagnostic.
// Never submits trades, changes settings, or prints keys/credentials.
// Exits nonzero if no real bar is delivered. Status-only snapshot does NOT pass.
const assert=require("node:assert/strict");
const URL="https://frye-market-backend-2.onrender.com/stream/futures/agg?symbol=ES&tf=1m&mode=eth";
(async()=>{
 const timeoutMs=45000;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),timeoutMs);
 let snapshot=null,diagnostics=0,liveBars=0,validBars=0;
 const contracts=new Set();
 let earliest=null,latest=null,parseErrors=0,invalid=0;
 const seen=new Map();
 const start=Date.now();
 function inspect(msg){
   if(!msg||typeof msg!=="object")return;
   const type=String(msg.type||"");
   if(type==="snapshot"){
     snapshot={symbol:msg.symbol, resolvedSymbol:msg.resolvedSymbol, tf:msg.tf, mode:msg.mode};
     if(msg.resolvedSymbol)contracts.add(String(msg.resolvedSymbol));
     return;
   }
   if(type==="diag"){diagnostics++;return;}
   if(type!=="bar")return;
   liveBars++;
   const symbol=String(msg.symbol||"").toUpperCase();
   const physical=String(msg.resolvedSymbol||msg.bar?.sourceContract||"").toUpperCase();
   if(symbol!=="ES"||!/^ES[FGHJKMNQUVXZ]\d{1,2}$/.test(physical)){invalid++;return;}
   if(snapshot?.resolvedSymbol && physical!==String(snapshot.resolvedSymbol).toUpperCase()){
     invalid++;return;
   }
   const b=msg.bar||{};
   const toSec=v=>{
     const n=Number(v);
     return Number.isFinite(n)?(n>1e12?Math.floor(n/1000):n):NaN;
   };
   const time=toSec(b.time??b.t??b.ts??b.timestamp);
   const prices={open:Number(b.open??b.o),high:Number(b.high??b.h),
     low:Number(b.low??b.l),close:Number(b.close??b.c),
     volume:Number(b.volume??b.v??0)};
   if(!Number.isFinite(time)||time<=0||time%60!==0||
      !Object.values(prices).every(Number.isFinite)||
      prices.high<Math.max(prices.open,prices.close,prices.low)||
      prices.low>Math.min(prices.open,prices.close,prices.high)||
      prices.volume<0){invalid++;return;}
   contracts.add(physical);
   earliest=earliest===null?time:Math.min(earliest,time);
   latest=latest===null?time:Math.max(latest,time);
   // Matches src/lib/ohlcClient.js normalized bar (symbol retained on bar).
   seen.set(time,{time,...prices,sourceContract:physical});
   validBars++;
 }
 try{
   const response=await fetch(URL,{headers:{Accept:"text/event-stream"},signal:controller.signal,cache:"no-store"});
   if(!response.ok)throw Error("SSE_HTTP_"+response.status);
   assert.ok(String(response.headers.get("content-type")||"").includes("text/event-stream"),"SSE_NOT_EVENT_STREAM");
   const reader=response.body.getReader();
   let buffer="";
   let eof=false;
   while(Date.now()-start<timeoutMs && !eof){
     let read;
     try{read=await reader.read();}catch(e){if(controller.signal.aborted)break;throw e;}
     if(read.done){eof=true;break;}
     buffer+=new TextDecoder().decode(read.value,{stream:true});
     const chunks=buffer.split(/\r?\n\r?\n/);
     buffer=chunks.pop()||"";
     for(const block of chunks){
       const data=block.split(/\r?\n/).filter(x=>x.startsWith("data:"))
         .map(x=>x.slice(5).trim()).join("\n");
       if(!data)continue;
       try{inspect(JSON.parse(data));}catch(e){parseErrors++;}
     }
     if(validBars>=2)break;
   }
 }finally{clearTimeout(timeout);controller.abort();}
 const result={transport:"production Backend-2 SSE",durationSeconds:Number(((Date.now()-start)/1000).toFixed(2)),
   snapshot,diagnostics,liveBarEvents:liveBars,validNormalizedBars:validBars,
   distinctMinutes:seen.size,contracts:[...contracts],invalid,parseErrors,
   firstBarUtc:earliest?new Date(earliest*1000).toISOString():null,
   lastBarUtc:latest?new Date(latest*1000).toISOString():null,
   // OHLCV checked but intentionally not logged in detail to keep output concise.
   frontendParsing:"time, OHLCV and per-bar physical-contract identity validated"};
 console.log("ENGINE11B_PRODUCTION_SSE_DIAGNOSTIC "+JSON.stringify(result));
 if(!snapshot || snapshot.symbol!=="ES" || !snapshot.resolvedSymbol)throw Error("SSE_SNAPSHOT_IDENTITY_MISSING");
 if(validBars===0)throw Error("SSE_REAL_BAR_NOT_DELIVERED_NO_LIVE_ACCEPTANCE");
 if(invalid||parseErrors)throw Error("SSE_BAR_PARSING_OR_CONTRACT_MISMATCH");
})().catch(e=>{console.error("ENGINE11B_SSE_NO_GO",String(e.message||e));process.exitCode=1;});
