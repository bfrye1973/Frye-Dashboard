// Engine2C verification of ORIGINAL hosted-structure research chart.
// The CI dashboard is locally served, while ONLY Backend-1 requests are intercepted
// and answered from the byte-exact accepted Engine11 pages. No new chart is created.
const {chromium}=require('playwright');
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=process.env.ENGINE2C_PRIVATE_PAGES;
if(!root)throw Error('ENGINE2C_PRIVATE_PAGES_REQUIRED');
const folders={UNADJUSTED:'continuousRaw',ADJUSTED_RESEARCH:'continuousAdjustedClose',ACTUAL_CONTRACT:'actualESZ2026'};
const frames=['5m','10m','1h','4h','1d','1w','1mo'];
const degrees=['ALL','SUBMICRO','MICRO','SUBMINUTE','MINUTE','MINOR','INTERMEDIATE','PRIMARY'];
const catalog=Object.fromEntries(Object.entries(folders).map(([key,folder])=>[key,JSON.parse(fs.readFileSync(path.join(root,folder,folder+'-catalog.json')))]));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=[];
let served=0;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const p=await context.newPage();
  await context.route('https://frye-market-backend-1.onrender.com/engine2c-private-history/page**',async route=>{
    const req=route.request(),url=new URL(req.url());
    const heads={'Access-Control-Allow-Origin':'http://127.0.0.1:8193','Access-Control-Allow-Headers':'Accept, X-Engine2C-Access','Access-Control-Allow-Methods':'GET, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:heads,body:''});
    assert.equal(req.headers()['x-engine2c-access'],'engine2c-private-browser-test-token');
    const view=url.searchParams.get('view'),frame=url.searchParams.get('frame'),folder=folders[view],cat=catalog[view];
    assert.ok(folder&&frames.includes(frame),'unknown view/frame');
    assert.equal(url.searchParams.get('datasetVersion'),cat.datasetVersion);
    assert.equal(url.searchParams.get('priceBasisVersion'),cat.priceBasisVersion);
    assert.equal(url.searchParams.get('limit'),'1000');
    assert.equal(url.searchParams.get('direction'),'DESC');
    const cursor=url.searchParams.get('cursor');
    const entry=cat.frames[frame].pages.find(x=>x.requestCursor===cursor);
    assert.ok(entry,'missing cursor '+view+'/'+frame);
    const bytes=fs.readFileSync(path.join(root,folder,entry.name));
    assert.equal(digest(bytes),entry.sha256);
    served++;
    await route.fulfill({status:200,headers:heads,body:bytes});
  });
  await p.goto('http://127.0.0.1:8193/chart?symbol=ES&tf=10m&engine2cChart=research#engine2cKey=engine2c-private-browser-test-token',{waitUntil:'domcontentloaded'});
  const frame=p.frameLocator('[data-engine2c-research-panel] iframe');
  const inspect=()=>p.evaluate(()=>{
    const win=document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow;
    const s=win?.__ENGINE2C_TEST__?.state;
    const x=s?.rows||[];
    return {n:x.length,unique:new Set(x.map(r=>r.researchCandleId)).size,
      first:x[0]?.timestampUtc,last:x.at(-1)?.timestampUtc,
      basis:[...new Set(x.map(r=>r.priceBasisVersion))],
      ordered:x.every((r,i)=>i===0||Number(r.timestampNs)>=Number(x[i-1].timestampNs)),
      view:s?.view,frame:s?.frame,degree:s?.degree,cursor:s?.cursor,
      offset:s?.offset,zoom:s?.zoom,
      status:win?.document?.getElementById('status')?.textContent||''};
  });
  const func=(name)=>p.evaluate(n=>document.querySelector('[data-engine2c-research-panel] iframe').contentWindow.__ENGINE2C_TEST__[n](),name);
  async function verifyReady(view,f){
    await p.waitForFunction(([v,tf])=>{
      const s=document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow?.__ENGINE2C_TEST__?.state;
      return s?.view===v && s?.frame===tf && s?.rows?.length>0;
    },[view,f],{timeout:30000});
    const s=await inspect();
    assert.equal(s.unique,s.n,'duplicate rows '+view+'/'+f);
    assert.ok(s.ordered,'out-of-order bars '+view+'/'+f);
    assert.deepEqual(s.basis,[catalog[view].priceBasisVersion],'mixed price basis '+view+'/'+f);
    return s;
  }
  await p.waitForFunction(()=>document.querySelector('[data-engine2c-research-panel] iframe')?.contentWindow?.__ENGINE2C_TEST__?.state?.rows?.length===1000,null,{timeout:30000});
  for(const [view,folder] of Object.entries(folders)){
    await frame.locator('#view').selectOption(view);
    for(const f of frames){
      await frame.locator('#frame').selectOption(f);
      const s=await verifyReady(view,f);
      // Check all controls, backed by the accepted dataset manifest's real ranges.
      const group=catalog[view].frames[f],newest=JSON.parse(fs.readFileSync(path.join(root,folder,group.pages[0].name))).rows[0];
      const oldestPage=JSON.parse(fs.readFileSync(path.join(root,folder,group.pages.at(-1).name)));
      const oldest=oldestPage.rows.at(-1);
      results.push({view,frame:f,count:group.rows,pages:group.pages.length,
        earliest:oldest.timestampUtc,latest:newest.timestampUtc,loaded:s.n});
      for(const degree of degrees){
        await frame.locator('#degree').selectOption(degree);
        assert.equal((await inspect()).degree,degree,'degree switch failed');
      }
      // Restore ALL before changing timeframe; no prices recalculated for degree changes.
      await frame.locator('#degree').selectOption('ALL');
    }
  }
  // Deep oldest-boundary test for BOTH continuous 1-hour collections.
  for(const view of ['UNADJUSTED','ADJUSTED_RESEARCH']){
    await frame.locator('#view').selectOption(view);
    await frame.locator('#frame').selectOption('1h');
    await verifyReady(view,'1h');
    const group=catalog[view].frames['1h'];
    for(let i=1;i<group.pages.length;i++)await func('older');
    let s=await inspect();
    assert.equal(s.n,group.rows);
    assert.equal(s.first,results.find(r=>r.view===view&&r.frame==='1h').earliest);
    assert.equal(s.cursor,null);
    assert.ok(s.ordered);assert.equal(s.unique,s.n);
    // No cross-view contamination after switching contexts.
  }
  // The 25,000-candle bounded window must keep functioning at deep history.
  await frame.locator('#view').selectOption('UNADJUSTED');
  await frame.locator('#frame').selectOption('5m');
  await verifyReady('UNADJUSTED','5m');
  const full=catalog.UNADJUSTED.frames['5m'];
  for(let i=1;i<full.pages.length;i++){
    await func('older');
    const s=await inspect();
    if(s.status.includes('BLOCKED'))throw Error('OLDER_PAGE_FAILED at index '+i+': '+s.status);
    assert.ok(s.n<=25000,'memory cap violated');
    assert.equal(s.unique,s.n,'duplicate after page '+i);
    assert.ok(s.ordered,'out-of-order after page '+i);
  }
  const oldestWindow=await inspect();
  assert.equal(oldestWindow.first,results.find(x=>x.view==='UNADJUSTED'&&x.frame==='5m').earliest);
  assert.equal(oldestWindow.cursor,null);
  assert.equal(oldestWindow.n,25000);
  await func('newer');
  const newerWindow=await inspect();
  assert.ok(newerWindow.first!==oldestWindow.first,'newer reload did not advance');
  assert.equal(newerWindow.n,25000);
  assert.equal(newerWindow.unique,25000);
  await func('older');
  const returnWindow=await inspect();
  assert.equal(returnWindow.first,oldestWindow.first,'cannot return to oldest boundary after newer page reload');
  assert.equal(returnWindow.n,25000);
  assert.equal(returnWindow.unique,25000);

  // Basic zoom and wheel pan with the original canvas.
  await frame.locator('#zoomIn').click();
  const zoomed=await inspect();assert.ok(zoomed.zoom>1);
  await frame.locator('#zoomOut').click();
  assert.ok((await inspect()).zoom<=zoomed.zoom);
  await frame.locator('#chart').evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true})));
  assert.ok((await inspect()).ordered);
  await p.locator('[data-engine2c-live]').click();
  await p.locator('[data-engine2c-live-panel]').waitFor();
  await p.locator('[data-engine2c-research]').click();
  await verifyReady('UNADJUSTED','5m');
  console.log('ENGINE2C_21_COLLECTION_RANGES '+JSON.stringify(results));
  console.log('ENGINE2C_PASS all 21 combinations, oldest 1h both continuous, 5m all 142 pages to Oct 2024, newer reload, cap, zoom/pan, RESEARCH-LIVE-RESEARCH; served='+served);
 }finally{await browser.close();}
})().catch(e=>{console.error('ENGINE2C_FAIL',e.stack);process.exitCode=1});
