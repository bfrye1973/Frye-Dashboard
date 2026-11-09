// Engine 11B acceptance: real production-formatted historical pages, loaded in
// the EXISTING RowChart. Tests use a read-only GitHub Actions artifact, never
// private production credentials. Every delivered page is SHA-256 verified.
const { chromium }=require("playwright");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const assert=require("node:assert/strict");
const ROOT=process.env.ENGINE11B_VERIFIED_PAGES;
assert.ok(ROOT && fs.existsSync(ROOT),"ENGINE11B_VERIFIED_PAGES_NOT_AVAILABLE");
const DIR=fs.existsSync(path.join(ROOT,"continuousRaw2020plus-catalog.json"))
  ?ROOT:path.join(ROOT,"continuousRaw2020plus");
const summary=JSON.parse(fs.readFileSync(path.join(DIR,"private-pages-verification.json"),"utf8"));
const catalogBytes=fs.readFileSync(path.join(DIR,"continuousRaw2020plus-catalog.json"));
const cat=JSON.parse(catalogBytes);
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const EXPECTED={
  dataset:"research-dataset:2e555ba83cbf25466d3e8d157371cc423401f30a25ed35b33a95fca5f81aaae2",
  basis:"price-basis:04ec3639248269336f8df3626c6c9a3eb119ac18cbc39429addbbb2f24d22b15",
  counts:{"1h":39364,"4h":9319,"1d":1645},
  pages:{"1h":40,"4h":10,"1d":2},
};
assert.equal(summary.schema,"engine11.private-history-pages.verification.v1");
assert.equal(summary.sourceArtifactId,13158459519);
assert.equal(summary.datasetVersion,EXPECTED.dataset);
assert.equal(summary.priceBasisVersion,EXPECTED.basis);
assert.equal(summary.catalogSha256,sha(catalogBytes));
assert.equal(cat.datasetVersion,EXPECTED.dataset);
assert.equal(cat.priceBasisVersion,EXPECTED.basis);
for(const frame of ["1h","4h","1d"]){
  const pages=cat.frames?.[frame]?.pages;
  assert.equal(pages.length,EXPECTED.pages[frame]);
  assert.equal(cat.frames[frame].rows,EXPECTED.counts[frame]);
  for(let i=0;i<pages.length;i++){
    assert.equal(pages[i].requestCursor, i===0?null:pages[i-1].nextCursor);
  }
  assert.equal(pages.at(-1).nextCursor,null);
}
const ORIGIN="http://127.0.0.1:8193";
const headers={"Access-Control-Allow-Origin":ORIGIN,
  "Access-Control-Allow-Headers":"Accept, X-Engine2C-Access",
  "Access-Control-Allow-Methods":"GET, OPTIONS",
  "Cache-Control":"no-store","Content-Type":"application/json"};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const frame of ["1h","4h","1d"]){
   const context=await browser.newContext({viewport:{width:1440,height:900}});
   await context.addInitScript(()=>{
     sessionStorage.setItem("engine2cResearchOwnerKey","isolated-signed-archive-only");
     window.__ENGINE11B_TEST__={events:[]};
   });
   const errors=[];
   let historyRequests=0, ohclRequests=0;
   let releaseOlderPage;
   const olderPageGate=new Promise(resolve=>{releaseOlderPage=resolve;});
   const sourceRows=new Map();
   const readPage=cursor=>{
     const entry=cat.frames[frame].pages.find(x=>x.requestCursor===cursor);
     assert.ok(entry,"ENGINE11B_CURSOR_NOT_FOUND");
     const bytes=fs.readFileSync(path.join(DIR,entry.name));
     assert.equal(sha(bytes),entry.sha256,"ENGINE11B_PAGE_SHA_MISMATCH");
     const page=JSON.parse(bytes);
     assert.equal(page.datasetVersion,EXPECTED.dataset);
     assert.equal(page.priceBasisVersion,EXPECTED.basis);
     assert.equal(page.frame,frame);
     assert.equal(page.requestCursor,cursor);
     assert.equal(page.nextCursor,entry.nextCursor);
     assert.equal(page.direction,"DESC");
     assert.equal(page.rows.length,entry.rows);
     for(const row of page.rows){
       assert.equal(row.frame,frame);
       assert.equal(row.priceBasisVersion,EXPECTED.basis);
       assert.equal(row.executionPriceAuthority,false);
       assert.equal(row.structuralEligible,false);
       assert.ok(["open","high","low","close"].every(k=>Number.isFinite(row.prices[k])));
       sourceRows.set(Date.parse(row.timestampUtc)/1000,row);
     }
     return {bytes,page};
   };
   const latest=readPage(null).page;
   const terminal=latest.rows[0].sourceContract;
   const ticker=/^ES([HMUZ])(\d{4})$/.exec(terminal);
   assert.ok(ticker,"ENGINE11B_INVALID_TERMINAL_CONTRACT");
   const resolved="ES"+ticker[1]+ticker[2].slice(-1);
   await context.route("https://frye-market-backend-1.onrender.com/**",
     route=>route.fulfill({status:200,headers,body:"{}"}));
   await context.route("https://frye-market-backend-1.onrender.com/engine2c-private-history/page**",async route=>{
     const req=route.request(),url=new URL(req.url());
     if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
     assert.equal(req.headers()["x-engine2c-access"],"isolated-signed-archive-only");
     assert.equal(url.searchParams.get("datasetVersion"),EXPECTED.dataset);
     assert.equal(url.searchParams.get("priceBasisVersion"),EXPECTED.basis);
     assert.equal(url.searchParams.get("frame"),frame);
     assert.equal(url.searchParams.get("limit"),"1000");
     assert.equal(url.searchParams.get("direction"),"DESC");
     const cursor=url.searchParams.get("cursor");
     const {bytes}=readPage(cursor);
     historyRequests++;
     if(cursor!==null) await olderPageGate;
     return route.fulfill({status:200,headers,body:bytes});
   });
   await context.route("https://frye-market-backend-1.onrender.com/api/v1/futures/ohlc**",async route=>{
     ohclRequests++;
     const response=await route.fetch({timeout:35000});
     assert.equal(response.status(),200,"PRODUCTION_RECENT_OHLC_STATUS");
     const payload=await response.json();
     assert.equal(payload.resolvedSymbol,resolved,"PRODUCTION_FUTURES_CONTRACT_MISMATCH");
     assert.ok(Array.isArray(payload.bars)&&payload.bars.length>0);
     return route.fulfill({status:200,headers,body:JSON.stringify(payload)});
   });
   await context.route("https://frye-market-backend-2.onrender.com/stream/futures/agg**",route=>{
     const snap={type:"snapshot",symbol:"ES",resolvedSymbol:resolved,tf:"1m"};
     return route.fulfill({status:200,headers:{...headers,"Content-Type":"text/event-stream"},
       body:"data: "+JSON.stringify(snap)+"\\n\\n"});
   });
   const page=await context.newPage();
   page.on("pageerror",e=>errors.push(e.message));
   const started=Date.now();
   await page.goto(ORIGIN+"/chart?symbol=ES&tf="+frame+"&engine2cChart=live",
     {waitUntil:"domcontentloaded"});
   await page.waitForFunction(f=>window.__ENGINE11B_TEST__?.events?.some(
     e=>e.kind==="paged-setData"&&e.frame===f),frame,{timeout:35000});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const paintMs=Date.now()-started;
   assert.equal(historyRequests,1,"NO_MORE_THAN_ONE_PAGE_ON_INITIAL_PAINT");
   // Wait for the genuine production 1h/4h futures bridge on top of the
   // certified immutable archive. This tests the original owner defect.
   await page.waitForFunction(f=>window.__ENGINE11B_TEST__?.events?.some(
     e=>e.kind==="recent-catchup"&&e.frame===f&&e.added>0),frame,{timeout:35000});
   const bridge=await page.evaluate(f=>window.__ENGINE11B_TEST__.events.find(
     e=>e.kind==="recent-catchup"&&e.frame===f),frame);
   const viewportLatest=await page.evaluate(()=>window.__ENGINE11B_TEST__.visibleRange());
   assert.ok(viewportLatest.from<=bridge.latestTime && viewportLatest.to>=bridge.latestTime,
     "RECENTEST_CANDLE_NOT_VISIBLE");
   assert.equal(ohclRequests,1,"CURRENT_CANDLES_REQUIRE_ONE_BOUNDED_OHLC_REQUEST");
   assert.equal(historyRequests,1,"CURRENT_CATCHUP_MUST_NOT_FETCH_MORE_ARCHIVE_PAGES");
   // Compare exact original unadjusted OHLCV from verified archive to the
   // current UI working series (no synthetic changes, adjust, or roll).
   const before=await page.evaluate(()=>window.__ENGINE11B_TEST__.events.filter(
     e=>e.kind==="paged-setData"));
   assert.ok(before.length>=1);
   assert.equal(before[0].bars,latest.rows.length);
   const expected=latest.rows[0];
   const actual=before[0].latestOHLCV;
   assert.ok(actual,"ROWCHART_LATEST_CANDLE_NOT_CAPTURED");
   assert.deepEqual({
     time:actual.time,open:actual.open,high:actual.high,
     low:actual.low,close:actual.close,volume:actual.volume,
   },{
     time:Math.floor(Date.parse(expected.timestampUtc)/1000),
     open:expected.prices.open,high:expected.prices.high,
     low:expected.prices.low,close:expected.prices.close,
     volume:expected.volume,
   },"DISPLAYED_OHLCV_MUST_MATCH_ORIGINAL_ENGINE11_CANDLE");
   // The test-only hook moves the actual chart viewport to its left edge,
   // causing Lightweight Charts logical-range history callback to load older.
   await page.evaluate(()=>{
     const t=window.__ENGINE11B_TEST__;
     if(typeof t.scrollOlder!=="function")throw Error("SCROLL_HOOK_MISSING");
     t.scrollOlder();
   });
   for(let i=0;i<60&&historyRequests<2;i++){
     await new Promise(resolve=>setTimeout(resolve,20));
   }
   assert.equal(historyRequests,2,"OLDER_PAGE_REQUEST_REQUIRED_AFTER_SCROLL");
   // Give LWC time to publish the newly requested viewport *before* the
   // older page is returned. Otherwise we could compare to the old initial
   // view and misdiagnose an intentional scroll as a viewport regression.
   await page.waitForTimeout(150);
   const viewportBefore=await page.evaluate(()=>window.__ENGINE11B_TEST__.visibleRange());
   assert.ok(viewportBefore?.from!=null&&viewportBefore?.to!=null);
   releaseOlderPage();
   await page.waitForFunction(()=>window.__ENGINE11B_TEST__?.events?.filter(
     e=>e.kind==="paged-setData").length>=2,null,{timeout:35000});
   assert.equal(historyRequests,2,"EXACTLY_ONE_OLDER_PAGE_ON_SCROLL");
   const older=readPage(latest.nextCursor).page;
   assert.ok(Date.parse(older.rows[0].timestampUtc)<Date.parse(latest.rows.at(-1).timestampUtc));
   const preserved=await page.evaluate(()=>{
     const t=window.__ENGINE11B_TEST__;
     return {viewport:t.visibleRange(),pager:t.pagerSnapshot()};
   });
   assert.equal(preserved.pager.loadedBars,latest.rows.length+older.rows.length+bridge.added);
   assert.equal(preserved.pager.earliestTime,Math.floor(Date.parse(older.rows.at(-1).timestampUtc)/1000));
   assert.deepEqual(preserved.viewport,viewportBefore,"PAN_VIEWPORT_MUST_REMAIN_STABLE_AFTER_PREPEND");
   assert.equal(errors.length,0,errors.join(" | "));
   console.log("ENGINE11B_AUTHENTIC_ROWCHART_PASS",JSON.stringify({
     frame,archiveRows:cat.frames[frame].rows,archivePages:EXPECTED.pages[frame],
     firstPaintMs:paintMs,initialRequests:1,afterScrollRequests:2,
     initialRows:latest.rows.length,olderRows:older.rows.length,
     terminalContract:terminal,
     firstLatestUtc:latest.rows[0].timestampUtc,
     lastOlderUtc:older.rows.at(-1).timestampUtc,
     firstLatestClose:latest.rows[0].prices.close,
     cursorChain:"verified",sha256Pages:"verified",exactPlottedOHLCV:"verified",
     viewportPreserved:true, currentCandlesAppended:bridge.added,
     currentLastUtc:new Date(bridge.latestTime*1000).toISOString(),
     currentContract:bridge.receivedContract,
     source:"authentic published verified Engine11 private pages + genuine Backend-1 futures OHLC",
   }));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
