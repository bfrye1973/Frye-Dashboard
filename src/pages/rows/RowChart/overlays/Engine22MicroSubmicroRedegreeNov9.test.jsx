import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import Engine22MarketStructureCard from "./Engine22MarketStructureCard";
const make=(version,low,lowTime,high,highTime,w2,w2Time,fibs)=>({
 version,selectionStatus:"RESEARCH_ONLY",
 anchors:{w1Low:low,w1LowLocalTime:lowTime,w1High:high,
  w1HighLocalTime:highTime,w2Low:w2,w2LowLocalTime:w2Time,w1Length:high-low},
 structuralReference:w2,levels:fibs.map(([ratio,price])=>({
  key:"e"+ratio,label:ratio.toFixed(3),price,status:"WATCH",
  touchEvidenceAvailable:false
 }))
});
const micro=make("engine22.ownerMicroW3Nov9ReclassifiedResearch.v1",
 7324,"2026-11-05 15:20 AZ",7469,"2026-11-06 07:40 AZ",
 7362,"2026-11-08 15:00 AZ",
 [[.618,7451.5],[1,7507],[1.272,7546.5],[1.618,7596.5],[2,7652],[2.618,7741.5]]);
micro.anchors.w3High=7600;
micro.anchors.w3HighLocalTime="2026-11-09 13:00 AZ";
const submicro=make("engine22.ownerSubmicroW3Nov9InternalResearch.v1",
 7390.25,"2026-11-09 01:00 AZ",7476,"2026-11-09 06:00 AZ",
 7449.25,"2026-11-09 06:20 AZ",
 [[.618,7502.25],[1,7535],[1.272,7558.25],[1.618,7588],[2,7620.75],[2.618,7673.75]]);
Object.assign(submicro.anchors,{aHigh:7600,aHighLocalTime:"2026-11-09 13:00 AZ",aLow:7507.25,aLowLocalTime:"2026-11-10 06:40 AZ",bHigh:7566,bHighLocalTime:"2026-11-10 08:00 AZ"});
test("Micro card keeps W1/W2 history and shows owner-marked W3 high",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
  engine22Display={{version:"engine22Display.v1",degreeOrder:["micro"],degrees:{
   micro:{label:"Micro",headline:"OLDER MICRO",rows:[],levels:[]}}}}
  currentWavelength={{degrees:{micro:{ownerMicroW3Nov9ReclassifiedResearch:micro}}}}/>);
 expect(html).toContain("MICRO W3 END MARKED");
 expect(html).toContain("W4 DOWN WATCH");
 expect(html).toContain("7324.00");
 expect(html).toContain("7469.00");
 expect(html).toContain("7362.00");
 expect(html).toContain("7600.00");
 expect(html).toContain("2026-11-09 13:00 AZ");
 expect(html).not.toContain("MICRO W3 UP — W2 LOW + W1 LENGTH FIB EXTENSIONS");
 expect(html).not.toContain(">OLDER MICRO<");
});
test("Submicro card shows owner-marked A/B while keeping old models separate",()=>{
 const html=renderToStaticMarkup(<Engine22MarketStructureCard
  engine22Display={{version:"engine22Display.v1",degreeOrder:["submicro"],degrees:{
   submicro:{label:"Submicro",headline:"OLDER SUBMICRO",rows:[],levels:[]}}}}
  currentWavelength={{degrees:{submicro:{
   ownerSubmicroW3Nov9InternalResearch:submicro,
   ownerSubmicroW3Nov9Research:make("engine22.submicroW3Nov9Research.v1",
    7324,"old",7469,"old",7362,"old",[[1,7507]])}}}}/>);
 expect(html).toContain("SUBMICRO A DOWN");
 expect(html).toContain("7600.00");
 expect(html).toContain("2026-11-09 13:00 AZ");
 expect(html).toContain("7507.25");
 expect(html).toContain("2026-11-10 06:40 AZ");
 expect(html).toContain("7566.00");
 expect(html).toContain("2026-11-10 08:00 AZ");
 expect(html).toContain("C DOWN WATCH");
 expect(html).not.toContain("OLDER SUBMICRO");
 expect(html).not.toContain("7324.00");
 expect(html).not.toContain("SUBMICRO W3 UP — W2 LOW + W1 LENGTH FIB EXTENSIONS");
});
