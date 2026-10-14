const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const origin=process.env.ENGINE2C_DASHBOARD_URL||'http://127.0.0.1:8193';
 const results=[];
 try{
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
   const page=await browser.newPage({viewport});
   const browserErrors=[];
   page.on('pageerror',e=>browserErrors.push(e.message));
   page.on('console',msg=>{if(msg.type()==='error')browserErrors.push(msg.text());});
   await page.goto(origin+'/chart?symbol=ES&tf=10m&engine2cChart=research',{waitUntil:'domcontentloaded'});
   const gate=page.locator('[data-engine2c-chart-gate]');
   await gate.waitFor({timeout:20000});
   assert.equal(await page.locator('[data-engine2c-research-panel]').count(),1);
   assert.equal(await page.locator('[data-engine2c-live-panel]').count(),0);
   const iframe=page.frameLocator('iframe[title*="seven-degree ES research"]');
   try{
     await iframe.locator('#chart canvas').waitFor({state:'attached',timeout:16000});
   }catch(e){
     const frames=page.frames().map(fr=>({url:fr.url(),name:fr.name()}));
     const src=await page.locator('iframe[title*="seven-degree ES research"]').getAttribute('src');
     let text='UNAVAILABLE';
     try{text=(await iframe.locator('body').innerText()).slice(0,1200);}catch(err){text=String(err)}
     console.error('ENGINE2C_FRAME_DIAG',JSON.stringify({src,frames,text,browserErrors}));
     await page.screenshot({path:'/tmp/engine2c-integrated-'+name+'.png',fullPage:true});
     throw e;
   }
   await iframe.locator('#status').waitFor();
   await page.screenshot({path:'/tmp/engine2c-integrated-'+name+'.png',fullPage:true});
   await page.locator('[data-engine2c-live]').click();
   await page.locator('[data-engine2c-live-panel]').waitFor({timeout:10000});
   assert.equal(await page.locator('[data-engine2c-research-panel]').count(),0);
   await page.locator('[data-engine2c-research]').click();
   await page.locator('[data-engine2c-research-panel]').waitFor({timeout:10000});
   assert.equal(await page.locator('[data-engine2c-live-panel]').count(),0);
   results.push(name+': RESEARCH/LIVE/RESEARCH rollback rendered');
   await page.close();
  }
 }finally{await browser.close();}
 console.log(results.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1});
