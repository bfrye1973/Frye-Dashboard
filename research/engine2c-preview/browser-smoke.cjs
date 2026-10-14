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
   const state=await page.evaluate(()=>({rows:window.__ENGINE2C_TEST__.state.rows.length,limit:window.__ENGINE2C_TEST__.CAP,official:window.__ENGINE2C_TEST__.state.handoff.nodeLayers.officialFibonacciLevels.length,overflow:document.documentElement.scrollWidth>window.innerWidth+1}));
   assert.equal(state.official,0);assert.ok(state.rows<=state.limit);
   if(state.overflow){
     const offenders=await page.evaluate(()=>[...document.querySelectorAll('*')].map(e=>({tag:e.tagName,id:e.id,cls:String(e.className||'').slice(0,80),right:Math.ceil(e.getBoundingClientRect().right),width:Math.ceil(e.getBoundingClientRect().width)})).filter(x=>x.right>innerWidth+1).slice(0,15));
     console.error('T26 horizontal overflow details',JSON.stringify({viewport,offenders}));
   }
   assert.equal(state.overflow,false,'Unexpected horizontal viewport overflow');
   assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   await page.close();
  }
 }finally{await browser.close();}
 console.log('Engine2C browser smoke verified: 3 views × 7 frames, 8 degrees, desktop/mobile, screenshot capture; T24–T27 full acceptance remains pending.');
})().catch(e=>{console.error(e);process.exitCode=1;});
