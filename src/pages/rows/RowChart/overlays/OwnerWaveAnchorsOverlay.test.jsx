import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OwnerWaveAnchorsOverlay from "./OwnerWaveAnchorsOverlay";
import { ownerAnchorsForDegree, ALL_OWNER_WAVE_ANCHORS } from "../ownerWaveAnchors";

test("new wave review opens clean with all marker dots OFF",()=>{
  const html=renderToStaticMarkup(
    <OwnerWaveAnchorsOverlay visible={true} chart={null} priceSeries={null} degree="PRIMARY"/>
  );
  expect(html).toContain("Wave nodes · 1 degree at a time");
  expect(html).toContain("Minor (2 + Fib)");
  expect(html).toContain("Minute (4)");
  expect(html).toContain("Subminute (3)");
  expect(html).toContain("Micro (3)");
  expect(html).toContain("Submicro (3)");
  expect(html).toContain("Intermediate (3)");
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("Primary (5)");
  expect(html).not.toContain("ALL");
  expect((html.match(/<button/g)||[])).toHaveLength(8);
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
