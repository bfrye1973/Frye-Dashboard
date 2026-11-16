import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";

const mk=(label,price,status="WATCH")=>({key:"f"+label,label,price,status,
  provisional:true,touchEvidenceAvailable:status==="TOUCHED",
  touchEvidenceType:status==="TOUCHED"?"ES_CURRENT_PRICE":null});

const micro={
 version:"engine22.ownerMicroAbcDownNov16Research.v1",
 selectionStatus:"RESEARCH_ONLY",
 aLength:77.5,
 anchors:{aHigh:7614.75,aHighLocalTime:"2026-11-15 16:40 AZ",
  aLow:7537.25,aLowLocalTime:"2026-11-15 23:20 AZ",
  bHigh:7570.75,bHighLocalTime:"2026-11-16 01:40 AZ",cLow:null},
 levels:[mk("0.618",7522.75,"TOUCHED"),mk("1.000",7493.25),
  mk("1.272",7472.25),mk("1.618",7445.25),
  mk("2.000",7415.75),mk("2.618",7367.75)],
};
const minute={
 version:"engine22.minuteW1FormingNov9Research.v1",
 selectionStatus:"RESEARCH_ONLY",
 anchors:{w1StartReference:7322.25,
  w1StartReferenceLocalTime:"2026-11-05 16:00 AZ",
  w1EndingHigh:7671,w1EndingHighLocalTime:"2026-11-11 08:00 AZ"},
 levels:[mk("0.236",7588.75,"TOUCHED"),mk("0.382",7537.75),
  mk("0.500",7496.75),mk("0.618",7455.5),
  mk("0.786",7397),mk("1.000",7322.25)],
};
test("Micro current ABC card uses exact owner A/B and green for reached Fib levels",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
  engine22Display={{version:"engine22Display.v1",degreeOrder:["micro"],
    degrees:{micro:{label:"Micro",rows:[],levels:[]}}}}
  currentWavelength={{degrees:{micro:{ownerMicroAbcDownNov16Research:micro}}}}/>);
 for(const text of ["MICRO A DOWN","C DOWN DEVELOPING","7614.75","2026-11-15 16:40 AZ",
  "7537.25","2026-11-15 23:20 AZ","7570.75","2026-11-16 01:40 AZ",
  "7522.75","7493.25","7472.25","7445.25","7415.75","7367.75",
  "REACHED · ES SNAPSHOT","WATCH","ENDING LOW NOT CONFIRMED"])
  expect(html).toContain(text);
 expect(html).toContain("#86efac");
 expect(html).not.toContain("MICRO W4 COMPLETE → W5 UP DEVELOPING");
});
test("Minute W2 WATCH becomes green with Engine22 source touch evidence",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
  engine22Display={{version:"engine22Display.v1",degreeOrder:["minute"],
    degrees:{minute:{label:"Minute",rows:[],levels:[]}}}}
  currentWavelength={{degrees:{minute:{ownerMinuteW1FormingNov9Research:minute}}}}/>);
 for(const text of ["MINUTE W1 OWNER-MARKED COMPLETE","W2 DOWN DEVELOPING",
   "7671.00","7588.75","7537.75","7455.50","REACHED · ES SNAPSHOT",
   "WATCH","AMBER WATCH","GREEN WHEN ES REACHES W2 LEVEL"])
   expect(html).toContain(text);
 expect(html).toContain("#86efac");
});
