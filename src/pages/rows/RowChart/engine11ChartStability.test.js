import {
  expectedLiveTicker,
  liveContractMatchesHistory,
  liveBucketIsAfterArchive,
  fullChartLogicalRange,
} from "./engine11ChartStability";

describe("Engine 11 historical/LIVE chart stability guards", () => {
  test("compares the archive physical contract rather than the ES root", () => {
    expect(expectedLiveTicker("ESZ2026")).toBe("ESZ6");
    expect(liveContractMatchesHistory("ESZ2026", "ESZ6")).toBe(true);
    expect(liveContractMatchesHistory("ESZ2026", "ESH7")).toBe(false);
    expect(liveContractMatchesHistory("ESZ2026", "ES")).toBe(false);
    expect(liveContractMatchesHistory(null, "ESZ6")).toBe(false);
  });

  test("rejects overlap or correction of a pinned archive candle", () => {
    const last = 1793356200;
    expect(liveBucketIsAfterArchive(last, last)).toBe(false);
    expect(liveBucketIsAfterArchive(last - 600, last)).toBe(false);
    expect(liveBucketIsAfterArchive(last + 600, last)).toBe(true);
    expect(liveBucketIsAfterArchive(NaN, last)).toBe(false);
  });

  test("50, 100 and 200 ranges reference 235733 plotted candles, not the UI cache", () => {
    expect(fullChartLogicalRange(235733, 50)).toEqual({ from: 235683, to: 235732 });
    expect(fullChartLogicalRange(235733, 100)).toEqual({ from: 235633, to: 235732 });
    expect(fullChartLogicalRange(235733, 200)).toEqual({ from: 235533, to: 235732 });
    expect(fullChartLogicalRange(20, 50)).toEqual({ from: 0, to: 19 });
  });
});
