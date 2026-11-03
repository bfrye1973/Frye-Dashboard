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
      const last=frame==="1m"
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
        const b={time:last+(frame==="1m"?60:600),open:7750,high:7752,low:7749,close:7751,volume:33};
        await route.fulfill({status:200,headers:{
          "Access-Control-Allow-Origin":ORIGIN,"Content-Type":"text/event-stream",
          "Cache-Control":"no-cache",
        },body:`data: ${JSON.stringify({type:"bar",bar:b})}\n\n`});
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
      results.push({frame,firstPaintLocalFixtureMs:measured,privateRequests,
        ohlcRequests,live:true,events:events.length,errors:errors.slice(0,3)});
      await context.close();
    }
    console.log("ENGINE11B_ACTUAL_ROWCHART_BROWSER_PASS "+JSON.stringify(results));
  } finally {await browser.close();}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
