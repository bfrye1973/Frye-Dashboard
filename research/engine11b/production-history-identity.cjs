// Engine11B read-only production identity check. Never prints or persists key.
const assert=require("node:assert/strict");
const url=new URL("https://frye-market-backend-1.onrender.com/engine2c-private-history/page");
url.searchParams.set("view","UNADJUSTED");
url.searchParams.set("frame","5m");
url.searchParams.set("limit","1000");
url.searchParams.set("direction","DESC");
url.searchParams.set("datasetVersion","research-dataset:2e555ba83cbf25466d3e8d157371cc423401f30a25ed35b33a95fca5f81aaae2");
url.searchParams.set("priceBasisVersion","price-basis:04ec3639248269336f8df3626c6c9a3eb119ac18cbc39429addbbb2f24d22b15");
(async()=>{
 const key=process.env.ENGINE11B_AUTHORIZED_HISTORY_OWNER_KEY;
 if(!key){
   console.log("ENGINE11B_PRODUCTION_IDENTITY_UNVERIFIED: approved credential not available to isolated workflow; no secret requested, stored or printed");
   process.exitCode=2;return;
 }
 const r=await fetch(url,{headers:{Accept:"application/json","X-Engine2C-Access":key},
   cache:"no-store",signal:AbortSignal.timeout(20000)});
 if(r.status!==200)throw Error("IDENTITY_HTTP_"+r.status);
 const p=await r.json();
 assert.equal(p.datasetVersion,url.searchParams.get("datasetVersion"));
 assert.equal(p.priceBasisVersion,url.searchParams.get("priceBasisVersion"));
 assert.equal(p.frame,"5m");
 assert.equal(p.researchOnly,true);
 assert.equal(p.structuralEligible,false);
 assert.equal(p.executionPriceAuthority,false);
 assert.equal(p.direction,"DESC");
 assert.ok(Array.isArray(p.rows)&&p.rows.length>0&&p.rows.length<=1000);
 assert.equal(p.rows[0].sourceContract,"ESZ2026");
 console.log("ENGINE11B_PRODUCTION_IDENTITY_PASS "+JSON.stringify({
   status:r.status,datasetVersion:p.datasetVersion,priceBasisVersion:p.priceBasisVersion,
   frame:p.frame,rows:p.rows.length,terminalContract:p.rows[0].sourceContract,
   firstUtc:p.rows[0].timestampUtc,hasNextCursor:Boolean(p.nextCursor),
 }));
})().catch(e=>{console.error("ENGINE11B_PRODUCTION_IDENTITY_NO_GO",String(e.message||e));process.exitCode=1});
