import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";

const levels=[[.618,7451.5],[1,7507],[1.272,7546.5],[1.618,7596.5],[2,7652],[2.618,7741.5]]
  .map(([ratio,price],i)=>({key:"e"+ratio,label:ratio.toFixed(3),price,
    status:i<2?"TOUCHED":"WATCH",touchEvidenceAvailable:i<2,
    touchEvidenceType:i<2?"ES_CURRENT_PRICE":null,
    touchEvidence:i<2?{verified:false,evidenceClass:"ES_SNAPSHOT_OBSERVATION"}:null}));
const w3={version:"engine22.submicroW3Nov9Research.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{w1Low:7324,w1LowLocalTime:"2026-11-05 15:20 AZ",
 w1High:7469,w1HighLocalTime:"2026-11-06 07:40 AZ",
 w2Low:7362,w2LowLocalTime:"2026-11-08 15:00 AZ",w1Length:145},
 structuralReference:7324,levels};
const old={version:"engine22.submicroNov6AbcResearch.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{aHigh:7469.75,aHighLocalTime:"2026-11-06 07:50 AZ",
 aLow:7396.75,aLowLocalTime:"2026-11-06 10:50 AZ",
 bHigh:7436.75,bHighLocalTime:"2026-11-06 12:30 AZ"},
 reviewReference:7436.75,levels:[{key:"e1000",label:"1.000",price:7363.75,status:"WATCH"}]};
test("Submicro card prioritizes exact owner W3 research above archived ABC without changing Micro",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
   engine22Display={{version:"engine22Display.v1",degreeOrder:["submicro"],degrees:{
     submicro:{label:"Submicro",headline:"OLD ENGINE STATE",rows:[],levels:[]}
   }}}
   currentWavelength={{degrees:{submicro:{
      ownerSubmicroW3Nov9Research:w3,
      ownerSubmicroNov6AbcResearch:old,
   }}}}/>);
 expect(html).toContain("SUBMICRO W1 UP");
 expect(html).toContain("W3 UP CANDIDATE");
 expect(html).toContain("SUBMICRO W3 UP — W2 LOW + W1 LENGTH FIB EXTENSIONS");
 expect(html).toContain("7324.00");
 expect(html).toContain("7469.00");
 expect(html).toContain("7362.00");
 expect(html).toContain("2026-11-05 15:20 AZ");
 expect(html).toContain("2026-11-06 07:40 AZ");
 expect(html).toContain("2026-11-08 15:00 AZ");
 expect(html).toContain("7451.50");
 expect(html).toContain("7507.00");
 expect(html).toContain("7546.50");
 expect(html).toContain("7596.50");
 expect(html).toContain("7652.00");
 expect(html).toContain("7741.50");
 expect(html).toContain("REACHED · ES SNAPSHOT");
 expect(html).toContain("NOT CONFIRMED");
 expect(html).not.toContain("SUBMICRO C DOWN — A-LENGTH FIB EXTENSIONS");
 expect(html).not.toContain("OLD ENGINE STATE");
 expect(html).not.toContain("TOUCHED · VERIFIED");
});
