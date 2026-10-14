// Browser-level research preview smoke. Requires Playwright Chromium and pinned Engine11 handoff.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const fixture=process.env.ENGINE2C_FIXTURE_FILE;
 if(!fixture||!fs.existsSync(fixture))throw Error('Pinned Engine11 fixture path required');
 const base=process.env.ENGINE2C_URL||'http://127.0.0.1:8173/research/engine2c-preview/index.html';
 const out=process.env.ENGINE2C_SCREENSHOTS||path.join(__dirname,'screenshots');
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);
   // Pinned fixture may autoload on page startup; explicit selection also exercises manual import.
   await page.locator('#fixture').setInputFiles(fixture);
   await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('sample candles loaded'),null,{timeout:15000});
   assert.match(await page.locator('#fixtureInfo').textContent(),/40 nodes \/ 34 withheld Fib refs/);
   for(const view of ['UNADJUSTED','ADJUSTED_RESEARCH','ACTUAL_CONTRACT']){
    await page.locator('#view').selectOption(view);
    for(const frame of ['5m','10m','1h','4h','1d','1w','1mo']){
     await page.locator('#frame').selectOption(frame);
     await page.waitForFunction(([v,f])=>{const s=document.querySelector('#status')?.textContent||'';return s.includes(v==='ADJUSTED_RESEARCH'?'Back-adjusted':v==='ACTUAL_CONTRACT'?'ESZ2026':'Unadjusted')&&s.includes('· '+f+' ·')&&s.includes('sample candles loaded');},[view,frame],{timeout:15000});
     assert.equal(await page.locator('#chartEmpty').isVisible(),false);
    }
   }
   await page.locator('#view').selectOption('UNADJUSTED');
   await page.locator('#frame').selectOption('5m');
   for(const degree of ['ALL','SUBMICRO','MICRO','SUBMINUTE','MINUTE','MINOR','INTERMEDIATE','PRIMARY']){
     await page.locator('#degree').selectOption(degree);
     assert.match(await page.locator('#status').textContent(),new RegExp('· '+degree+' ·'));
   }
   await page.locator('#degree').selectOption('ALL');
   await page.locator('#zoomIn').click();await page.locator('#zoomOut').click();
   await page.locator('#older').click();await page.locator('#roll').click();
   const state=await page.evaluate(()=>({rows:window.__ENGINE2C_TEST__.state.rows.length,limit:window.__ENGINE2C_TEST__.CAP,official:window.__ENGINE2C_TEST__.state.handoff.nodeLayers.officialFibonacciLevels.length,overflow:(()=>{const x=window.scrollX;window.scrollTo(10000,0);const actual=window.scrollX;window.scrollTo(x,0);return actual>1})(),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
   assert.equal(state.official,0);assert.ok(state.rows<=state.limit);
   if(state.overflow){
     const offenders=await page.evaluate(()=>[...document.querySelectorAll('*')].map(e=>({tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,80),right:Math.ceil(e.getBoundingClientRect().right),width:Math.ceil(e.getBoundingClientRect().width)})).filter(x=>x.right>innerWidth+1).slice(0,15));
     console.error('T26 horizontal overflow details',JSON.stringify({viewport,state,offenders}));
   }
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   assert.equal(state.overflow,false,'Unexpected horizontal viewport overflow');
   // Synthetic stress data is TEST-ONLY, never saved as authentic source evidence.
   // Run after screenshots to ensure visual proof always shows only the pinned Engine11 candles.
   if(name==='desktop'){
     const stress=await page.evaluate(()=>{
       const api=window.__ENGINE2C_TEST__, st=api.state;
       const sample=st.handoff.fixtures.UNADJUSTED['5m'].firstPage.rows[0];
       const basis=st.handoff.views.UNADJUSTED;
       const startNs=BigInt(sample.timestampNs)-BigInt(300*25100)*1000000000n;
       const generated=Array.from({length:25100},(_,i)=>({
         ...sample,
         researchCandleId:'SYNTHETIC_T26_STRESS_'+i,
         timestampNs:String(startNs+BigInt(i*300)*1000000000n),
         sourceContract:'ESZ2026',
         adjustment:0,
         structuralEligible:false,
         executionPriceAuthority:false
       }));
       api.appendPage({datasetVersion:basis.datasetVersion,priceBasisVersion:basis.priceBasisVersion,frame:'5m',researchOnly:true,structuralEligible:false,executionPriceAuthority:false,rows:generated,nextCursor:null},'T26_SYNTHETIC');
       const result={loaded:st.rows.length,cache:st.identities.size,cap:api.CAP,unique:new Set(st.rows.map(r=>r.researchCandleId)).size};
       // Synthetic observations must never persist into the user's evidence view.
       api.clearContext();api.loadSelection();
       return result;
     });
     assert.equal(stress.loaded,25000,'T26 synthetic browser cache must be 25k bounded');
     assert.equal(stress.cache,25000,'T26 cache identities must be bounded');
     assert.equal(stress.unique,25000,'T26 synthetic test must not duplicate candle IDs');
   }
   // Rapid same-tick price/frame selection: a stale microtask must not repaint the newest intent.
   await page.evaluate(()=>{
     document.querySelector('#view').value='ADJUSTED_RESEARCH';
     document.querySelector('#view').dispatchEvent(new Event('change',{bubbles:true}));
     document.querySelector('#view').value='ACTUAL_CONTRACT';
     document.querySelector('#view').dispatchEvent(new Event('change',{bubbles:true}));
   });
   await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('Actual ESZ2026'));
   const latest=await page.evaluate(()=>({view:window.__ENGINE2C_TEST__.state.view,contracts:window.__ENGINE2C_TEST__.state.rows.map(r=>r.sourceContract),adjustments:window.__ENGINE2C_TEST__.state.rows.map(r=>r.adjustment)}));
   assert.equal(latest.view,'ACTUAL_CONTRACT');
   assert.ok(latest.contracts.every(x=>x==='ESZ2026'));
   assert.ok(latest.adjustments.every(x=>x===0));
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close();}
 console.log('Engine2C browser acceptance exercised: 21 source combinations, eight degree controls, pinned integrity, desktop/mobile screenshots, viewport scrolling, newest-intent race guard, and labeled SYNTHETIC 25,100-row browser stress. Full two-year navigation remains unavailable from sample handoff.');
})().catch(e=>{console.error(e);process.exitCode=1;});
