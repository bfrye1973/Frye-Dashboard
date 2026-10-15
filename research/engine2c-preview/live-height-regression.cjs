const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage({viewport:{width:1440,height:900}});
const events=[];page.on('response',r=>{if(r.url().includes('/api/v1/futures/ohlc'))events.push({status:r.status(),url:r.url()})});
await page.goto('http://127.0.0.1:8193/chart?symbol=ES&tf=10m&engine2cChart=live',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(12000);
const a=await page.evaluate(()=>({height:document.querySelector('[data-engine2c-live-panel]')?.getBoundingClientRect().height,canvases:[...document.querySelectorAll('canvas')].map(c=>Math.round(c.getBoundingClientRect().height))}));
console.log('LIVE_CHART_HEIGHT',JSON.stringify({a,events}));
assert.ok(a.height>300,'LIVE chart panel must have usable height');
assert.ok(a.canvases.some(h=>h>200),'LIVE candle chart canvas must have usable height');
assert.ok(events.some(x=>x.status===200),'LIVE candle endpoint must respond 200');
await page.screenshot({path:'/tmp/live-es-fixed.png'});await page.close();}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
