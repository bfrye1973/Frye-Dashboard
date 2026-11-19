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
  ownerSubminuteAbcDownNov16Research:{
   version:"engine22.ownerSubminuteAbcDownNov16Research.v1",
   selectionStatus:"RESEARCH_ONLY",
   anchors:{aHigh:7675.75,aHighLocalTime:"2026-11-12 09:00 AZ",
     aLow:7516,aLowLocalTime:"2026-11-13 08:00 AZ",
     bHigh:7614,bHighLocalTime:"2026-11-15 16:30 AZ"},
   aLength:159.75,
   levels:[["0.618",7515.25],["1.000",7454.25],["1.272",7410.75],
     ["1.618",7355.50],["2.000",7294.50],["2.618",7195.75]]
      .map(([label,price])=>({key:"e"+label,label,price,status:"WATCH",
        provisional:true,touchEvidenceAvailable:false})),
  },
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
test("current owner Subminute ABC card supersedes older forming W1 research only on presentation",()=>{
 const html=render("subminute");
 expect(html).toContain("SUBMINUTE A DOWN");
 expect(html).toContain("C DOWN DEVELOPING");
 expect(html).toContain("7675.75");
 expect(html).toContain("2026-11-12 09:00 AZ");
 expect(html).toContain("7516.00");
 expect(html).toContain("2026-11-13 08:00 AZ");
 expect(html).toContain("7614.00");
 expect(html).toContain("2026-11-15 16:30 AZ");
 for(const price of ["7515.25","7454.25","7410.75","7355.50","7294.50","7195.75"])
  expect(html).toContain(price);
 expect(html).toContain("ENDING LOW UNCONFIRMED");
 expect(html).toContain("CANONICAL COUNT / ENGINE 27 UNCHANGED");
 expect(html).not.toContain("SUBMINUTE W1 UP — FORMING");
});
