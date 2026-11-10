import {validateEngine18ChartZones} from "./Engine18LiquidityZonesOverlay";
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
