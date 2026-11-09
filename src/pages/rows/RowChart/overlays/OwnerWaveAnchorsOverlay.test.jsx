import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OwnerWaveAnchorsOverlay from "./OwnerWaveAnchorsOverlay";
import { ownerAnchorsForDegree, ALL_OWNER_WAVE_ANCHORS } from "../ownerWaveAnchors";

test("anchor overlay no longer creates a floating top-right wave toolbar",()=>{
  for(const stage of ["OFF","PRIMARY","INTERMEDIATE","MINOR","MINUTE",
    "SUBMINUTE","MICRO","SUBMICRO"]){
    const html=renderToStaticMarkup(
      <OwnerWaveAnchorsOverlay visible={true} chart={null}
        priceSeries={null} degree="PRIMARY" stage={stage}/>
    );
    expect(html).toBe("");
  }
});

test("stage 1 permits only Primary's five original historical points",()=>{
  const primary=ownerAnchorsForDegree("PRIMARY");
  expect(primary).toHaveLength(5);
  expect(primary.map(x=>x.label)).toEqual([
    "W1 starting low","W1 ending high","W2 ending low",
    "W3 ending high","W4 ending low"
  ]);
  expect(primary.every(a=>a.degree==="primary")).toBe(true);
  expect(primary.every(a=>!a.classification)).toBe(true);
});

test("clearing markers does not delete any of the 39 original source records",()=>{
  expect(ALL_OWNER_WAVE_ANCHORS).toHaveLength(39);
  const hidden=ALL_OWNER_WAVE_ANCHORS.filter(a=>a.degree!=="primary");
  expect(hidden).toHaveLength(34);
  expect(new Set(hidden.map(a=>a.degree)).size).toBe(6);
});

test("overlay does not display a toolbar when not on the ES chart",()=>{
  const html=renderToStaticMarkup(
    <OwnerWaveAnchorsOverlay visible={false} chart={null} priceSeries={null} degree="PRIMARY"/>
  );
  expect(html).toBe("");
});
