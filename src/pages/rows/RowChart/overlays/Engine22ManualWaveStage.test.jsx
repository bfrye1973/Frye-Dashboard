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

test("no stage may enable archived manual wave layers once Engine22 owns all degrees",()=>{
  const style={showWaveLines:true,showWaveLabels:true};
  expect(manualWaveDrawingEnabled("PRIMARY","primary",true,style)).toBe(false);
  for(const degree of ["intermediate","minor","minute","subminute","micro","submicro"]){
    expect(manualWaveDrawingEnabled("PRIMARY",degree,true,style)).toBe(false);
  }
  expect(manualWaveDrawingEnabled("PRIMARY","primary",false,style)).toBe(false);
  expect(manualWaveDrawingEnabled("PRIMARY","primary",true,{showWaveLines:false,showWaveLabels:false})).toBe(false);
});

const degreeCheckboxes=html=>(
  html.match(/<input[^>]*type="checkbox"[^>]*aria-label="[^"]*wave nodes"[^>]*>/g)||[]
);
const selectedDegreeCheckboxes=html=>
  degreeCheckboxes(html).filter(tag=>tag.includes("checked"));

test("all seven Elliott Wave degree toggles are independent inside Indicators",()=>{
 const html=renderToStaticMarkup(<IndicatorsToolbar
   waveNodeDegrees={["PRIMARY","INTERMEDIATE","SUBMICRO"]}/>);
 expect(html).toContain("Engine 2 — Elliott Wave Nodes");
 expect(html).toContain("Off — hide all wave nodes");
 for(const label of ["Primary (5)","Intermediate (3)","Minor (2 + Fib)",
   "Minute (4)","Subminute (3)","Micro (3)","Submicro (3)"])
   expect(html).toContain(label);
 expect(degreeCheckboxes(html)).toHaveLength(7);
 expect(selectedDegreeCheckboxes(html)).toHaveLength(3);
 expect(html).toContain("Connect verified source anchors");
 expect(html).toContain("Node / label color");
 expect(html).toContain("Connecting line color");
 expect(html).toContain("Fib (Primary)");
});

test("Primary and Intermediate can remain ON together with Submicro",()=>{
 const all=["PRIMARY","INTERMEDIATE","SUBMICRO"];
 const html=renderToStaticMarkup(
   <IndicatorsToolbar waveNodeDegrees={all} fibPrimary={false}/>
 );
 const selected=selectedDegreeCheckboxes(html);
 expect(selected).toHaveLength(3);
 for(const name of ["Primary (5)","Intermediate (3)","Submicro (3)"])
   expect(selected.some(tag=>tag.includes(name+" wave nodes"))).toBe(true);
 expect(html).toContain("Fib (Primary)");
});

test("each degree can be switched off without changing unrelated degrees",()=>{
 const html=renderToStaticMarkup(<IndicatorsToolbar
   waveNodeDegrees={["PRIMARY","SUBMICRO"]}/>);
 const active=selectedDegreeCheckboxes(html);
 expect(active).toHaveLength(2);
 expect(active.some(tag=>tag.includes("Primary (5) wave nodes"))).toBe(true);
 expect(active.some(tag=>tag.includes("Intermediate (3) wave nodes"))).toBe(false);
 expect(active.some(tag=>tag.includes("Submicro (3) wave nodes"))).toBe(true);
});

test("wave status appears separately for each active degree",()=>{
 const html=renderToStaticMarkup(<IndicatorsToolbar
   waveNodeDegrees={["PRIMARY","INTERMEDIATE","SUBMICRO"]}
   waveNodeStatuses={{
     PRIMARY:{stage:"PRIMARY",mapped:0,total:4,timeframe:"10m",sourceAvailable:true},
     INTERMEDIATE:{stage:"INTERMEDIATE",mapped:0,total:2,timeframe:"10m",sourceAvailable:true},
     SUBMICRO:{stage:"SUBMICRO",mapped:3,total:3,timeframe:"10m",sourceAvailable:true}
   }}
   waveNodeHistoryCursor={11} waveNodeHistoricalRevisionCount={32}
 />);
 expect(html).toContain("0/4 source nodes match loaded");
 expect(html).toContain("0/2 source nodes match loaded");
 expect(html).toContain("3/3 source nodes match loaded");
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
  })).toBe(false);
});
