// Engine 11B: exercise the REAL RowChart inside the built dashboard.
// Only HTTP responses are fixture-backed. No production deployment and no owner key.
const {chromium} = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const ORIGIN = "http://127.0.0.1:8193";
const BASE_SECONDS = Math.floor(Date.parse("2026-10-30T00:00:00Z") / 1000);
const DATASET = "research-dataset:2e555ba83cbf25466d3e8d157371cc423401f30a25ed35b33a95fca5f81aaae2";
const BASIS = "price-basis:04ec3639248269336f8df3626c6c9a3eb119ac18cbc39429addbbb2f24d22b15";
const cors = {"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"Accept, X-Engine2C-Access","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};

function generateBars(frame, first, count) {
  const seconds = frame === "10m" ? 600 : frame === "5m" ? 300 : 60;
  return Array.from({length:count},(_,i)=>{
    const j=first+i, close=7500 + j * 0.125;
    return {time:BASE_SECONDS+j*seconds,open:close-0.5,high:close+1,
      low:close-1,close,volume:10+j%50};
  });
}
function pageFixture(frame,cursor) {
  const newest = cursor === null;
  const start = newest ? 1000 : 0;
  const bars=generateBars(frame,start,1000);
  return {
    datasetVersion:DATASET,priceBasisVersion:BASIS,frame,
    direction:"DESC",researchOnly:true,structuralEligible:false,
    executionPriceAuthority:false,requestCursor:cursor,
    nextCursor:newest?"older":null,
    rows:bars.slice().reverse().map((b,i)=>({
      researchCandleId:`fixture-${frame}-${b.time}`,frame,
      sourceContract:"ESZ2026",timestampUtc:new Date(b.time*1000).toISOString(),
      timestampNs:String(b.time)+"000000000",prices:{
        open:b.open,high:b.high,low:b.low,close:b.close,
      },volume:b.volume,priceBasisVersion:BASIS,
      structuralEligible:false,executionPriceAuthority:false,
    })),
  };
}
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  const browser=await chromium.launch({headless:true});
  const results=[];
  try {
    for(const frame of ["5m","10m","1m"]) {
      const context=await browser.newContext({viewport:{width:1440,height:900}});
      await context.addInitScript(()=>{
        if(window.location.hostname==="127.0.0.1"){
          window.sessionStorage.setItem("engine2cResearchOwnerKey","fixture-only");
          window.__ENGINE11B_TEST__={events:[]};
        }
      });
      let privateRequests=0,ohlcRequests=0;
      let releaseStream;
      const streamReady=new Promise(resolve=>{releaseStream=resolve;});
      let last=frame==="1m"
        ?generateBars("1m",1400,600).at(-1).time
        :generateBars(frame,1000,1000).at(-1).time;
      await context.route("https://frye-market-backend-1.onrender.com/**",async route=>{
        await route.fulfill({status:200,headers:cors,body:"{}"});
      });
      await context.route("https://frye-market-backend-1.onrender.com/api/v1/futures/ohlc**",async route=>{
        const req=route.request(),url=new URL(req.url());
        if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:cors,body:""});
        ohlcRequests++;
        const debug=url.searchParams.get("debug")==="1";
        if (frame === "1m" && !debug) {
          // Preserve the real backend OHLC response, including resolved market
          // candles and payload size. Only CORS is rewritten for localhost.
          const response = await route.fetch({timeout:55000});
          if (!response.ok()) throw Error("PRODUCTION_1M_HTTP_" + response.status());
          const bytes = await response.body();
          const productionBars = JSON.parse(bytes.toString("utf8"));
          if (!Array.isArray(productionBars) || !productionBars.length) {
            throw Error("PRODUCTION_1M_EMPTY");
          }
          last = Number(productionBars.at(-1).time);
          return route.fulfill({status:200,headers:cors,body:bytes});
        }
        const bars=generateBars("1m",1400,600);
        return route.fulfill({status:200,headers:cors,body:JSON.stringify(debug?{
          ok:true,resolvedSymbol:"ESZ6",requestedSymbol:"ES",
          timeframe:url.searchParams.get("timeframe")||frame,
          count:bars.length,lastBar:bars.at(-1),bars,
        }:bars)});
      });
      await context.route("https://frye-market-backend-1.onrender.com/engine2c-private-history/page**",async route=>{
        const req=route.request(),url=new URL(req.url());
        if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:cors,body:""});
        assert.equal(req.headers()["x-engine2c-access"],"fixture-only");
        assert.equal(url.searchParams.get("datasetVersion"),DATASET);
        assert.equal(url.searchParams.get("priceBasisVersion"),BASIS);
        assert.equal(url.searchParams.get("frame"),frame);
        const cursor=url.searchParams.get("cursor");
        privateRequests++;
        await route.fulfill({status:200,headers:cors,body:JSON.stringify(pageFixture(frame,cursor))});
      });
      await context.route("https://frye-market-backend-2.onrender.com/stream/futures/agg**",async route=>{
        await streamReady;
        const bucketSeconds=frame==="10m"?600:frame==="5m"?300:60;
        const bucketStart=Math.floor((last+bucketSeconds)/bucketSeconds)*bucketSeconds;
        const candleEvents=Array.from({length:10},(_,i)=>({
          ok:true,type:"bar",symbol:"ES",resolvedSymbol:"ESZ6",tf:"1m",
          bar:{time:bucketStart+i*60,open:7750+i,high:7752+i,
            low:7749+i,close:7751+i,volume:33+i}
        }));
        // Duplicate the minute 3 with a corrected close and the same cumulative
        // volume. The 10m bucket must count it only once.
        candleEvents.splice(4,0,{...candleEvents[3],bar:{
          ...candleEvents[3].bar,close:7754,volume:36,
        }});
        const events=[{ok:true,type:"snapshot",symbol:"ES",
          resolvedSymbol:"ESZ6",tf:"1m"}, ...candleEvents];
        await route.fulfill({status:200,headers:{
          "Access-Control-Allow-Origin":ORIGIN,"Content-Type":"text/event-stream",
          "Cache-Control":"no-cache",
        },body:events.map(evt=>"data: "+JSON.stringify(evt)+"\\n\\n").join("").replace(/\\n/g,"\n")});
      });
      const page=await context.newPage();
      const errors=[];
      page.on("pageerror",err=>errors.push(err.message));
      const start=Date.now();
      await page.goto(ORIGIN+"/chart?symbol=ES&tf="+frame+"&engine2cChart=live",{waitUntil:"domcontentloaded"});
      await page.locator("[data-engine2c-live-panel]").waitFor({timeout:30000});
      const wanted=frame==="1m"?"standard-setData":"paged-setData";
      await page.waitForFunction(({wanted,frame})=>
        window.__ENGINE11B_TEST__?.events?.some(e=>e.kind===wanted&&e.frame===frame),
        {wanted,frame},{timeout:40000});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const measured=Date.now()-start;
      const events=await page.evaluate(()=>window.__ENGINE11B_TEST__.events);
      if(frame!=="1m"){
        assert.equal(privateRequests,1,"first paint must require only one authenticated page");
        assert.equal(events.find(e=>e.kind==="paged-setData").bars,1000);
      } else {
        assert.equal(privateRequests,0,"1m must not request Engine11 archive");
        assert.ok(ohlcRequests>=1,"1m must use futures OHLC");
      }
      await page.screenshot({path:"/tmp/engine11b-"+frame+"-candles.png"});
      releaseStream();
      const liveKind=frame==="1m"?"standard-live-update":"paged-live-update";
      await page.waitForFunction(kind=>window.__ENGINE11B_TEST__?.events?.some(e=>e.kind===kind),liveKind,{timeout:15000});
      // 10m / 5m must remain on recent-first after switching back; no full-history request.
      results.push({
        frame,
        firstPaintMs:measured,
        historySource:frame==="1m"?"actual production OHLC":"browser historical fixture",
        privateRequests,ohlcRequests,liveSimulated:true,
        events:events.length,errors:errors.slice(0,3),
      });
      await context.close();
    }

    // Regression for the manager's first two release blockers:
    // absent owner key NEVER reactivates full Engine11 loading,
    // while a mismatched feed remains connected but its bars are HELD.
    for (const frame of ["5m","10m"]) {
      const context=await browser.newContext({viewport:{width:1440,height:900}});
      await context.addInitScript(()=>{
        window.__ENGINE11B_TEST__={events:[]};
      });
      let privateRequests=0,ohlcRequests=0;
      await context.route("https://frye-market-backend-1.onrender.com/**",
        route=>route.fulfill({status:200,headers:cors,body:"{}"}));
      await context.route("https://frye-market-backend-1.onrender.com/engine2c-private-history/page**",
        route=>{privateRequests++;return route.fulfill({status:401,headers:cors,body:"{}"});});
      await context.route("https://frye-market-backend-1.onrender.com/api/v1/futures/ohlc**",route=>{
        ohlcRequests++;
        const u=new URL(route.request().url());
        assert.equal(u.searchParams.get("debug"),"1","fallback must return physical contract");
        assert.ok(Number(u.searchParams.get("limit"))<=1500);
        const bars=generateBars(frame,1000,600);
        return route.fulfill({status:200,headers:cors,
          body:JSON.stringify({ok:true,resolvedSymbol:"ESZ6",bars,count:bars.length})});
      });
      await context.route("https://frye-market-backend-2.onrender.com/stream/futures/agg**",route=>{
        const msg={ok:true,type:"snapshot",symbol:"ES",resolvedSymbol:"ESU6",tf:"1m"};
        const bar={ok:true,type:"bar",symbol:"ES",resolvedSymbol:"ESU6",tf:"1m",
          bar:{time:BASE_SECONDS+6000000,open:8000,high:8001,low:7999,close:8000,volume:12}};
        return route.fulfill({status:200,headers:{
          "Access-Control-Allow-Origin":ORIGIN,"Content-Type":"text/event-stream",
          "Cache-Control":"no-cache",
        },body:[msg,bar].map(x=>"data: "+JSON.stringify(x)+"\\n\\n").join("").replace(/\\n/g,"\n")});
      });
      const page=await context.newPage();
      await page.goto(ORIGIN+"/chart?symbol=ES&tf="+frame+"&engine2cChart=live",
        {waitUntil:"domcontentloaded"});
      const errors=[];
      page.on("pageerror",e=>errors.push("PAGE "+e.message));
      page.on("console",m=>{if(m.type()==="error")errors.push("CONSOLE "+m.text());});
      try {
        await page.waitForFunction(f=>window.__ENGINE11B_TEST__?.events?.some(
          e=>e.kind==="standard-setData"&&e.frame===f),frame,{timeout:10000});
      } catch (error) {
        const debug=await page.evaluate(()=>({
          body:document.body.innerText.slice(0,1200),
          events:window.__ENGINE11B_TEST__?.events||[],
        })).catch(e=>({error:String(e)}));
        console.error("ENGINE11B_FALLBACK_DIAG",JSON.stringify({
          frame,privateRequests,ohlcRequests,errors,debug,
        }));
        throw error;
      }
      await page.waitForFunction(()=>document.body.innerText.includes("CONTRACT HOLD"),null,{timeout:10000});
      const events=await page.evaluate(()=>window.__ENGINE11B_TEST__.events);
      assert.equal(privateRequests,0,"no owner key must not attempt private 472/236 pages");
      assert.equal(ohlcRequests,1,"bounded fallback must use only a single futures call");
      assert.equal(events.find(e=>e.kind==="standard-setData").bars,600);
      assert.equal(events.filter(e=>e.kind==="standard-live-update").length,0,
        "mismatched physical contract must never update candle series");
      results.push({frame,historySource:"bounded OHLC fallback",
        privateRequests,ohlcRequests,contractHold:true,liveUpdatesRejected:true});
      await context.close();
    }
    console.log("ENGINE11B_ACTUAL_ROWCHART_BROWSER_PASS "+JSON.stringify(results));
  } finally {await browser.close();}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
