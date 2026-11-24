import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";

const roadmap={
 schema:"engine22.ownerWaveRoadmap.v1",noExecution:true,
 primary:{w1:{length:2366},priorW3High:{price:7885},
   ownerMarkedW4Low:{price:6899},
   levels:[8361.25,9265,9908.5,10727.25,11631,13093.25].map((price,i)=>({price,ratio:[.618,1,1.272,1.618,2,2.618][i],label:[.618,1,1.272,1.618,2,2.618][i].toFixed(3),status:"WATCH"}))},
 intermediate:{originLowCandidate:{price:6899},
   levels:[7131.75,7275.75,7392,7508.25,7674,7885].map((price,i)=>({price,ratio:[.236,.382,.5,.618,.786,1][i],label:[.236,.382,.5,.618,.786,1][i].toFixed(3),status:"WATCH"}))},
 micro:{observedReferenceHigh:{price:7313.25}}
};
test("Primary, Intermediate, Micro cards show new research instead of stale wave counts",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard engine22Display={{
  version:"engine22Display.v1",degreeOrder:["primary","intermediate","micro"],
  degrees:{
   primary:{label:"Primary",headline:"OLD PRIMARY",levels:[],rows:[]},
   intermediate:{label:"Intermediate",headline:"OLD INTERMEDIATE",levels:[],rows:[]},
   micro:{label:"Micro",headline:"OLD MICRO C DOWN",levels:[],rows:[]},
  }
 }} currentWavelength={{ownerWaveRoadmap:roadmap,degrees:{}}}/>);
 for(const text of ["PRIMARY W4 COMPLETE","W5 UP PROPOSED",
  "INTERMEDIATE W1 UP DEVELOPING","MICRO W1 UP CANDIDATE",
  "6899.00","7885.00","8361.25","9265.00","9908.50","10727.25",
  "11631.00","13093.25","7131.75","7275.75","7392.00",
  "7508.25","7674.00","7313.25","NO ENGINE6 EXECUTION",
  "W2 Fib"]) expect(html.toUpperCase()).toContain(text.toUpperCase());
 expect(html).not.toContain("OLD MICRO C DOWN");
 expect(html).not.toContain("OLD PRIMARY");
});
