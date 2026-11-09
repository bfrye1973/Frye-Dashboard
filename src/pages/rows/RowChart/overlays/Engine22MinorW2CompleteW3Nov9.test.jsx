import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const research={
 version:"engine22.minorW3Nov9Research.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{
 w1Low:6485,w1LowLocalTime:"2026-04-30 17:00 AZ",
 w1High:7901.75,w1HighLocalTime:"2026-08-14 03:00 AZ",w1Length:1416.75,
 w2EndingLow:7322.25,w2EndingLocalTime:"2026-11-05 16:00 AZ"
 },structuralReference:7322.25,
 levels:[[.618,8197.75],[1,8739],[1.272,9124.25],[1.618,9614.5],[2,10155.75],[2.618,11031.25]]
 .map(([ratio,price])=>({key:"e"+ratio,label:ratio.toFixed(3),price,status:"WATCH"}))
};
test("Minor W2 owner complete and W3 developing card replaces older W2-down research display",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
 engine22Display={{version:"engine22Display.v1",degreeOrder:["minor"],degrees:{
 minor:{label:"Minor",headline:"OLD MINOR",rows:[],levels:[]}
 }}}
 currentWavelength={{degrees:{minor:{ownerMinorW3Nov9Research:research}}}}/>);
 expect(html).toContain("MINOR W2 COMPLETE");
 expect(html).toContain("W3 UP DEVELOPING");
 expect(html).toContain("7322.25");
 expect(html).toContain("2026-11-05 16:00 AZ");
 expect(html).toContain("MINOR W3 UP — W2 LOW + W1 LENGTH FIB EXTENSIONS");
 expect(html).toContain("8197.75");
 expect(html).toContain("8739.00");
 expect(html).toContain("9614.50");
 expect(html).toContain("11031.25");
 expect(html).toContain("OLDER MINOR W5 AND W2 RETRACEMENT HISTORY PRESERVED");
 expect(html).not.toContain("OLD MINOR");
 expect(html).not.toContain("W2 DOWN — DEVELOPING / NOT CONFIRMED");
});
