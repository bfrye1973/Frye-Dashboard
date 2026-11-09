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
    ["W1 starting low","2026-03-30","17:00",6342],
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

test("Minute updated research A-B-C nodes retain sheet values and C remains provisional",()=>{
  const {MINUTE_REVIEW_ANCHORS}=require("./intermediateMinorReview");
  expect(MINUTE_REVIEW_ANCHORS.map(a=>[a.label,a.date,a.time,a.price])).toEqual([
    ["A starting high","2026-08-14","07:00",7832.25],
    ["A ending low","2026-09-16","11:00",7575.25],
    ["B ending high","2026-10-11","22:00",7887],
    ["C observed low candidate","2026-11-05","16:00",7322.25],
  ]);
  expect(MINUTE_REVIEW_ANCHORS.at(-1).classification).toMatch(/PROVISIONAL/);
});
test("Subminute updated research nodes do not fabricate unknown C endpoint",()=>{
  const {SUBMINUTE_REVIEW_ANCHORS}=require("./intermediateMinorReview");
  expect(SUBMINUTE_REVIEW_ANCHORS.map(a=>[a.label,a.date,a.time,a.price])).toEqual([
    ["A starting high","2026-10-14","05:00",7876],
    ["A ending low","2026-10-25","16:00",7647],
    ["B ending high","2026-10-28","08:20",7819],
  ]);
});
test("Micro research preserves conflicting A High sheet cell and flags disagreement",()=>{
  const {MICRO_REVIEW_ANCHORS}=require("./intermediateMinorReview");
  expect(MICRO_REVIEW_ANCHORS.map(a=>[a.label,a.date,a.time,a.price])).toEqual([
    ["A Low","2026-11-03","16:00",7484.75],
    ["A High","2026-10-28","12:00",7819.25],
    ["B","2026-11-05","05:00",7740],
  ]);
  expect(MICRO_REVIEW_ANCHORS[1].classification).toMatch(/CONFLICT/);
  expect(MICRO_REVIEW_ANCHORS[2].classification).toMatch(/PROVISIONAL/);
});

test("owner anchor candle-open mapping is available on every supported chart timeframe",()=>{
  const {containingLoadedCandleOpen,OWNER_NODE_FRAME_SECONDS}=require("./intermediateMinorReview");
  const anchor=Date.parse("2026-11-05T16:05:00Z")/1000;
  for(const [frame,secs] of Object.entries(OWNER_NODE_FRAME_SECONDS)){
    const open=anchor - (anchor % secs);
    const bars=[{time:open-secs},{time:open},{time:open+secs}];
    expect(containingLoadedCandleOpen(anchor,frame,bars)).toBe(open);
    expect(containingLoadedCandleOpen(anchor,frame,[])).toBeNull();
  }
});
test("missing historical candles never produce invented nodes",()=>{
  const {containingLoadedCandleOpen}=require("./intermediateMinorReview");
  const anchor=Date.parse("2020-04-01T15:00:00Z")/1000;
  const current=[{time:Date.parse("2026-11-03T15:00:00Z")/1000}];
  for(const tf of ["1m","5m","10m","15m","30m","1h","4h","1d"]){
    expect(containingLoadedCandleOpen(anchor,tf,current)).toBeNull();
  }
});
test("mapping respects nonstandard 4h session candle starts and does not align to UTC modulo",()=>{
  const {containingLoadedCandleOpen}=require("./intermediateMinorReview");
  const t=Date.parse("2026-11-05T15:00:00Z")/1000;
  const start=Date.parse("2026-11-05T13:00:00Z")/1000;
  expect(containingLoadedCandleOpen(t,"4h",[{time:start}])).toBe(start);
});
