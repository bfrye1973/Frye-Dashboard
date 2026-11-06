import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";

const minorModel={
  version:"engine22.minorW2ResearchCardNov5.v1",
  selectionStatus:"RESEARCH_ONLY",degree:"minor",activeWave:"W2",direction:"DOWN",
  anchors:{
    w1Low:6485,w1LowLocalTime:"2026-04-30 17:00 AZ",
    w1High:7901.75,w1HighLocalTime:"2026-08-14 03:00 AZ",
    w2Start:7901.75,w2StartLocalTime:"2026-08-14 03:00 AZ",
    w2ObservedCandidateLow:7325,w2CandidateLocalTime:null,
  },
  reviewReference:6485,
  levels:[[0.236,7567.5],[0.382,7360.5],[0.5,7193.5],
    [0.618,7026.25],[0.786,6788.25],[0.886,6646.5],[1,6485]].map(([ratio,price])=>({
      key:"r"+ratio,label:ratio.toFixed(3),price,status:"WATCH",
      touchEvidenceAvailable:false,touchEvidenceType:null
    }))
};
test("Minor W2 research card shows authoritative backend retracements and standard risk",()=>{
  const html=renderToStaticMarkup(<Engine22MarketStructureCard
    engine22Display={{version:"engine22Display.v1",degreeOrder:["minor"],degrees:{
      minor:{label:"Minor",badge:"W5",headline:"MINOR W5 UP",rows:[],levels:[]}
    }}}
    currentWavelength={{degrees:{minor:{
      ownerMinorW2Research:minorModel,
      ownerW5StructuralReference:{version:"engine22.minorW5StructuralReference.v1",price:7398},
      state:"MINOR_W5_ACTIVE_CANDIDATE",levels:[],
    }}}}
  />);
  expect(html).toContain("MINOR W2 RETRACEMENT FIB LEVELS");
  expect(html).toContain("7567.50");
  expect(html).toContain("7360.50");
  expect(html).toContain("7193.50");
  expect(html).toContain("6485.00");
  expect(html).toContain("RESEARCH CARD ONLY");
  expect(html).toContain("W3 UP — NOT STARTED");
  expect(html).toContain("INVALIDATION ZONES");
  expect(html).toContain("WATCH");
  expect(html).not.toContain("MINOR W5 UP");
  expect(html).not.toContain("TOUCHED · VERIFIED");
});
