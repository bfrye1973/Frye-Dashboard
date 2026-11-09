import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const make=(degree)=>({
 version:"engine22."+degree+"W1FormingNov9Research.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{w1StartReference:7322.25,w1StartReferenceLocalTime:"2026-11-05 16:00 AZ"},
 levels:[],reviewReference:7322.25
});
const model={degrees:{
 minute:{
  ownerMinuteW1FormingNov9Research:make("minute"),
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
test("Minute card prioritizes W1 UP forming over previous C DOWN and shows no fictitious fib ladder",()=>{
 const html=render("minute");
 expect(html).toContain("MINUTE W1 UP — FORMING");
 expect(html).toContain("MINOR W3 UP");
 expect(html).toContain("7322.25");
 expect(html).toContain("2026-11-05 16:00 AZ");
 expect(html).toContain("SUBMINUTE W1");
 expect(html).toContain("NOT CONFIRMED");
 expect(html).toContain("PENDING W1 AND W2 ANCHORS");
 expect(html).toContain("ENGINE 27 / CANONICAL COUNT UNCHANGED");
 expect(html).not.toContain("MINUTE A-B-C DOWN — C DEVELOPING");
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
 expect(html).toContain("FIB EXTENSIONS — PENDING W1 AND W2 ANCHORS");
 expect(html).not.toContain("SUBMINUTE A-B-C DOWN — C DEVELOPING");
 expect(html).not.toContain("SUBMINUTE C DOWN — A-LENGTH FIB EXTENSIONS");
});
