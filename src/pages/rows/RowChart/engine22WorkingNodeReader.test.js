import {
  ENGINE22_WORKING_NODES_SCHEMA,
  validatedEngine22WorkingNodeAnchors,waveNodeFeedChanged,
} from "./engine22WorkingNodeReader";

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
  micro:{degree:"micro",nodes:[sourceNode("micro","W1 High",7469,"2026-11-06T14:40:00.000Z")]},
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
 expect(validatedEngine22WorkingNodeAnchors(bad,"micro")).toHaveLength(0);
 bad.degrees.micro.nodes[0].marketAtUtc="2026-11-06T14:40:00.000Z";
 bad.degrees.micro.nodes[0].price=7469.1;
 expect(validatedEngine22WorkingNodeAnchors(bad,"micro")).toHaveLength(0);
 bad.degrees.micro.nodes[0].price=7469;
 bad.degrees.micro.nodes[0].plotAllowed=true;
 expect(validatedEngine22WorkingNodeAnchors(bad,"micro")).toHaveLength(0);
 bad.degrees.micro.nodes[0].plotAllowed=false;
 bad.degrees.micro.nodes[0].waveCompletionConfirmed=true;
 expect(validatedEngine22WorkingNodeAnchors(bad,"micro")).toHaveLength(0);
 const duplicate=JSON.parse(JSON.stringify(original));
 duplicate.degrees.micro.nodes.push({...duplicate.degrees.micro.nodes[0]});
 expect(validatedEngine22WorkingNodeAnchors(duplicate,"micro")).toHaveLength(1);
});
