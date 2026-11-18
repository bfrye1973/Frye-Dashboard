import {validateEngine18ChartZones,selectEngine18TestZones,advanceEngine18StableLevels,advanceEngine18AnchoredObservations,describeEngine18NoCandidate} from "./Engine18LiquidityZonesOverlay";
const now=1794344915000;
const sample={schema:"engine18.chartLiquidityDemo.v1",symbol:"XCME:ES.Z26",
 available:true,executionEligible:false,displayOnly:true,mode:"DEMO_RESEARCH_ONLY",
 level:2,asOfUnixMs:now-200,zones:[
 {side:"BID",price:7551,visibleContracts:71,observedInImages:23},
 {side:"ASK",price:7554.25,visibleContracts:35,observedInImages:52},
 {side:"ASK",price:7554.25,visibleContracts:35,observedInImages:52}
]};
test("only fresh read-only demo Level 2 zone packet is rendered",()=>{
 const zones=validateEngine18ChartZones(sample,now);
 expect(zones).toHaveLength(2);
 expect(zones[0]).toMatchObject({side:"BID",price:7551,visibleContracts:71});
});
test("stale, unavailable, or non-ES packets hide all overlays",()=>{
 for(const patch of [{available:false},{symbol:"XCME:NQ.Z26"},{level:3},
  {executionEligible:true},{asOfUnixMs:now-30000},{asOfUnixMs:now+1000}]){
  expect(validateEngine18ChartZones({...sample,...patch},now)).toEqual([]);
 }
});
test("invalid tick prices and zero order size are rejected",()=>{
 expect(validateEngine18ChartZones({...sample,zones:[
  {side:"BID",price:7551.12,visibleContracts:100},
  {side:"ASK",price:7552,visibleContracts:0}
 ]},now)).toEqual([]);
});

test("chart always limits each side to two and orders by displayed contracts",()=>{
 const zones=[
 {side:"ASK",price:7561,visibleContracts:12,observedInImages:10},
 {side:"ASK",price:7562,visibleContracts:50,observedInImages:5},
 {side:"ASK",price:7563,visibleContracts:30,observedInImages:9},
 {side:"BID",price:7549,visibleContracts:45,observedInImages:3},
 {side:"BID",price:7548,visibleContracts:20,observedInImages:9},
 {side:"BID",price:7547,visibleContracts:80,observedInImages:8}
 ];
 const selected=selectEngine18TestZones(zones);
 expect(selected).toHaveLength(4);
 expect(selected.filter(z=>z.side==="ASK").map(z=>z.visibleContracts)).toEqual([50,30]);
 expect(selected.filter(z=>z.side==="BID").map(z=>z.visibleContracts)).toEqual([80,45]);
 expect(selectEngine18TestZones(zones.filter(z=>z.side==="BID"))).toHaveLength(2);
});

test("two unique fresh feeds required before any line is shown",()=>{
 const a=advanceEngine18StableLevels(null,sample,now);
 expect(a.zones).toEqual([]);
 const unchanged=advanceEngine18StableLevels(a,sample,now);
 expect(unchanged.zones).toEqual([]);
 const b=advanceEngine18StableLevels(unchanged,{...sample,asOfUnixMs:now-100},now);
 expect(b.zones).toHaveLength(2);
});
test("vanished resting liquidity is removed immediately; no ghost levels",()=>{
 const a=advanceEngine18StableLevels(null,sample,now);
 const b=advanceEngine18StableLevels(a,{...sample,asOfUnixMs:now-100},now);
 const next=advanceEngine18StableLevels(b,{...sample,asOfUnixMs:now,
   zones:[{side:"BID",price:7551,visibleContracts:100}]},now);
 expect(next.zones).toEqual([{side:"BID",price:7551,visibleContracts:100,observedInImages:0}]);
 expect(advanceEngine18StableLevels(next,{...sample,available:false},now).zones).toEqual([]);
});
test("two of each side are selected independently",()=>{
 const zones=[1,2,3,4].map(i=>({side:"BID",price:7548+i*.25,visibleContracts:i*10}))
   .concat([1,2,3,4].map(i=>({side:"ASK",price:7555+i*.25,visibleContracts:i*5})));
 const selected=selectEngine18TestZones(zones);
 expect(selected.filter(z=>z.side==="BID")).toHaveLength(2);
 expect(selected.filter(z=>z.side==="ASK")).toHaveLength(2);
 expect(selected[0].visibleContracts).toBe(20);
 expect(selected[2].visibleContracts).toBe(40);
});

test("anchored levels do not chase price when the MBP-10 shortlist moves",()=>{
 const packet=(t,zones)=>({...sample,asOfUnixMs:t,zones});
 const a=(price,size=80)=>({side:"BID",price,visibleContracts:size,observedInImages:30});
 const ask=(price,size=65)=>({side:"ASK",price,visibleContracts:size,observedInImages:30});
 let state=null;
 // Genuine distinct source timestamps, >=30 seconds span at the SAME price.
 for(let t=now-40000;t<=now-10000;t+=5000)
  state=advanceEngine18AnchoredObservations(state,packet(t,[a(7500),ask(7502)]),t+100);
 expect(state.zones.map(z=>z.price).sort()).toEqual([7500,7502]);
 expect(state.zones.every(z=>z.status==="OBSERVED")).toBe(true);
 // Moving bid/ask shortlist causes price-following in previous implementation.
 const next=advanceEngine18AnchoredObservations(state,packet(now-5000,
  [a(7496,150),ask(7498,150)]),now);
 expect(next.zones.map(z=>z.price).sort()).toEqual([7500,7502]);
 expect(next.zones.every(z=>z.status==="LAST_SEEN")).toBe(true);
 expect(next.zones.every(z=>z.qualified)).toBe(true);
 expect(next.zones.some(z=>z.price===7496)).toBe(false);
});
test("two polls or two distinct snapshots cannot fabricate elapsed persistence",()=>{
 const packet=(t,zones)=>({...sample,asOfUnixMs:t,zones});
 const level={side:"BID",price:7480,visibleContracts:100,observedInImages:100};
 let state=advanceEngine18AnchoredObservations(null,packet(now-10000,[level]),now);
 const repeated=advanceEngine18AnchoredObservations(state,packet(now-10000,[level]),now);
 expect(repeated).toBe(state);
 state=advanceEngine18AnchoredObservations(state,packet(now-5000,[level]),now);
 expect(state.zones).toEqual([]);
});
test("historical observations expire; stale, unauthorized packets clear anchors",()=>{
 const packet=(t,zones)=>({...sample,asOfUnixMs:t,zones});
 const level={side:"ASK",price:7520,visibleContracts:100,observedInImages:50};
 let state=null;
 for(let t=now-45000;t<=now-15000;t+=5000)
  state=advanceEngine18AnchoredObservations(state,packet(t,[level]),t+100);
 expect(state.zones).toHaveLength(1);
 state=advanceEngine18AnchoredObservations(state,packet(now-10000,[]),now);
 expect(state.zones[0].status).toBe("LAST_SEEN");
 expect(advanceEngine18AnchoredObservations(state,
  {...packet(now-5000,[]),available:false},now).zones).toEqual([]);
 // Advance time beyond the 3-minute historical display TTL.
 const later=now+190000;
 state=advanceEngine18AnchoredObservations(state,packet(later-1000,[]),later);
 expect(state.zones).toEqual([]);
});

test("no-candidate legend describes sanitized backend eligibility without drawing made-up prices",()=>{
 expect(describeEngine18NoCandidate({diagnostics:{
  noCandidateReason:"INSUFFICIENT_COVERED_ELAPSED_TIME"}}))
  .toBe("Levels have not remained visible long enough");
 expect(describeEngine18NoCandidate({diagnostics:{
  noCandidateReason:"QUALIFIED_LEVELS_NOT_IN_CURRENT_BOOK"}}))
  .toBe("Past observations left the visible depth window");
 expect(describeEngine18NoCandidate({reason:"SOME_UNTRUSTED_HTML"}))
  .toBe("No currently qualified depth observations");
 expect(validateEngine18ChartZones({...sample,zones:[],reason:"NO_VALID_DEPTH"},now)).toEqual([]);
});
