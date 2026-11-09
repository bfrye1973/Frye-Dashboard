import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import IndicatorsToolbar from "../IndicatorsToolbar";
import {manualWaveDrawingEnabled} from "./Engine22FibLayersOverlay";

test("Wave Off hides every degree's manual wave lines and labels even when Fib is enabled",()=>{
  const style={showWaveLines:true,showWaveLabels:true,showExtensions:true};
  for(const degree of ["primary","intermediate","minor","minute","subminute","micro","submicro"]){
    expect(manualWaveDrawingEnabled("OFF",degree,true,style)).toBe(false);
  }
});

test("Primary stage enables Primary only, not six other manual wave layers",()=>{
  const style={showWaveLines:true,showWaveLabels:true};
  expect(manualWaveDrawingEnabled("PRIMARY","primary",true,style)).toBe(true);
  for(const degree of ["intermediate","minor","minute","subminute","micro","submicro"]){
    expect(manualWaveDrawingEnabled("PRIMARY",degree,true,style)).toBe(false);
  }
  expect(manualWaveDrawingEnabled("PRIMARY","primary",false,style)).toBe(false);
  expect(manualWaveDrawingEnabled("PRIMARY","primary",true,{showWaveLines:false,showWaveLabels:false})).toBe(false);
});

const radioTags=html=>(html.match(/<input[^>]*type="radio"[^>]*>/g)||[]);
const selectedRadioIndex=html=>radioTags(html).findIndex(tag=>tag.includes("checked"));

test("Off and all 7 Elliott Wave degree selectors now live INSIDE Indicators",()=>{
 const html=renderToStaticMarkup(<IndicatorsToolbar waveNodeStage="OFF"/>);
 expect(html).toContain("Engine 2 — Elliott Wave Nodes");
 expect(html).toContain("Off — hide all wave nodes");
 for(const label of ["Primary (5)","Intermediate (3)","Minor (2 + Fib)",
   "Minute (4)","Subminute (3)","Micro (3)","Submicro (3)"])
   expect(html).toContain(label);
 expect(radioTags(html)).toHaveLength(8);
 expect(selectedRadioIndex(html)).toBe(0);
 expect(html).toContain("Connect verified source anchors");
 expect(html).toContain("Node / label color");
 expect(html).toContain("Connecting line color");
 expect(html).toContain("Fib (Primary)");
});

test("exactly one selected wave degree remains active, Fib checkboxes independent",()=>{
 const all=["PRIMARY","INTERMEDIATE","MINOR","MINUTE","SUBMINUTE","MICRO","SUBMICRO"];
 for(let i=0;i<all.length;i++){
   const html=renderToStaticMarkup(
     <IndicatorsToolbar waveNodeStage={all[i]} fibPrimary={false}/>
   );
   expect(radioTags(html)).toHaveLength(8);
   expect(selectedRadioIndex(html)).toBe(i+1);
   expect(radioTags(html).filter(tag=>tag.includes("checked"))).toHaveLength(1);
   expect(html).toContain("Fib (Primary)");
 }
});

test("Wave Nodes indicator reports history/source candle availability",()=>{
 const html=renderToStaticMarkup(<IndicatorsToolbar
   waveNodeStage="SUBMICRO"
   waveNodeStatus={{stage:"SUBMICRO",mapped:2,total:3,timeframe:"30m"}}
   waveNodeHistoryCursor={11} waveNodeHistoricalRevisionCount={32}
 />);
 expect(html).toContain("2/3 source nodes have matching loaded");
 expect(html).toContain("Engine 22 history revision 11");
 expect(html).toContain("32 stored revision events");
});

test("legacy Fibonacci wave canvas cannot overlay old Micro/Submicro chart nodes",()=>{
  for(const degree of ["micro","submicro"]){
    expect(manualWaveDrawingEnabled(degree.toUpperCase(),degree,true,{
      showWaveLines:true,showWaveLabels:true,showExtensions:true,
    })).toBe(false);
  }
  // Fibonacci price-level controls themselves are independent and unchanged.
  expect(manualWaveDrawingEnabled("PRIMARY","primary",true,{
    showWaveLines:true,showWaveLabels:true,
  })).toBe(true);
});
