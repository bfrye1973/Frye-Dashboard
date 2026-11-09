// Engine 11B PRIMARY-only forensic verification.
// Strictly read-only; verifies existing signed Engine11 artifact page SHA256.
// Does not snap or rewrite owner timestamps or source candles.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const root=process.env.ENGINE11B_VERIFIED_PAGES;
assert.ok(root&&fs.existsSync(root),"SIGNED_ENGINE11_PAGES_REQUIRED");
const dir=fs.existsSync(path.join(root,"continuousRaw2020plus-catalog.json"))?root:path.join(root,"continuousRaw2020plus");
const read=f=>fs.readFileSync(path.join(dir,f));
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
const catBytes=read("continuousRaw2020plus-catalog.json"),cat=JSON.parse(catBytes);
const summary=JSON.parse(read("private-pages-verification.json"));
const dataset="research-dataset:2e555ba83cbf25466d3e8d157371cc423401f30a25ed35b33a95fca5f81aaae2";
const basis="price-basis:04ec3639248269336f8df3626c6c9a3eb119ac18cbc39429addbbb2f24d22b15";
assert.equal(summary.schema,"engine11.private-history-pages.verification.v1");
assert.equal(summary.sourceArtifactId,13158459519);
assert.equal(summary.catalogSha256,hash(catBytes));
assert.equal(cat.datasetVersion,dataset);
assert.equal(cat.priceBasisVersion,basis);
assert.equal(summary.datasetVersion,dataset);
assert.equal(summary.priceBasisVersion,basis);
const anchors=[
 ["W1 starting low","2020-04-01","08:00",2440],
 ["W1 ending high","2022-01-04","10:00",4806],
 ["W2 ending low","2022-10-13","09:00",3504],
 ["W3 ending high","2025-02-19","09:00",6157],
 ["W4 ending low","2025-04-07","07:00",4825],
].map(([node,date,time,price])=>({node,az:date+" "+time,utc:new Date(date+"T"+time+":00-07:00").toISOString(),
  t:Date.parse(date+"T"+time+":00-07:00"),price}));
const frames=[["5m",300000],["1h",3600000],["4h",14400000],["1d",86400000]];
const report=[];
for(const [frame,windowMs] of frames){
 const pages=cat.frames[frame]?.pages;
 assert.ok(pages?.length,"MISSING_FRAME_"+frame);
 const nearest=anchors.map(()=>({before:null,after:null,exact:null}));
 let scanned=0;const seen=new Set();
 for(let i=0;i<pages.length;i++){
  const meta=pages[i];
  assert.equal(meta.requestCursor,i===0?null:pages[i-1].nextCursor);
  const bytes=read(meta.name);
  assert.equal(hash(bytes),meta.sha256,"INVALID_SHA_"+frame+"_"+i);
  const pg=JSON.parse(bytes);
  assert.equal(pg.datasetVersion,dataset);
  assert.equal(pg.priceBasisVersion,basis);
  assert.equal(pg.frame,frame);
  assert.equal(pg.rows.length,meta.rows);
  for(const row of pg.rows){
   scanned++;
   const t=Date.parse(row.timestampUtc);
   assert.ok(Number.isFinite(t),"BAD_CANDLE_TIME");
   const id=row.researchCandleId;
   assert.ok(id&&!seen.has(id),"DUPLICATE_CANDLE_ID_"+frame);
   seen.add(id);
   assert.equal(row.priceBasisVersion,basis);
   for(const [ix,a] of anchors.entries()){
    const n=nearest[ix];
    if(t===a.t)n.exact=row;
    if(t<=a.t&&(!n.before||t>Date.parse(n.before.timestampUtc)))n.before=row;
    if(t>a.t&&(!n.after||t<Date.parse(n.after.timestampUtc)))n.after=row;
   }
  }
 }
 assert.equal(scanned,cat.frames[frame].rows);
 for(const [ix,a] of anchors.entries()){
  const n=nearest[ix];
  const b=n.before;
  const age=b?a.t-Date.parse(b.timestampUtc):null;
  // Candidate containing source bucket, NOT a validated chart mapping.
  // The exact session boundaries must be separately reviewed.
  const inNominalBucket=Boolean(b&&age>=0&&age<windowMs);
  const priceFits=Boolean(inNominalBucket&&a.price>=b.prices.low&&a.price<=b.prices.high);
  const fmt=r=>r?({utc:r.timestampUtc,contract:r.sourceContract,open:r.prices.open,high:r.prices.high,low:r.prices.low,close:r.prices.close}):null;
  report.push({node:a.node,frame,ownerAz:a.az,ownerUtc:a.utc,ownerPrice:a.price,
    exactCandleOpen:Boolean(n.exact),inNominalBucket,
    candidateCandle:fmt(b),nextCandle:fmt(n.after),
    withinCandidateHighLow:inNominalBucket?priceFits:null,
    status:!inNominalBucket?"UNVERIFIED_TIMESTAMP_NOT_IN_NOMINAL_BUCKET":priceFits?"PRICE_IN_RANGE":"PRICE_OUTSIDE_CANDLE_RANGE"});
 }
 console.log("ENGINE11_PRIMARY_VERIFIED_FRAME",JSON.stringify({frame,rows:scanned,pages:pages.length,dataset,basis,sha256:"ALL_PAGES_VERIFIED"}));
}
for(const item of report) console.log("ENGINE11_PRIMARY_ANCHOR",JSON.stringify(item));
console.log("ENGINE11_PRIMARY_COMPLETE",JSON.stringify({anchors:anchors.length,frames:frames.map(x=>x[0]),rows:report.length,priceInRange:report.filter(x=>x.status==="PRICE_IN_RANGE").length,outside:report.filter(x=>x.status==="PRICE_OUTSIDE_CANDLE_RANGE").length,unverified:report.filter(x=>x.status.startsWith("UNVERIFIED")).length}));
