import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const research={
 version:"engine22.minorW3Nov9Research.v1",selectionStatus:"RESEARCH_ONLY",
 anchors:{
  w1Low:6485,w1LowLocalTime:"2026-04-30 17:00 AZ",
  w1High:7901.75,w1HighLocalTime:"2026-08-14 03:00 AZ",w1Length:1416.75,
  w2EndingLow:7305.25,w2EndingLocalTime:null,
  priorW2Ending:{price:7322.25,localTime:"2026-11-05 16:00 AZ"}
 },
 firstInternalWaveResistance:[7446,7533,7603.5,7674,7774,7901.75],
 firstInternalWaveResistance:[[.236,7446],[.382,7533],[.5,7603.5],[.618,7674],[.786,7774],[1,7901.75]]
  .map(([ratio,price])=>({key:"r"+ratio,label:ratio.toFixed(3),price,status:"WATCH",touchEvidenceAvailable:false})),
 structuralReference:7305.25,
 levels:[[.618,8180.75],[1,8722],[1.272,9107.25],[1.618,9597.5],[2,10138.75],[2.618,11014.25]]
  .map(([ratio,price])=>({key:"e"+ratio,label:ratio.toFixed(3),price,status:"WATCH"}))
};
test("Revised Minor W2 owner price launches research W3 while first smaller W1 remains unconfirmed",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
  engine22Display={{version:"engine22Display.v1",degreeOrder:["minor"],degrees:{
    minor:{label:"Minor",headline:"OLD MINOR",rows:[],levels:[]}
  }}} currentWavelength={{degrees:{minor:{ownerMinorW3Nov9Research:research}}}}/>);
 for(const value of ["MINOR W2 REVISED LOWER END PRICE","W3 UP DEVELOPING",
   "7305.25","TIME PENDING","7322.25","2026-11-05 16:00 AZ",
   "FIRST", "7446.00","7533.00","7603.50","7674.00",
   "8180.75","8722.00","9107.25","9597.50","11014.25",
   "OLDER MINOR W5 AND W2 RETRACEMENT HISTORY PRESERVED"])
   expect(html.toUpperCase()).toContain(value.toUpperCase());
 expect(html).toContain("FIRST SMALLER W1 UP — PROVISIONAL RESISTANCE (NOT W1 END)");
 expect(html).toContain("MINOR W3 UP — W2 LOW + MINOR W1 LENGTH EXTENSIONS");
 for(const price of ["7446.00","7533.00","7603.50","7674.00","7774.00","7901.75"])
   expect(html).toContain(price);
 expect(html).toContain("0.236");
 expect(html).toContain("0.618");
 expect(html).toContain("ENDING HIGH NOT SUPPLIED");
 expect(html).not.toContain("8197.75");
 expect(html).not.toContain("W2 DOWN — DEVELOPING / NOT CONFIRMED");
});
