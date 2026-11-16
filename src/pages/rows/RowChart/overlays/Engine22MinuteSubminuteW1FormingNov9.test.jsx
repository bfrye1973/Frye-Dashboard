import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const make=(degree)=>({
 version:"engine22."+degree+"W1FormingNov9Research.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{w1StartReference:7322.25,w1StartReferenceLocalTime:"2026-11-05 16:00 AZ"},
 levels:[],reviewReference:7322.25
});
const minute=make("minute");
Object.assign(minute.anchors,{w1EndingHigh:7671,w1EndingHighLocalTime:"2026-11-11 08:00 AZ"});
minute.levels=[["0.236",7588.75],["0.382",7537.75],["0.500",7496.75],
 ["0.618",7455.5],["0.786",7397],["1.000",7322.25]].map(([label,price])=>({label,price,status:"WATCH",provisional:true}));
const model={degrees:{
 minute:{
  ownerMinuteW1FormingNov9Research:minute,
  ownerMinuteAbcResearch:{version:"engine22.minuteAbcDownNov5Research.v1",selectionStatus:"RESEARCH_ONLY",
   anchors:{aHigh:7901.75,aLow:7575.25,bHigh:7890.25,cObservedCandidateLow:7322.25},
   levels:[],reviewReference:7890.25}
 },
 subminute:{
  ownerSubminuteW1FormingNov9Research:make("subminute"),
  ownerSubminuteNov5AbcResearch:{version:"engine22.subminuteNov5AbcResearch.v1",selectionStatus:"RESEARCH_ONLY",
   anchors:{aHigh:7735,aLow:7420,bHigh:7542,observedLowReference:7322.25},
   levels:[],reviewReference:7542}
 }
}};
const render=(degree)=>renderToStaticMarkup(<Engine22MarketStructureCard
 engine22Display={{version:"engine22Display.v1",degreeOrder:[degree],degrees:{
 [degree]:{label:degree,headline:"OLDER DOWN WORKING DISPLAY",rows:[],levels:[]}
 }}} currentWavelength={model}/>);
test("Minute Strategy card prioritizes owner-marked W1 high and provisional W2 downward retracements",()=>{
 const html=render("minute");
 expect(html).toContain("MINUTE W1 OWNER-MARKED COMPLETE");
 expect(html).toContain("W2 DOWN DEVELOPING");
 expect(html).toContain("7671.00");
 expect(html).toContain("2026-11-11 08:00 AZ");
 expect(html).toContain("7322.25");
 expect(html).toContain("PROPOSED SHARED PARENT");
 expect(html).toContain("PROVISIONAL START");
 for(const price of ["7588.75","7537.75","7496.75","7455.50","7397.00","7322.25"])
   expect(html).toContain(price);
 expect(html).toContain("ENGINE 27 / CANONICAL COUNT UNCHANGED");
 expect(html).not.toContain("MINUTE C DOWN — A-LENGTH FIB EXTENSIONS");
});
test("Subminute card prioritizes W1 UP forming and Micro children without false confirmation",()=>{
 const html=render("subminute");
 expect(html).toContain("SUBMINUTE W1 UP — FORMING");
 expect(html).toContain("MINUTE W1 UP");
 expect(html).toContain("MICRO W1");
 expect(html).toContain("7322.25");
 expect(html).toContain("2026-11-05 16:00 AZ");
 expect(html).toContain("15:20 AZ PRECEDES PARENT 16:00 AZ");
 expect(html).toContain("PENDING W1 END AND W2 LOW");
 expect(html).not.toContain("SUBMINUTE A-B-C DOWN — C DEVELOPING");
 expect(html).not.toContain("SUBMINUTE C DOWN — A-LENGTH FIB EXTENSIONS");
});
