import { mustPreserveEngine11HistoricalSeries } from "./engine11BackfillGuard";

describe("Engine11B immutable archive / LIVE backfill 25k protection", () => {
  test("full archive remains authoritative even when UI working cache is truncated", () => {
    const completeChart = Array.from({length: 26000}, (_, i) => ({time:i, close:i}));
    const uiCache = completeChart.slice(-25000);
    expect(uiCache).toHaveLength(25000);
    expect(completeChart).toHaveLength(26000);
    expect(mustPreserveEngine11HistoricalSeries({
      fullEngine11Loaded:true, activeEngine11Pager:false,
    })).toBe(true);
    // A LIVE gap fetch must not invoke setFullSeries(uiCache).
    const reseed = jest.fn();
    if (!mustPreserveEngine11HistoricalSeries({fullEngine11Loaded:true})) {
      reseed(uiCache);
    }
    expect(reseed).not.toHaveBeenCalled();
    expect(completeChart[0].time).toBe(0);
  });

  test("active 5m/10m historical pager prevents destructive LIVE reseed", () => {
    for (const frame of ["5m","10m"]) {
      const setFullSeries = jest.fn();
      const protectedSeries = mustPreserveEngine11HistoricalSeries({
        fullEngine11Loaded:false, activeEngine11Pager:true,
      });
      if (!protectedSeries) setFullSeries([{time:1,close:1}]);
      expect(setFullSeries).not.toHaveBeenCalled();
    }
  });

  test("normal 1m recent OHLC permits bounded gap repair", () => {
    expect(mustPreserveEngine11HistoricalSeries({})).toBe(false);
    expect(mustPreserveEngine11HistoricalSeries({
      fullEngine11Loaded:false,activeEngine11Pager:false,
    })).toBe(false);
  });
});
