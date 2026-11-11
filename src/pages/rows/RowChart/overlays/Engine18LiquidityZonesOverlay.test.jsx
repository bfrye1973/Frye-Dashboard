import {validateEngine18ChartZones,selectEngine18TestZones} from "./Engine18LiquidityZonesOverlay";
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
 expect(zones).toHaveLength(3);
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

test("chart always limits each side to three and orders by displayed contracts",()=>{
 const zones=[
 {side:"ASK",price:7561,visibleContracts:12,observedInImages:10},
 {side:"ASK",price:7562,visibleContracts:50,observedInImages:5},
 {side:"ASK",price:7563,visibleContracts:30,observedInImages:9},
 {side:"BID",price:7549,visibleContracts:45,observedInImages:3},
 {side:"BID",price:7548,visibleContracts:20,observedInImages:9},
 {side:"BID",price:7547,visibleContracts:80,observedInImages:8}
 ];
 const selected=selectEngine18TestZones(zones);
 expect(selected).toHaveLength(6);
 expect(selected.filter(z=>z.side==="ASK").map(z=>z.visibleContracts)).toEqual([50,30,12]);
 expect(selected.filter(z=>z.side==="BID").map(z=>z.visibleContracts)).toEqual([80,45,20]);
 expect(selectEngine18TestZones(zones.filter(z=>z.side==="BID"))).toHaveLength(2);
});
