import {
  ENGINE22_WORKING_NODES_SCHEMA,
  validatedEngine22WorkingNodeAnchors,waveNodeFeedChanged,
  currentEngine22MicroSubmicroAnchors,
} from "./engine22WorkingNodeReader";
import {checkedDisplayCandleOpen} from "./intermediateMinorReview";

const sourceNode=(degree,label,price,marketAtUtc)=>({
 nodeId:"n-"+degree+"-"+label,degree,label,price,marketAtUtc,
 sourceRevision:"revision-1",sourcePath:"currentWavelength.degrees."+degree+
   (degree==="micro"?".ownerMicroW3Nov9ReclassifiedResearch":".ownerSubmicroW3Nov9InternalResearch"),
 modelVersion:"engine22.research.v1",approvalStatus:"RESEARCH",
 selectedForResearchDisplay:true,priceBasisStatus:"PENDING",
 presentationAllowed:true,plotAllowed:false,noExecution:true,
 waveCompletionConfirmed:false,
});
const packet=(fp="first")=>({
 schema:ENGINE22_WORKING_NODES_SCHEMA,authority:"ENGINE22",
 available:true,symbol:"ES",readOnly:true,noExecution:true,
 ownerCountPromotion:false,fingerprint:fp,
 degrees:{
  micro:{degree:"micro",nodes:[
    sourceNode("micro","W1 High",7469,"2026-11-06T14:40:00.000Z"),
    sourceNode("micro","W2 research anchor",7362,"2026-11-08T23:00:00.000Z")
  ]},
  submicro:{degree:"submicro",nodes:[
    sourceNode("submicro","W1 Low",7390.25,"2026-11-09T08:00:00.000Z"),
    sourceNode("submicro","W1 High",7476,"2026-11-09T13:00:00.000Z"),
    sourceNode("submicro","W2 research anchor",7449.25,"2026-11-09T13:20:00.000Z")
  ]}
 }
});

test("use exact validated Engine22 Micro/Submicro nodes, not old static source",()=>{
 const data=packet();
 const sub=validatedEngine22WorkingNodeAnchors(data,"submicro");
 expect(sub.map(n=>[n.label,n.price,n.timeSec])).toEqual([
  ["W1 Low",7390.25,Date.parse("2026-11-09T08:00:00.000Z")/1000],
  ["W1 High",7476,Date.parse("2026-11-09T13:00:00.000Z")/1000],
  ["W2 research anchor",7449.25,Date.parse("2026-11-09T13:20:00.000Z")/1000],
 ]);
 expect(sub.every(n=>n.classification==="OWNER RESEARCH"&&n.executionEligible===false)).toBe(true);
 expect(validatedEngine22WorkingNodeAnchors(data,"micro")[0].price).toBe(7469);
 expect(validatedEngine22WorkingNodeAnchors(data,"primary")).toBeNull();
});

test("change detector de-duplicates recurring snapshots, detects anchor revisions",()=>{
 const one=packet("sha-a");
 expect(waveNodeFeedChanged(null,one)).toBe(true);
 expect(waveNodeFeedChanged(one,packet("sha-a"))).toBe(false);
 expect(waveNodeFeedChanged(one,packet("sha-b"))).toBe(true);
 expect(waveNodeFeedChanged(one,{schema:"wrong",fingerprint:"sha-b"})).toBe(false);
});

test("null feed preserves previously accepted stage instead of inventing pivots",()=>{
 expect(validatedEngine22WorkingNodeAnchors(null,"micro")).toBeNull();
 expect(validatedEngine22WorkingNodeAnchors({},"submicro")).toBeNull();
 expect(validatedEngine22WorkingNodeAnchors(packet(),"minute")).toBeNull();
});

test("unverified, malformed, fabricated and duplicate inputs are rejected",()=>{
 const original=packet();
 const bad=JSON.parse(JSON.stringify(original));
 bad.degrees.micro.nodes[0].marketAtUtc=null;
 expect(validatedEngine22WorkingNodeAnchors(bad,"micro").map(n=>n.label)).toEqual(["W2 research anchor"]);
 bad.degrees.micro.nodes[0].marketAtUtc="2026-11-06T14:40:00.000Z";
 bad.degrees.micro.nodes[0].price=7469.1;
 expect(validatedEngine22WorkingNodeAnchors(bad,"micro").map(n=>n.label)).toEqual(["W2 research anchor"]);
 bad.degrees.micro.nodes[0].price=7469;
 bad.degrees.micro.nodes[0].plotAllowed=true;
 expect(validatedEngine22WorkingNodeAnchors(bad,"micro").map(n=>n.label)).toEqual(["W2 research anchor"]);
 bad.degrees.micro.nodes[0].plotAllowed=false;
 bad.degrees.micro.nodes[0].waveCompletionConfirmed=true;
 expect(validatedEngine22WorkingNodeAnchors(bad,"micro").map(n=>n.label)).toEqual(["W2 research anchor"]);
 const duplicate=JSON.parse(JSON.stringify(original));
 duplicate.degrees.micro.nodes.push({...duplicate.degrees.micro.nodes[0]});
 expect(validatedEngine22WorkingNodeAnchors(duplicate,"micro")).toHaveLength(2);
});

test("selected Engine22 event maps only to a genuine loaded 10m candle and never moves ES price",()=>{
 const pkt=packet();
 const w1=validatedEngine22WorkingNodeAnchors(pkt,"submicro")[0];
 const open=Date.parse("2026-11-09T08:00:00Z")/1000;
 const existing=[{time:open-600},{time:open},{time:open+600}];
 expect(checkedDisplayCandleOpen(w1,"10m",existing)).toBe(open);
 expect(w1.price).toBe(7390.25);
 expect(checkedDisplayCandleOpen(w1,"10m",[{time:open-1800},{time:open+600}])).toBeNull();
 const later=validatedEngine22WorkingNodeAnchors(pkt,"submicro")[2];
 const before=Date.parse("2026-11-09T13:00:00Z")/1000;
 expect(checkedDisplayCandleOpen(later,"10m",[{time:before}])).toBeNull();
});

test("corrected owner Micro W2 16:00 Arizona maps to 23:00 UTC; old 15:00 is not current",()=>{
 const micro=validatedEngine22WorkingNodeAnchors(packet("owner-nov9-w2-correction"),"micro");
 const w2=micro.find(n=>n.label==="W2 research anchor");
 expect(w2.price).toBe(7362);
 expect(w2.timeSec).toBe(Date.parse("2026-11-08T23:00:00.000Z")/1000);
 expect(w2.timeSec).not.toBe(Date.parse("2026-11-08T22:00:00.000Z")/1000);
 const candle=w2.timeSec;
 expect(checkedDisplayCandleOpen(w2,"10m",[{time:candle-600},{time:candle},{time:candle+600}])).toBe(candle);
 expect(checkedDisplayCandleOpen(w2,"10m",[{time:candle-3600}])).toBeNull();
 expect(micro.every(n=>n.reviewOnly===true&&n.executionEligible===false)).toBe(true);
});

test("Micro and Submicro can never resurrect legacy hard-coded sheet nodes on missing Engine22 data",()=>{
  for(const degree of ["micro","submicro"]){
    expect(currentEngine22MicroSubmicroAnchors(null,degree)).toEqual([]);
    expect(currentEngine22MicroSubmicroAnchors({},degree)).toEqual([]);
    expect(currentEngine22MicroSubmicroAnchors({schema:"wrong"},degree)).toEqual([]);
    expect(currentEngine22MicroSubmicroAnchors(packet(),degree).length).toBeGreaterThan(0);
  }
  expect(currentEngine22MicroSubmicroAnchors(packet(),"minute")).toEqual([]);
});

test("malformed current Engine22 packet fails closed instead of old Submicro ABC or W1/W2",()=>{
  const bad=JSON.parse(JSON.stringify(packet()));
  bad.degrees.submicro.nodes.forEach(n=>{n.marketAtUtc=null});
  expect(currentEngine22MicroSubmicroAnchors(bad,"submicro")).toEqual([]);
});


test("seven degrees accept only validated Engine22 source nodes, never archived fallback",()=>{
 const packet={schema:"engine22.workingWaveNodes.v1",authority:"ENGINE22",available:true,symbol:"ES",readOnly:true,noExecution:true,ownerCountPromotion:false,fingerprint:"seven-current",degrees:{}};
 for(const degree of ["primary","intermediate","minor","minute","subminute","micro","submicro"]){
  packet.degrees[degree]={degree,nodes:[{degree,nodeId:degree+"-1",approvalStatus:"RESEARCH",selectedForResearchDisplay:true,sourcePath:"currentWavelength.degrees."+degree+".ownerWorking",modelVersion:"owner.v1",sourceRevision:"revision-1",label:"W1 Low",price:7324,marketAtUtc:"2026-11-09T16:00:00Z",priceBasisStatus:"PENDING",presentationAllowed:true,plotAllowed:false,noExecution:true,waveCompletionConfirmed:false}]};
  assert.equal(validatedEngine22WorkingNodeAnchors(packet,degree)?.length,1);
 }
 packet.degrees.primary.nodes[0].marketAtUtc=null;
 assert.deepEqual(validatedEngine22WorkingNodeAnchors(packet,"primary"),[]);
 assert.equal(validatedEngine22WorkingNodeAnchors(null,"primary"),null);
});
