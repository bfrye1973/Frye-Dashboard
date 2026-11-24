import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";

const base={version:"engine22Display.v1",degreeOrder:["micro","submicro"],
  degrees:{micro:{label:"Micro",headline:"OLD MICRO C DOWN",rows:[],levels:[]},
    submicro:{label:"Submicro",headline:"OLD SUBMICRO W2 DOWN",rows:[],levels:[]}}};
const context={
 schema:"engine22.ownerNov23ResearchContext.v1",noExecution:true,pointInTimeAsOfAvailable:false,
 observedOn:"2026-11-23",micro:{referenceHigh:{price:7313.25}},
 consolidation:{priceAtScreenshot:7272.25,observedBand:[7250,7300]}
};
test("current owner research renders Micro UP candidate and Submicro unresolved without fictional Fibs",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
  engine22Display={base} currentWavelength={{degrees:{},ownerResearchContext:context}}/>);
 for(const phrase of ["MICRO W1 UP CANDIDATE","SUBMICRO CONSOLIDATION",
  "DIRECTION UNRESOLVED","7,272.25","7313.25","7240","W2 DOWN",
  "RESEARCH ONLY","NO NEW W2 FIBS","NOT LIVE"])
   expect(html.toUpperCase()).toContain(phrase.toUpperCase());
 expect(html).toContain('data-testid="engine22-nov23-consolidation-context"');
 expect(html).not.toContain("OLD MICRO C DOWN");
 expect(html).not.toContain("OLD SUBMICRO W2 DOWN");
});
test("missing or stale research does not fabricate current wave context",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
  engine22Display={base} currentWavelength={{degrees:{},ownerResearchContext:null}}/>);
 expect(html).not.toContain('data-testid="engine22-nov23-consolidation-context"');
 expect(html).toContain("OLD MICRO C DOWN");
 expect(html).toContain("OLD SUBMICRO W2 DOWN");
});
