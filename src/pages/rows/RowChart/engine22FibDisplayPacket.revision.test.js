import {normalizeEngine22FibPacket} from "./engine22FibDisplayPacket";

const makeLevels=(values,type)=>values.map(([ratio,price])=>({
 label:ratio.toFixed(3),ratio,price,status:"WATCH",provisional:true,levelType:type
}));
const priorW4=[[.236,7543.75],[.382,7509],[.5,7481],[.618,7453],[.786,7413],[1,7362]];
const currentW5=[[.618,7581.75],[1,7637.25],[1.272,7676.75],[1.618,7726.75],[2,7782.25],[2.618,7871.75]];
const priorC=[[.618,7508.75],[1,7473.25],[1.272,7448],[1.618,7416],[2,7380.5],[2.618,7323.25]];
const currentW2=[[.236,7544],[.382,7534],[.5,7526.25],[.618,7518.25],[.786,7506.75],[1,7492.25]];
function packet(){
 return {
  authorizedWorkingStructure:{
   schema:"engine22.authorizedWorkingStructure.v1",mode:"READ_ONLY",noExecution:true,
   publicationRevision:6,degrees:{
    micro:{available:true,activeWave:"C",levels:[{label:"old",price:7000}]},
    submicro:{available:true,activeWave:"C",levels:[{label:"old",price:7001}]},
    minor:{available:true,activeWave:"W5",levels:[{label:"1.000",price:7900}]},
   }
  },
  degreeStates:{minor:{activeWave:"W5"}},
  currentWavelength:{degrees:{
   micro:{ownerMicroW3Nov9ReclassifiedResearch:{
    version:"engine22.ownerMicroW3Nov9ReclassifiedResearch.v1",
    degree:"micro",selectionStatus:"RESEARCH_ONLY",activeWave:"W5",direction:"UP",
    w4RetracementLevels:makeLevels(priorW4,"MICRO_W4_DOWN_RETRACEMENT_RESEARCH"),
    w5UpExtensionLevels:makeLevels(currentW5,"MICRO_W5_UP_EXTENSION_RESEARCH")
   }},
   submicro:{ownerSubmicroW3Nov9InternalResearch:{
    version:"engine22.ownerSubmicroW3Nov9InternalResearch.v1",
    degree:"submicro",selectionStatus:"RESEARCH_ONLY",activeWave:"W2",direction:"DOWN",
    cDownExtensionLevels:makeLevels(priorC,"SUBMICRO_C_DOWN_EXTENSION_RESEARCH"),
    w2DownRetracementLevels:makeLevels(currentW2,"SUBMICRO_W2_DOWN_RETRACEMENT_RESEARCH")
   }}
  }}
 };
}
test("current Strategy wave W5/W2 replaces previously published W4/C Fib levels",()=>{
 const result=normalizeEngine22FibPacket(packet());
 expect(result.degrees.micro.activeWave).toBe("W5");
 expect(result.degrees.submicro.activeWave).toBe("W2");
 expect(result.degrees.micro.levels.map(l=>l.price)).toEqual(currentW5.map(l=>l[1]));
 expect(result.degrees.submicro.levels.map(l=>l.price)).toEqual(currentW2.map(l=>l[1]));
 expect(result.degrees.micro.levels.some(l=>l.price===7543.75)).toBe(false);
 expect(result.degrees.submicro.levels.some(l=>l.price===7508.75)).toBe(false);
 expect(result.degrees.minor.levels[0].price).toBe(7900);
});
test("later Engine22 revision updates Fib price without any calculation in Engine2",()=>{
 const p=packet();
 p.currentWavelength.degrees.submicro.ownerSubmicroW3Nov9InternalResearch.w2DownRetracementLevels[0].price=7544.25;
 expect(normalizeEngine22FibPacket(p).degrees.submicro.levels[0].price).toBe(7544.25);
});
test("missing, unsupported or malformed current Strategy wave fails closed, never falls back to old levels",()=>{
 const p=packet();
 p.currentWavelength.degrees.micro.ownerMicroW3Nov9ReclassifiedResearch.activeWave="W6";
 expect(normalizeEngine22FibPacket(p).degrees.micro.levels).toEqual([]);
 p.currentWavelength.degrees.micro.ownerMicroW3Nov9ReclassifiedResearch.activeWave="W5";
 p.currentWavelength.degrees.micro.ownerMicroW3Nov9ReclassifiedResearch.w5UpExtensionLevels[0].price=7581.8;
 expect(normalizeEngine22FibPacket(p).degrees.micro.levels).toEqual([]);
 delete p.currentWavelength.degrees.micro.ownerMicroW3Nov9ReclassifiedResearch;
 expect(normalizeEngine22FibPacket(p).degrees.micro.levels).toEqual([]);
});
test("canonical degree skips stale Fib model when activeWave disagrees with Strategies",()=>{
 const p=packet();
 p.degreeStates.minor.activeWave="W3";
 expect(normalizeEngine22FibPacket(p).degrees.minor.levels).toEqual([]);
});
