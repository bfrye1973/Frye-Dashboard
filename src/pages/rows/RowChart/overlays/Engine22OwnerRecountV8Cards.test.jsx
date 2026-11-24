import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const status=(degree,activeWave,direction,stage,extra={})=>({
 version:"engine22.ownerRecountNov23.v8."+degree,degree,activeWave,direction,stage,noExecution:true,...extra
});
const recount={
 minor:status("minor","RECOUNT","NEUTRAL","CURRENT_COUNT_CLEARED_RECOUNT_PENDING"),
 minute:status("minute","RECOUNT","NEUTRAL","CURRENT_COUNT_CLEARED_RECOUNT_PENDING"),
 subminute:status("subminute","RECOUNT","NEUTRAL","CURRENT_COUNT_CLEARED_RECOUNT_PENDING"),
 micro:status("micro","W1","UP","W1_UP_CANDIDATE_UNCONFIRMED",{candidateHigh:{price:7313.25}}),
 submicro:status("submicro","UNRESOLVED","NEUTRAL","CONSOLIDATION_UNRESOLVED")
};
const degrees=Object.fromEntries(["minor","minute","subminute","micro","submicro"].map(d=>[
 d,{label:d,headline:"OUTDATED_"+d.toUpperCase()+"_HISTORICAL_COUNT",rows:[],levels:[{key:"old",price:7800,status:"TOUCHED"}]}]));
test("owner V8 replaces five lower CURRENT cards with accurate no-entry research, not archived old fibs",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
   engine22Display={{version:"engine22Display.v1",degreeOrder:Object.keys(degrees),degrees}}
   currentWavelength={{ownerRecountV8:recount,degrees:{}}}/>);
 for(const phrase of ["MINOR — RECOUNT PENDING","MINUTE — RECOUNT PENDING",
   "SUBMINUTE — RECOUNT PENDING","MICRO W1 UP — CANDIDATE",
   "SUBMICRO CONSOLIDATION","7313.25","DIRECTION UNRESOLVED",
   "ENGINE6","NO ENTRY","HISTORY"])
   expect(html.toUpperCase()).toContain(phrase.toUpperCase());
 for(const d of Object.keys(degrees))
   expect(html).not.toContain("OUTDATED_"+d.toUpperCase()+"_HISTORICAL_COUNT");
 expect(html).not.toContain("7800.00");
});
test("without owner V8, historical display state is not retroactively replaced",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
   engine22Display={{version:"engine22Display.v1",degreeOrder:["micro"],degrees:{micro:degrees.micro}}}
   currentWavelength={{degrees:{}}}/>);
 expect(html).toContain("OUTDATED_MICRO_HISTORICAL_COUNT");
});
