import { OWNER_WAVE_ANCHORS } from "./ownerWaveAnchors";
import { primaryDisplayCandleOpen } from "./primaryDisplayCandleMapping";
import { manualWaveDrawingEnabled } from "./overlays/Engine22FibLayersOverlay";

const sourcePrimary=OWNER_WAVE_ANCHORS.filter(a=>a.degree==="primary");

test("exactly five owner historical Primary anchors retained with source timestamps and prices",()=>{
  expect(sourcePrimary).toHaveLength(5);
  expect(sourcePrimary.map(a=>a.price)).toEqual([3200,5620,4306,6487,5182]);
  expect(sourcePrimary.map(a=>new Date(a.timeSec*1000).toISOString())).toEqual([
    "2020-04-02T15:00:00.000Z",
    "2022-01-05T17:00:00.000Z",
    "2022-10-12T16:00:00.000Z",
    "2025-02-20T16:00:00.000Z",
    "2025-04-09T14:00:00.000Z",
  ]);
});
test("the five source times map only to audited actual Daily and 4H candle openings",()=>{
  expect(sourcePrimary.map(a=>new Date(primaryDisplayCandleOpen(a,"1d")*1000).toISOString())).toEqual([
    "2020-04-02T00:00:00.000Z",
    "2022-01-05T00:00:00.000Z",
    "2022-10-12T00:00:00.000Z",
    "2025-02-20T00:00:00.000Z",
    "2025-04-09T00:00:00.000Z",
  ]);
  expect(sourcePrimary.map(a=>new Date(primaryDisplayCandleOpen(a,"4h")*1000).toISOString())).toEqual([
    "2020-04-02T12:00:00.000Z",
    "2022-01-05T16:00:00.000Z",
    "2022-10-12T16:00:00.000Z",
    "2025-02-20T16:00:00.000Z",
    "2025-04-09T12:00:00.000Z",
  ]);
  expect(primaryDisplayCandleOpen(sourcePrimary[0],"1h")).toBeNull();
  expect(sourcePrimary[0].price).toBe(3200);
});
test("Fib manual connectors can be kept off independent of Primary node stage",()=>{
  expect(manualWaveDrawingEnabled("OFF","primary",true,{showWaveLines:true})).toBe(false);
  expect(manualWaveDrawingEnabled("OFF","primary",true,{showWaveLabels:true})).toBe(false);
});
