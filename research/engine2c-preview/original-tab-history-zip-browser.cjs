// Verify the existing Frye Dashboard RESEARCH iframe reads authentic Engine11 pages.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:8193/chart?symbol=ES&tf=10m&engine2cChart=research',{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('[data-engine2c-research-panel] iframe');
  await frame.locator('#historicalZip').waitFor({timeout:30000});
  await page.waitForFunction(()=>{
   const win=document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow;
   return Boolean(win?.__ENGINE2C_TEST__?.state?.handoff);
  },null,{timeout:30000});
  await frame.locator('#historicalZip').setInputFiles(process.env.ENGINE2C_ZIP_FILE);
  const state=()=>page.evaluate(()=>{
   const win=document.querySelector('[data-engine2c-research-panel] iframe').contentWindow;
   const s=win.__ENGINE2C_TEST__.state;
   return {n:s.rows.length,distinct:new Set(s.rows.map(r=>r.researchCandleId)).size,
     nodes:Object.values(s.handoff.nodeLayers.degrees).flat().length,
     fibs:s.handoff.nodeLayers.withheldFibonacciReferences.length,
     error:win.document.getElementById('status').textContent};
  });
  async function waitFor(n){
   await page.waitForFunction(n=>{
    const win=document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow;
    return win?.__ENGINE2C_TEST__?.state?.rows?.length===n || win?.document?.getElementById('status')?.textContent?.includes('BLOCKED');
   },n,{timeout:30000});
   const s=await state();assert.equal(s.n,n,s.error);
  }
  await waitFor(1000);
  const older=()=>page.evaluate(()=>document.querySelector('[data-engine2c-research-panel] iframe').contentWindow.__ENGINE2C_TEST__.older());
  for(let i=0;i<4;i++)await older();
  await waitFor(5000);
  for(let i=0;i<20;i++)await older();
  await waitFor(25000);
  const s=await state();
  assert.deepEqual([s.distinct,s.nodes,s.fibs],[25000,40,34]);
  const newer=()=>page.evaluate(()=>document.querySelector('[data-engine2c-research-panel] iframe').contentWindow.__ENGINE2C_TEST__.newer());
  await newer();assert.equal((await state()).n,25000);
  await page.getByRole('button',{name:'LIVE — original chart'}).click();
  await page.locator('[data-engine2c-live-panel]').waitFor();
  assert.equal(await page.locator('[data-engine2c-research-panel]').count(),0);
  console.log('PASS original existing dashboard RESEARCH iframe authentic Engine11 1000/5000/25000 candles; LIVE restores; NO new chart');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});