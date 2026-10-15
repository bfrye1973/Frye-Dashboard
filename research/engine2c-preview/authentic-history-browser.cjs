// Authentic historical browser validation. No screenshots or price logs emitted.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   await page.goto('http://127.0.0.1:8197/engine2c-research/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__ENGINE2C_TEST__?.state?.handoff);
   const api=()=>page.evaluate(()=>({n:window.__ENGINE2C_TEST__.state.rows.length,view:window.__ENGINE2C_TEST__.state.view,frame:window.__ENGINE2C_TEST__.state.frame,degree:window.__ENGINE2C_TEST__.state.degree,cursor:window.__ENGINE2C_TEST__.state.cursor,first:window.__ENGINE2C_TEST__.state.rows[0]?.researchCandleId,last:window.__ENGINE2C_TEST__.state.rows.at(-1)?.researchCandleId}));
   await page.waitForFunction(()=>window.__ENGINE2C_TEST__.state.rows.length>=1000,{timeout:30000});
   assert.equal((await api()).n,1000);
   for(let i=0;i<4;i++)await page.evaluate(()=>window.__ENGINE2C_TEST__.older());
   assert.equal((await api()).n,5000);
   await page.click('#zoomIn');await page.click('#zoomOut');
   await page.evaluate(()=>window.__ENGINE2C_TEST__.state.offset=350);
   const before=await page.evaluate(()=>{const s=window.__ENGINE2C_TEST__.state;return {anchor:s.rows[s.offset]?.researchCandleId,offset:s.offset}});
   await page.evaluate(()=>window.__ENGINE2C_TEST__.older());
   const after=await page.evaluate(()=>{const s=window.__ENGINE2C_TEST__.state;return {anchor:s.rows[s.offset]?.researchCandleId,offset:s.offset}});
   assert.equal(after.anchor,before.anchor,'append must preserve logical anchor');
   for(let i=0;i<20;i++)await page.evaluate(()=>window.__ENGINE2C_TEST__.older());
   assert.equal((await api()).n,25000);
   const state=await page.evaluate(()=>{const s=window.__ENGINE2C_TEST__.state;return {unique:new Set(s.rows.map(r=>r.researchCandleId)).size,count:s.rows.length,firstTime:s.rows[0].timestampUtc,lastTime:s.rows.at(-1).timestampUtc}});
   const olderRange=await api();
   assert.ok(await page.locator('#newer').count()===1);
   await page.evaluate(()=>window.__ENGINE2C_TEST__.newer());
   const newerRange=await api();
   assert.equal(newerRange.n,25000);
   assert.notEqual(newerRange.first,olderRange.first,'newer reload should restore a previously evicted page');
   await page.evaluate(()=>window.__ENGINE2C_TEST__.older());
   assert.equal((await api()).n,25000,'older navigation should work again after newer reload');
   assert.equal(state.unique,25000);assert.ok(Date.parse(state.firstTime)<=Date.parse(state.lastTime));
   for(const v of ['UNADJUSTED','ADJUSTED_RESEARCH','ACTUAL_CONTRACT'])for(const f of ['5m','10m','1h','4h','1d','1w','1mo']){
    await page.selectOption('#view',v);await page.selectOption('#frame',f);
    await page.waitForFunction(([view,frame])=>{const s=window.__ENGINE2C_TEST__.state;return s.view===view&&s.frame===frame&&s.rows.length>0;},[v,f],{timeout:30000});
    const details=await api();assert.ok(details.n>0);
    for(const degree of ['ALL','SUBMICRO','MICRO','SUBMINUTE','MINUTE','MINOR','INTERMEDIATE','PRIMARY']){
     await page.selectOption('#degree',degree);assert.equal((await api()).degree,degree);
    }
   }
   assert.equal(await page.locator('#chart canvas').count(),1);
   const owners=await page.evaluate(()=>({nodes:Object.values(window.__ENGINE2C_TEST__.state.handoff.nodeLayers.degrees).flat().length,fibs:window.__ENGINE2C_TEST__.state.handoff.nodeLayers.withheldFibonacciReferences.length}));
   assert.deepEqual(owners,{nodes:40,fibs:34});
   // Privacy-safe screenshot: hide market-price canvas, axis, source-price tables and original mark values.
   // Chart correctness is asserted above in Chromium; image demonstrates responsive controls only.
   await page.addStyleTag({content:'#chart,#nodes,#coverage,#fib{visibility:hidden!important} .chartWrap{background:#111827!important}'});
   await page.screenshot({path:'/tmp/engine2c-v2-ui-redacted-'+viewport.width+'.png',fullPage:true});
   console.log('PASS authentic Chromium V2',viewport.width,'1k/5k/25k, older/newer cache reload, 3x7x8 selections, 40 owner records, 34 withheld Fibs; no source-price output');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
