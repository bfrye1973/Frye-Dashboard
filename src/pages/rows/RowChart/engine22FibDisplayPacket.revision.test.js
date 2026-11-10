import {normalizeEngine22FibPacket} from "./engine22FibDisplayPacket";

const makeModel=(degree,levels)=>degree==="micro"?{
 version:"engine22.ownerMicroW3Nov9ReclassifiedResearch.v1",degree,selectionStatus:"RESEARCH_ONLY",
 anchors:{w2Low:7362,w3High:7600},w4RetracementLevels:levels.map(([ratio,price])=>({
 label:ratio.toFixed(3),ratio,price,status:"WATCH",provisional:true,
 levelType:"MICRO_W4_DOWN_RETRACEMENT_RESEARCH"
 }))
}:{
 version:"engine22.ownerSubmicroW3Nov9InternalResearch.v1",degree,selectionStatus:"RESEARCH_ONLY",
 anchors:{aHigh:7600,aLow:7507.25,bHigh:7566},cDownExtensionLevels:levels.map(([ratio,price])=>({
 label:ratio.toFixed(3),ratio,price,status:"WATCH",provisional:true,
 levelType:"SUBMICRO_C_DOWN_EXTENSION_RESEARCH"
 }))
};
const micro=[[.236,7543.75],[.382,7509],[.5,7481],[.618,7453],[.786,7413],[1,7362]];
const submicro=[[.618,7508.75],[1,7473.25],[1.272,7448],[1.618,7416],[2,7380.5],[2.618,7323.25]];
function packet(){
 return {
  authorizedWorkingStructure:{schema:"engine22.authorizedWorkingStructure.v1",mode:"READ_ONLY",noExecution:true,
   publicationRevision:6,degrees:{
    micro:{available:true,levels:[{label:"old",price:7000}]},
    submicro:{available:true,levels:[{label:"old",price:7001}]}
   }},
  currentWavelength:{degrees:{
   micro:{ownerMicroW3Nov9ReclassifiedResearch:makeModel("micro",micro)},
   submicro:{ownerSubmicroW3Nov9InternalResearch:makeModel("submicro",submicro)}
  }}
 };
}
test("Micro W4 and Submicro C watch Fibs use the current Engine22 research publication",()=>{
 const result=normalizeEngine22FibPacket(packet());
 expect(result.degrees.micro.levels.map(l=>l.price)).toEqual(micro.map(l=>l[1]));
 expect(result.degrees.submicro.levels.map(l=>l.price)).toEqual(submicro.map(l=>l[1]));
 expect(result.degrees.micro.levels.every(l=>l.status==="WATCH")).toBe(true);
 expect(result.degrees.submicro.levels.every(l=>l.status==="WATCH")).toBe(true);
});
test("later owner-revised Fib price appears without hardcoded chart projection",()=>{
 const p=packet();
 p.currentWavelength.degrees.submicro.ownerSubmicroW3Nov9InternalResearch.cDownExtensionLevels[0].price=7508.5;
 const result=normalizeEngine22FibPacket(p);
 expect(result.degrees.submicro.levels[0].price).toBe(7508.5);
});
test("invalid research model does not replace canonical authorized Fib",()=>{
 const p=packet();
 p.currentWavelength.degrees.submicro.ownerSubmicroW3Nov9InternalResearch.cDownExtensionLevels[0].status="CONFIRMED";
 const result=normalizeEngine22FibPacket(p);
 expect(result.degrees.submicro.levels).toEqual([{ratio:"old",price:7001,status:null}]);
});
