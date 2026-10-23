import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:850}});
 const network=[],errors=[];
 page.on("request",req=>{if(req.url().includes("engine2b-preview-api"))network.push({phase:"request",url:req.url()});});
 page.on("response",res=>{if(res.url().includes("engine2b-preview-api"))network.push({phase:"response",status:res.status(),url:res.url()});});
 page.on("requestfailed",req=>{if(req.url().includes("engine2b-preview-api"))network.push({phase:"failure",reason:req.failure()?.errorText,url:req.url()});});
 page.on("pageerror",e=>errors.push(String(e)));
 const navigation=await page.goto("https://engine2b-chart-test-web.onrender.com/chart?symbol=ES&tf=10m",{waitUntil:"domcontentloaded",timeout:60000});
 await page.screenshot({path:"engine2b-deployed-preview-diagnostic.png"});
 console.log("PREVIEW_DOCUMENT",JSON.stringify({status:navigation?.status(),url:page.url(),title:await page.title(),body:(await page.locator("body").innerText().catch(()=>"" )).slice(0,500),html:(await page.content()).slice(0,400)}));
 const symbol=await page.locator('select').allTextContents();
 console.log("SYMBOL_SELECTS",JSON.stringify(symbol.slice(0,4)));
 await page.getByText("Indicators ▾",{exact:true}).first().waitFor({state:"visible",timeout:60000});
 await page.getByText("Indicators ▾",{exact:true}).first().click({timeout:15000});
 const micro=page.getByLabel("Fib (Micro)",{exact:true});
 await micro.check({timeout:25000});
 await page.waitForTimeout(1500);
 const state=await page.evaluate(()=>{
 const c=document.querySelector('canvas[data-engine2b-degree="micro"]');
 let painted=false;
 if(c?.width&&c?.height){const p=c.getContext("2d").getImageData(0,0,c.width,c.height).data;for(let i=3;i<p.length;i+=4)if(p[i]>0){painted=true;break;}}
 return {canvasCount:document.querySelectorAll("canvas[data-engine2b-degree]").length,canvasWidth:c?.width,canvasHeight:c?.height,painted,apiBase:window.__API_BASE__,location:location.href};
 });
 console.log("DEPLOYED_PREVIEW_DIAGNOSTIC",JSON.stringify({state,network,errors}));
 await page.screenshot({path:"engine2b-deployed-preview-diagnostic.png"});
 assert.ok(network.some(n=>n.phase==="response"&&n.status===200),"Preview API must return overlay data");
 assert.ok(state.painted,"Micro must paint on deployed preview chart");
}finally{await browser.close();}
