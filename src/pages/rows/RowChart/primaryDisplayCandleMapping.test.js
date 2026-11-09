import { OWNER_WAVE_ANCHORS } from "./ownerWaveAnchors";
import { primaryDisplayCandleOpen } from "./primaryDisplayCandleMapping";
import { manualWaveDrawingEnabled } from "./overlays/Engine22FibLayersOverlay";

const sourcePrimary=OWNER_WAVE_ANCHORS.filter(a=>a.degree==="primary");

test("five owner-updated Primary anchors match shared master B-ADJ-OFF source values",()=>{
  expect(sourcePrimary).toHaveLength(5);
  expect(sourcePrimary.map(a=>a.price)).toEqual([2440,4806,3504,6157,4825]);
  expect(sourcePrimary.map(a=>new Date(a.timeSec*1000).toISOString())).toEqual([
    "2020-04-01T15:00:00.000Z",
    "2022-01-04T17:00:00.000Z",
    "2022-10-13T16:00:00.000Z",
    "2025-02-19T16:00:00.000Z",
    "2025-04-07T14:00:00.000Z",
  ]);
});
test("five source times map to audited Engine11 Daily and 4H candle opens",()=>{
  expect(sourcePrimary.map(a=>new Date(primaryDisplayCandleOpen(a,"1d")*1000).toISOString())).toEqual([
    "2020-04-01T00:00:00.000Z",
    "2022-01-04T00:00:00.000Z",
    "2022-10-13T00:00:00.000Z",
    "2025-02-19T00:00:00.000Z",
    "2025-04-07T00:00:00.000Z",
  ]);
  expect(sourcePrimary.map(a=>new Date(primaryDisplayCandleOpen(a,"4h")*1000).toISOString())).toEqual([
    "2020-04-01T12:00:00.000Z",
    "2022-01-04T16:00:00.000Z",
    "2022-10-13T16:00:00.000Z",
    "2025-02-19T16:00:00.000Z",
    "2025-04-07T12:00:00.000Z",
  ]);
  expect(primaryDisplayCandleOpen(sourcePrimary[0],"1h")).toBeNull();
});
test("Primary nodes do not automatically enable manual Fibonacci lines",()=>{
  expect(manualWaveDrawingEnabled("OFF","primary",true,{showWaveLines:true})).toBe(false);
  expect(manualWaveDrawingEnabled("OFF","primary",true,{showWaveLabels:true})).toBe(false);
});
