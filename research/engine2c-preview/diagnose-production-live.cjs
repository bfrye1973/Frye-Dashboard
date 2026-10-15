const { chromium } = require('playwright');
(async () => {
 const browser=await chromium.launch({headless:true});
 try {
  for (const mode of ['live','research','live']) {
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   const errors=[], requests=[];
   page.on('pageerror', e=>errors.push(String(e.message).slice(0,250)));
   page.on('console',m=>{if(m.type()==='error'||/RowChart|seed/i.test(m.text()))errors.push(m.text().slice(0,250))});
   page.on('response',async r=>{if(/futures\/ohlc/.test(r.url())){let count='?';try{let j=await r.json(); count=Array.isArray(j)?j.length:Array.isArray(j.bars)?j.bars.length:'nonarray'}catch{}requests.push({status:r.status(),count,url:r.url().split('?')[0]})}});
   await page.goto('https://frye-dashboard.onrender.com/chart?symbol=ES&tf=10m&engine2cChart='+mode,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForTimeout(16000);
   const state=await page.evaluate(()=>{
    let gate=document.querySelector('[data-engine2c-chart-gate]'), live=document.querySelector('[data-engine2c-live-panel]');
    let canvases=[...document.querySelectorAll('canvas')].map(c=>{let r=c.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)}});
    return {gate:!!gate,live:!!live,canvases,bodyText:document.body.innerText.slice(0,500)};
   });
   console.log('MODE_DIAGNOSTIC',JSON.stringify({mode,...state,requests,errors:errors.slice(0,20)}));
   await page.screenshot({path:'/tmp/live-es-'+mode+'.png',fullPage:false}).catch(()=>{});
   await page.close();
  }
 } finally {await browser.close()}
})().catch(e=>{console.error('DIAGNOSTIC_ERROR',e);process.exit(1)});
