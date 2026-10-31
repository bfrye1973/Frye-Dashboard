// Engine2C P0: verify original dashboard's RESEARCH iframe auto-loads
// authenticated Backend-1 pages using real accepted Engine11 historical chunks.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=process.env.ENGINE2C_PRIVATE_PAGES;
if(!root)throw Error('ENGINE2C_PRIVATE_PAGES_REQUIRED');
const folders={UNADJUSTED:'continuousRaw',ADJUSTED_RESEARCH:'continuousAdjustedClose',ACTUAL_CONTRACT:'actualESZ2026'};
const catalogs=Object.fromEntries(Object.entries(folders).map(([v,d])=>[v,JSON.parse(fs.readFileSync(path.join(root,d,d+'-catalog.json'),'utf8'))]));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  let served=0;
  const historyHandler=async route=>{
    const request=route.request(),url=new URL(request.url()),origin='http://127.0.0.1:8193';
    const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Accept, X-Engine2C-Access',
      'Access-Control-Allow-Methods':'GET, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    const view=url.searchParams.get('view'),frame=url.searchParams.get('frame'),folder=folders[view],cat=catalogs[view];
    if(request.headers()['x-engine2c-access']!=='engine2c-private-browser-test-token')throw Error('OWNER_TOKEN_MISSING');
    if(!folder||!cat||!cat.frames[frame]||url.searchParams.get('datasetVersion')!==cat.datasetVersion||
      url.searchParams.get('priceBasisVersion')!==cat.priceBasisVersion||
      url.searchParams.get('direction')!=='DESC'||url.searchParams.get('limit')!=='1000')throw Error('HISTORY_API_CONTEXT_MISMATCH');
    const cursor=url.searchParams.get('cursor');
    const desc=cat.frames[frame].pages.find(x=>x.requestCursor===cursor);
    if(!desc)throw Error('HISTORY_CURSOR_UNAVAILABLE');
    const bytes=fs.readFileSync(path.join(root,folder,desc.name));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),desc.sha256);
    served++;
    await route.fulfill({status:200,headers,body:bytes});
  };
  await context.route('https://frye-market-backend-1.onrender.com/engine2c-private-history/page**',historyHandler);
  await page.goto('http://127.0.0.1:8193/chart?symbol=ES&tf=10m&engine2cChart=research#engine2cKey=engine2c-private-browser-test-token',{waitUntil:'domcontentloaded'});
  // Regression: standard owner tab with no fragment must expose a visible
  // unlock, accept verified key, then render the authentic 1000-page archive.
  const freshContext=await browser.newContext({viewport:{width:1440,height:900}});
  await freshContext.route('https://frye-market-backend-1.onrender.com/engine2c-private-history/page**',historyHandler);
  const fresh=await freshContext.newPage();
  await fresh.goto('http://127.0.0.1:8193/chart?symbol=ES&tf=10m&engine2cChart=research',{waitUntil:'domcontentloaded'});
  const freshFrame=fresh.frameLocator('[data-engine2c-research-panel] iframe');
  await freshFrame.locator('#unlockHistory:not([hidden])').waitFor({timeout:30000});
  await freshFrame.locator('#unlockHistoryKey').fill('engine2c-private-browser-test-token');
  await freshFrame.locator('#unlockHistoryButton').click();
  await fresh.waitForFunction(()=>{
    const w=document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow;
    return w?.__ENGINE2C_TEST__?.state?.rows?.length===1000;
  },null,{timeout:30000});
  await fresh.reload({waitUntil:'domcontentloaded'});
  await fresh.waitForFunction(()=>{
    const w=document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow;
    return w?.__ENGINE2C_TEST__?.state?.rows?.length===1000;
  },null,{timeout:30000});
  await freshContext.close();
  const frame=page.frameLocator('[data-engine2c-research-panel] iframe');
  const state=()=>page.evaluate(()=>{
    const w=document.querySelector('[data-engine2c-research-panel] iframe').contentWindow;
    const s=w?.__ENGINE2C_TEST__?.state;
    return {n:s?.rows?.length||0,unique:new Set(s?.rows?.map(r=>r.researchCandleId)||[]).size,
      ownerNodes:s?.handoff?Object.values(s.handoff.nodeLayers.degrees).flat().length:0,
      fibs:s?.handoff?.nodeLayers?.withheldFibonacciReferences?.length||0,
      status:w?.document?.getElementById('status')?.textContent||''};
  });
  const wait=async count=>{
    await page.waitForFunction(n=>document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow?.__ENGINE2C_TEST__?.state?.rows?.length===n,count,{timeout:40000});
    const s=await state();assert.equal(s.n,count);assert.equal(s.unique,count);
  };
  await wait(1000);
  // Second dashboard tab has no URL access key and no shared sessionStorage.
  // It must load the same authentic pages using the temporary research-only
  // authorization stored for this browser origin by the first tab.
  const second=await context.newPage();
  await second.goto('http://127.0.0.1:8193/chart?symbol=ES&tf=10m&engine2cChart=research',{waitUntil:'domcontentloaded'});
  await second.waitForFunction(()=>{
    const w=document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow;
    return w?.__ENGINE2C_TEST__?.state?.rows?.length===1000;
  },null,{timeout:40000});
  assert.equal(await second.locator('[data-engine2c-research-panel] iframe').count(),1);
  await second.close();
  const control=fn=>page.evaluate(fn=>document.querySelector('[data-engine2c-research-panel] iframe').contentWindow.__ENGINE2C_TEST__[fn](),fn);
  for(let i=0;i<4;i++)await control('older');
  await wait(5000);
  for(let i=0;i<20;i++)await control('older');
  await wait(25000);
  const s=await state();
  assert.equal(s.ownerNodes,40);assert.equal(s.fibs,34);
  await control('newer');assert.equal((await state()).n,25000);
  await frame.locator('#view').selectOption('ACTUAL_CONTRACT');
  await page.waitForFunction(()=>document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow?.__ENGINE2C_TEST__?.state?.view==='ACTUAL_CONTRACT');
  await frame.locator('#frame').selectOption('10m');
  await page.waitForFunction(()=>document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow?.__ENGINE2C_TEST__?.state?.rows?.length===1000,{timeout:30000});
  assert.ok(served>=26);
  await page.locator('[data-engine2c-live]').click();
  await page.locator('[data-engine2c-live-panel]').waitFor();
  assert.equal(await page.locator('[data-engine2c-research-panel]').count(),0);
  console.log('PASS original RESEARCH auto-loaded authentic hosted-equivalent Engine11 history 1000/5000/25000; owner nodes 40; 34 withheld fibs; LIVE unchanged');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
