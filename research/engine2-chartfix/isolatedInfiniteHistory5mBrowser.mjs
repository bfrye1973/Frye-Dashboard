// Isolated real Chromium + Lightweight Charts 4.2 smoke (synthetic OHLCV only).
// Does NOT serve the production Frye Dashboard or use any owner key.
import {createServer} from "node:http";
import {readFile, mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium} from "playwright";

const root=process.cwd();
const realLwc=resolve(root,"node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js");
const compiled=await build({
  entryPoints:[resolve(root,"src/pages/rows/RowChart/engine11InfiniteHistory5mProof.js")],
  bundle:true,format:"iife",globalName:"Engine11PagerProof",write:false,
  platform:"browser",target:"es2020",
});
const lwc=await readFile(realLwc);
const js=compiled.outputFiles[0].contents;
const html=`<!doctype html><html><head><meta charset="utf-8"/></head>
<body style="background:#0b0b14;margin:0">
<div id="chart" style="width:1100px;height:570px"></div>
<script src="/lwc.js"></script><script src="/pager.js"></script>
<script>
const el=document.getElementById("chart");
window.chart=LightweightCharts.createChart(el,{
 width:1100,height:570,
 layout:{background:{color:"#0b0b14"},textColor:"#ddd"},
 timeScale:{timeVisible:true},
});
window.price=chart.addCandlestickSeries({
 upColor:"#26a69a",downColor:"#ef5350",
 wickUpColor:"#26a69a",wickDownColor:"#ef5350",
 borderUpColor:"#26a69a",borderDownColor:"#ef5350"
});
window.volume=chart.addHistogramSeries({priceScaleId:""});
const makeBars=(start,n)=>Array.from({length:n},(_,i)=>{
 const k=start+i;
 const price=6000+Math.sin(k/30)*140+k*0.04;
 return {time:1770000000+k*300,open:price,high:price+4,
 low:price-4,close:price+Math.sin(k/9),volume:10+k%50};
});
const page=(bars,nextCursor)=>({
 bars,
 page:{frame:"5m",researchOnly:true,structuralEligible:false,
 executionPriceAuthority:false,nextCursor,
 rows:bars.slice().reverse().map(b=>({sourceContract:"ESZ2026",timestampUtc:new Date(b.time*1000).toISOString()}))}
});
window.__requests=[];
window.__fetchPage=async ({cursor})=>{
 window.__requests.push(cursor);
 if(cursor===null)return page(makeBars(1000,1000),"OLDER");
 if(cursor==="OLDER")return page(makeBars(0,1000),null);
 throw Error("UNEXPECTED_CURSOR");
};
window.__testError=null;
window.pager=Engine11PagerProof.createEngine115mInfiniteHistoryProof({
 chart,priceSeries:price,volumeSeries:volume,fetchPage:window.__fetchPage,
 ownerKey:"synthetic-browser-only",
 onError:e=>{window.__testError=String(e.message);},
});
window.__started=false;
pager.start().then(ok=>{
 window.__started=ok;
 chart.timeScale().setVisibleLogicalRange({from:900,to:999});
}).catch(e=>{window.__testError=String(e.message);});
</script></body></html>`;
const server=createServer((req,res)=>{
 const url=String(req.url).split("?")[0];
 let body,contentType;
 if(url==="/lwc.js"){body=lwc;contentType="application/javascript";}
 else if(url==="/pager.js"){body=js;contentType="application/javascript";}
 else {body=html;contentType="text/html";}
 res.writeHead(200,{"Content-Type":contentType,"Cache-Control":"no-store"});
 res.end(body);
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const port=server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:["--disable-gpu-sandbox"]});
 const page=await browser.newPage({viewport:{width:1150,height:650},deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:"+port, {waitUntil:"load"});
 await page.waitForFunction(()=>window.__started===true||window.__testError!==null,{timeout:20000});
 const initial=await page.evaluate(()=>({
  status:pager.snapshot(),requests:window.__requests,canvas:document.querySelectorAll("canvas").length,
  visible:chart.timeScale().getVisibleRange(),
  error:window.__testError
 }));
 assert.equal(initial.error,null);
 assert.equal(initial.requests.length,1);
 assert.equal(initial.status.loadedBars,1000);
 assert.ok(initial.canvas>0);
 assert.ok(initial.visible!==null);
 await mkdir("/tmp/engine2-infinite-history-browser",{recursive:true});
 await page.screenshot({path:"/tmp/engine2-infinite-history-browser/initial-1000.png"});
 await page.evaluate(()=>chart.timeScale().setVisibleLogicalRange({from:0,to:50}));
 await page.waitForFunction(()=>pager.snapshot().pages===2||window.__testError!==null,{timeout:20000});
 const after=await page.evaluate(()=>{
  const prevRange=chart.timeScale().getVisibleRange();
  const bar={time:1770000000+2000*300,open:6100,high:6101,low:6099,close:6100.25,volume:100};
  const refused=pager.updateLive(bar,{contractVerified:false});
  const accepted=pager.updateLive(bar,{contractVerified:true});
  return {status:pager.snapshot(),requests:window.__requests,
    range:prevRange, refused, accepted, error:window.__testError};
 });
 assert.equal(after.error,null);
 assert.equal(after.refused,false);
 assert.equal(after.accepted,true);
 assert.equal(after.status.loadedBars,2001);
 assert.equal(after.status.pages,2);
 assert.equal(after.requests.length,2);
 assert.equal(after.status.latestTime,1770000000+2000*300);
 await page.screenshot({path:"/tmp/engine2-infinite-history-browser/prepended-and-live.png"});
 assert.deepEqual(errors,[]);
 console.log("ENGINE2_5M_CHROMIUM_INFINITE_HISTORY_PASS",JSON.stringify({
  firstPageRequests:initial.requests.length,
  firstPageCandles:initial.status.loadedBars,
  pagesAfterScroll:after.status.pages,
  loadedBarsAfterLive:after.status.loadedBars,
  canvasCount:initial.canvas,
  screenshots:"/tmp/engine2-infinite-history-browser",
 }));
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
