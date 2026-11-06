import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const levels=[[.618,7347.25],[1,7227],[1.272,7141.25],[1.618,7032.25],[2,6912],[2.618,6717.25]]
 .map(([ratio,price],i)=>({key:"e"+ratio,label:ratio.toFixed(3),price,
 status:i===0?"TOUCHED":"WATCH",touchEvidenceAvailable:i===0,
 touchEvidenceType:i===0?"OWNER_CHART_OBSERVATION":null,
 touchEvidence:i===0?{verified:false,evidenceClass:"OWNER_CHART_UNVERIFIED"}:null}));
const model={version:"engine22.subminuteNov5AbcResearch.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{aHigh:7735,aHighLocalTime:"2026-11-05 05:00 AZ",aLow:7420,
 aLowLocalTime:"2026-11-05 08:00 AZ",bHigh:7542,bHighLocalTime:"2026-11-05 08:20 AZ",
 observedLowReference:7322.25,observedLowLocalTime:"2026-11-05 16:00 AZ"},
 reviewReference:7542,levels};
test("Subminute C research card displays six backend levels, touches, standard risk",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
 engine22Display={{version:"engine22Display.v1",degreeOrder:["subminute"],
 degrees:{subminute:{label:"Subminute",headline:"OLD SUBMINUTE",rows:[],levels:[]}}}}
 currentWavelength={{degrees:{subminute:{ownerSubminuteNov5AbcResearch:model}}}}/>);
 expect(html).toContain("SUBMINUTE C DOWN — A-LENGTH FIB EXTENSIONS");
 for(const [,price] of [[.618,7347.25],[1,7227],[1.272,7141.25],[1.618,7032.25],[2,6912],[2.618,6717.25]])
 expect(html).toContain(price.toFixed(2));
 expect(html).toContain("7542.00");
 expect(html).toContain("INVALIDATION ZONES");
 expect(html).toContain("LIVE SUBMINUTE SELECTION UNCHANGED");
 expect((html.match(/TOUCHED · OWNER CHART/g)||[])).toHaveLength(1);
 expect((html.match(/>WATCH</g)||[])).toHaveLength(5);
 expect(html).not.toContain("TOUCHED · VERIFIED");
 expect(html).not.toContain("OLD SUBMINUTE");
});
