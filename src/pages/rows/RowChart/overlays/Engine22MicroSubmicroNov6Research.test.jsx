import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const micro={version:"engine22.microW2Nov6Research.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{w1Low:7321.75,w1LowLocalTime:"2026-11-05 16:00 AZ",
 w1High:7469.75,w1HighLocalTime:"2026-11-06 07:50 AZ"},
 structuralReference:7321.75,
 levels:[[.236,7434.75],[.382,7413.25],[.5,7395.75],[.618,7378.25],
 [.786,7353.5],[.886,7338.5],[1,7321.75]].map(([ratio,price],i)=>({
 key:"r"+ratio,label:ratio.toFixed(3),price,status:i<3?"TOUCHED":"WATCH",
 touchEvidenceAvailable:i<3,touchEvidenceType:i<3?"ES_CURRENT_PRICE":null,
 touchEvidence:i<3?{verified:false,evidenceClass:"ES_SNAPSHOT_OBSERVATION"}:null
 }))};
const sub={version:"engine22.submicroNov6AbcResearch.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{aHigh:7469.75,aHighLocalTime:"2026-11-06 07:50 AZ",aLow:7396.75,
 aLowLocalTime:"2026-11-06 10:50 AZ",bHigh:7436.75,
 bHighLocalTime:"2026-11-06 12:30 AZ"},
 reviewReference:7436.75,
 levels:[[.618,7391.75],[1,7363.75],[1.272,7344],[1.618,7318.75],
 [2,7290.75],[2.618,7245.75]].map(([ratio,price])=>({
 key:"e"+ratio,label:ratio.toFixed(3),price,status:"WATCH",
 touchEvidenceAvailable:false,touchEvidenceType:null
 }))};
test("Micro W2 / Submicro ABC research cards reuse shared grid and risk display",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
 engine22Display={{version:"engine22Display.v1",degreeOrder:["submicro","micro"],degrees:{
 submicro:{label:"Submicro",headline:"OLD SUBMICRO",rows:[],levels:[]},
 micro:{label:"Micro",headline:"OLD MICRO",rows:[],levels:[]}
 }}}
 currentWavelength={{degrees:{submicro:{ownerSubmicroNov6AbcResearch:sub},
 micro:{ownerMicroW2Nov6Research:micro}}}}/>);
 expect(html).toContain("MICRO W2 RETRACEMENT FIB LEVELS");
 expect(html).toContain("SUBMICRO C DOWN — A-LENGTH FIB EXTENSIONS");
 expect(html).toContain("148.00 ES POINTS");
 expect(html).toContain("7434.75");
 expect(html).toContain("7321.75");
 expect(html).toContain("7391.75");
 expect(html).toContain("7245.75");
 expect(html).toContain("INVALIDATION ZONES");
 expect(html).toContain("7436.75");
 expect(html).toContain("RESEARCH CARD ONLY");
 expect(html).toContain("W3 UP — NOT STARTED");
 expect((html.match(/REACHED · ES SNAPSHOT/g)||[])).toHaveLength(3);
 expect((html.match(/>WATCH</g)||[])).toHaveLength(10);
 expect(html).not.toContain("TOUCHED · VERIFIED");
 expect(html).not.toContain("OLD MICRO");
 expect(html).not.toContain("OLD SUBMICRO");
});
