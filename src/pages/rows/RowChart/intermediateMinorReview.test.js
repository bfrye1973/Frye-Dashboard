import { INTERMEDIATE_REVIEW_ANCHORS, MINOR_REVIEW_ANCHORS,
  MINOR_W2_RESEARCH_LEVELS, checkedDisplayCandleOpen } from "./intermediateMinorReview";
import { ownerAnchorsForDegree } from "./ownerWaveAnchors";

test("Intermediate exactly matches connected Master historical owner coordinates",()=>{
  expect(INTERMEDIATE_REVIEW_ANCHORS.map(a=>[a.label,a.date,a.time,a.price])).toEqual([
    ["W1 starting low","2025-04-09","07:00",4877],
    ["W1 ending high","2026-01-28","10:00",7044],
    ["W2 ending low","2026-03-31","03:00",6345],
  ]);
});
test("Minor uses corrected Apr 30 W1 origin and August W1 high; W2 candidate is not a confirmed node",()=>{
  expect(MINOR_REVIEW_ANCHORS.map(a=>[a.label,a.date,a.time,a.price])).toEqual([
    ["W1 starting low","2026-04-30","17:00",6342],
    ["W1 ending high","2026-08-13","06:00",7841.25],
  ]);
  expect(MINOR_REVIEW_ANCHORS.every(a=>a.classification==="OWNER RESEARCH")).toBe(true);
  expect(MINOR_REVIEW_ANCHORS.some(a=>a.label.includes("W2"))).toBe(false);
});
test("Minor researched fib price levels stay tick-rounded and unverified",()=>{
  expect(MINOR_W2_RESEARCH_LEVELS.map(a=>[a.ratio,a.price])).toEqual([
    ["0.236",7487.50],["0.500",7091.75],["0.618",6914.75],
    ["0.786",6662.75],["0.886",6513],["1.000",6342],
  ]);
  expect(MINOR_W2_RESEARCH_LEVELS.every(a=>a.status==="UNVERIFIED" && a.price*4===Math.round(a.price*4))).toBe(true);
});
test("display candle mapping uses actual chart candle opens, with no arbitrary nearest-pivot fallback",()=>{
  const a=INTERMEDIATE_REVIEW_ANCHORS[0]; // 2025-04-09 14:00 UTC
  const bars=[{time:Date.parse("2025-04-09T12:00:00Z")/1000},
    {time:Date.parse("2025-04-09T16:00:00Z")/1000}];
  expect(checkedDisplayCandleOpen(a,"4h",bars)).toBe(bars[0].time);
  expect(checkedDisplayCandleOpen(a,"1d",[{time:Date.parse("2025-04-09T00:00:00Z")/1000}]))
    .toBe(Date.parse("2025-04-09T00:00:00Z")/1000);
  expect(checkedDisplayCandleOpen(a,"4h",[])).toBeNull();
  expect(checkedDisplayCandleOpen(a,"4h",[{time:Date.parse("2025-04-08T00:00:00Z")/1000}])).toBeNull();
  expect(checkedDisplayCandleOpen(a,"5m",bars)).toBeNull();
});
test("none of the other six degree collections are edited to show Intermediate and Minor",()=>{
  expect(ownerAnchorsForDegree("PRIMARY")).toHaveLength(5);
  expect(ownerAnchorsForDegree("INTERMEDIATE")).toHaveLength(3);
  expect(ownerAnchorsForDegree("MINOR")).toHaveLength(8);
});
