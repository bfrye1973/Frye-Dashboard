// Engine 2B full React chart route/browser interaction smoke; never sends trading actions.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { chromium } from "playwright";
const root=path.resolve("build");
const types={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".svg":"image/svg+xml"};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  const target=path.resolve(root,"."+pathname);
  const candidate=target.startsWith(root+path.sep)&&fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,"index.html");
  res.writeHead(200,{"Content-Type":types[path.extname(candidate)]||"application/octet-stream"});
  fs.createReadStream(candidate).pipe(res);
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const port=server.address().port;
let browser;
const errors=[];
try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on("pageerror",error=>errors.push(String(error)));
  await page.addInitScript(()=>window.__API_BASE__="https://frye-market-backend-1.onrender.com");
  const payload={
    ok:true,symbol:"ES",schemaVersion:"engine2.chartOverlays.v1",
    snapshot:{authorityConflict:false},
    degrees:Object.fromEntries(["primary","intermediate","minor","minute","micro"].map((degree,i)=>[
      degree,{degree,drawable:true,wave:{current:"W1",status:"CANDIDATE",confirmationStatus:"PENDING"},
        marks:[],lines:[{id:"fib"+i,price:7800+i,label:"1.618",kind:"FIB"}]}
    ]))
  };
  await page.route("**/api/v1/engine2/chart-overlays/v1?symbol=ES",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify(payload)
  }));
  await page.goto("http://127.0.0.1:"+port+"/chart?symbol=ES&tf=10m",{waitUntil:"domcontentloaded",timeout:30000});
  await page.getByText("Indicators ▾",{exact:true}).first().click({timeout:20000});
  const toggle=page.getByLabel("Fib (Micro)",{exact:true});
  await toggle.check({timeout:20000});
  await page.locator('canvas[data-engine2b-degree="micro"]').waitFor({state:"attached",timeout:45000});
  await page.screenshot({path:"engine2b-full-chart-micro-on.png",fullPage:false});
  const active=await page.locator('canvas[data-engine2b-degree="micro"]').count();
  await toggle.uncheck();
  await page.locator('canvas[data-engine2b-degree="micro"]').waitFor({state:"detached",timeout:15000});
  const removed=await page.locator('canvas[data-engine2b-degree="micro"]').count();
  assert.equal(active,1);
  assert.equal(removed,0);
  // Only the new chart overlay must be exercised; unrelated page errors are reported but
  // not permitted to conceal a missing overlay.
  console.log("ENGINE2B_FULL_CHART_MICRO_TOGGLE_PASS",JSON.stringify({active,removed,pageErrors:errors.slice(0,4)}));
}finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
