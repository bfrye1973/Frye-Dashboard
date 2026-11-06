import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const ratios=[[.618,7688.5],[1,7563.75],[1.272,7475],[1.618,7362],[2,7237.25],[2.618,7035.5]];
const minute={
 version:"engine22.minuteAbcDownNov5Research.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{
 aHigh:7901.75,aHighLocalTime:"2026-08-14 07:00 AZ",
 aLow:7575.25,aLowLocalTime:"2026-09-16 11:00 AZ",
 bHigh:7890.25,bHighLocalTime:"2026-10-11 22:00 AZ",
 cObservedCandidateLow:7322.25,cCandidateLocalTime:"2026-11-05 16:00 AZ"
 },reviewReference:7890.25,
 levels:ratios.map(([ratio,price],i)=>({
   key:"e"+ratio,label:ratio.toFixed(3),price,
   status:i<4?"TOUCHED":"WATCH",touchEvidenceAvailable:i<4,
   touchEvidenceType:i<4?"OWNER_CHART_OBSERVATION":null,
   touchEvidence:i<4?{verified:false,evidenceClass:"OWNER_CHART_UNVERIFIED"}:null
 }))
};
const render=()=>renderToStaticMarkup(<Engine22MarketStructureCard
 engine22Display={{version:"engine22Display.v1",degreeOrder:["minute"],degrees:{
   minute:{label:"Minute",badge:"W2 DOWN",headline:"LEGACY MINUTE W2",rows:[],levels:[]}
 }}}
 currentWavelength={{degrees:{minute:{
   ownerMinuteAbcResearch:minute,
   ownerMinuteW2Retracement:{version:"engine22.minuteW2RetracementOwner.v1",structuralReference:7419.5,anchors:{w1Low:7419.5,w1High:7908.75},levels:[]},
 }}}}
/>);
test("Minute major ABC card uses the shared layout and correct extension prices",()=>{
 const html=render();
 expect(html).toContain("MINUTE C DOWN — A-LENGTH FIB EXTENSIONS");
 for(const [,price] of ratios) expect(html).toContain(price.toFixed(2));
 expect(html).toContain("7890.25");
 expect(html).toContain("2026-10-11 22:00 AZ");
 expect(html).toContain("C DOWN — DEVELOPING");
 expect(html).toContain("LIVE MINUTE SELECTION UNCHANGED");
 expect(html).toContain("INVALIDATION ZONES");
 expect(html).not.toContain("LEGACY MINUTE W2");
});
test("four owner-chart touched levels, two WATCH, no fabricated verification",()=>{
 const html=render();
 expect((html.match(/TOUCHED · OWNER CHART/g)||[])).toHaveLength(4);
 expect((html.match(/>WATCH</g)||[])).toHaveLength(2);
 expect(html).not.toContain("TOUCHED · VERIFIED");
 expect(html).not.toContain("TOUCHED · ES PRICE");
 expect(html).not.toContain("MINUTE W2 RETRACEMENT FIB LEVELS");
});
