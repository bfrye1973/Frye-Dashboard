// Engine 2B headless Chromium smoke test of the real canvas renderer, no production access.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { chromium } from "playwright";

const source = fs.readFileSync(new URL("../src/pages/rows/RowChart/overlays/WaveFibOverlay.jsx", import.meta.url), "utf8");
const payload = {
  ok: true, symbol: "ES", schemaVersion: "engine2.chartOverlays.v1",
  snapshot: { authorityConflict: false },
  degrees: Object.fromEntries(
    ["primary","intermediate","minor","minute","micro"].map((degree,i) => [
      degree, {degree,drawable:true,lines:[{id:"fib",price:7800+i,label:"1.618",kind:"FIB"}],
        marks:[{id:"w1",label:"W1",price:7800+i,time:1791630000,status:"CANDIDATE"}]}
    ])
  )
};
let requests=0;
const server=http.createServer((req,res)=>{
  if(req.url==="/WaveFibOverlay.mjs"){
    res.writeHead(200,{"Content-Type":"text/javascript"});res.end(source);return;
  }
  if(req.url?.startsWith("/api/v1/engine2/chart-overlays/v1")){
    requests+=1;
    res.writeHead(200,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"});
    res.end(JSON.stringify(payload));return;
  }
  res.writeHead(200,{"Content-Type":"text/html"});
  res.end("<!doctype html><html><body><div id='host' style='width:800px;height:450px;position:relative'></div></body></html>");
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const port=server.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.addInitScript(url=>{window.__API_BASE__=url;},'http://127.0.0.1:'+port);
  await page.goto('http://127.0.0.1:'+port);
  const result=await page.evaluate(async()=>{
    const {default:WaveFibOverlay}=await import("/WaveFibOverlay.mjs");
    const callbacks=new Set();
    const ts={timeToCoordinate:()=>110,subscribeVisibleTimeRangeChange:cb=>callbacks.add(cb),
      unsubscribeVisibleTimeRangeChange:cb=>callbacks.delete(cb)};
    const chart={timeScale:()=>ts};
    const priceSeries={priceToCoordinate:()=>150};
    const host=document.querySelector("#host");
    const degrees=["primary","intermediate","minor","minute","micro"];
    const instances=degrees.map(degree=>WaveFibOverlay({chart,priceSeries,chartContainer:host,
      symbol:"ES",degree,enabled:true}));
    for(const inst of instances)inst.seed([{time:1791630000},{time:1791630600}]);
    await new Promise((resolve,reject)=>{
      const until=Date.now()+4000;
      const check=()=>document.querySelectorAll("canvas[data-engine2b-degree]").length===5
        ? resolve() : Date.now()>until ? reject(Error("Canvas render timeout")) : setTimeout(check,25);
      check();
    });
    const attached=document.querySelectorAll("canvas[data-engine2b-degree]").length;
    // Simulates zoom/pan redraw callbacks on the renderer.
    for(const cb of callbacks)cb();
    await new Promise(ok=>setTimeout(ok,70));
    await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
    const canvases=[...document.querySelectorAll("canvas[data-engine2b-degree]")];
    const painted=canvases.map(c=>c.getContext("2d").getImageData(300,150,1,1).data[3]>0);
    window.__engine2bCleanup=()=>{
      instances[0].destroy();
      const afterToggle=document.querySelectorAll("canvas[data-engine2b-degree]").length;
      for(const inst of instances.slice(1))inst.destroy();
      return {afterToggle,afterDestroy:document.querySelectorAll("canvas[data-engine2b-degree]").length,
        listenersRemaining:callbacks.size};
    };
    return {attached,painted};
  });
  console.log("BROWSER_RENDER_INSPECTION",JSON.stringify(result));
  await page.screenshot({path:"engine2b-browser-smoke.png"});
  assert.equal(result.attached,5);
  assert.ok(result.painted.every(Boolean),"All five degree canvases must contain painted fib geometry");
  assert.equal(requests,1,"All five degrees should share one request");
  const cleanup=await page.evaluate(()=>window.__engine2bCleanup());
  assert.equal(cleanup.afterToggle,4);
  assert.equal(cleanup.afterDestroy,0);
  assert.equal(cleanup.listenersRemaining,0);
  console.log("PASS Engine2B Chromium five-degree painted canvas, shared fetch, zoom redraw, and teardown",result,cleanup);
}finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
