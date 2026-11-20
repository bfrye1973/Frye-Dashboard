// Synthetic tests for volumeProfileCore. No market data.
import {
  computeVolumeProfile,
  detectShelfBreak,
  nearestNodeBelow,
} from "./volumeProfileCore";

// Deterministic pseudo-random so tests are repeatable.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bar(t, lo, hi, volume, close) {
  return { time: t, open: (lo + hi) / 2, high: hi, low: lo, close: close ?? (lo + hi) / 2, volume };
}

// Heavy trading 6950-7000, a fast thin run-up through 7000-7375,
// then a long heavy shelf 7380-7650 (this week's ES structure, simplified).
function buildHistory() {
  const r = rng(7);
  const bars = [];
  let t = 1;
  for (let i = 0; i < 150; i++) {
    const lo = 6950 + r() * 40;
    bars.push(bar(t++, lo, lo + 8, 5000));
  }
  for (let p = 7000; p < 7375; p += 15) bars.push(bar(t++, p, p + 15, 400));
  for (let i = 0; i < 300; i++) {
    const lo = 7380 + r() * 260;
    bars.push(bar(t++, lo, lo + 10, 5000));
  }
  return { bars, t };
}

test("value area, POC and the 7375 shelf edge are found", () => {
  const { bars } = buildHistory();
  bars.push(bar(9999, 7500, 7505, 1)); // forming bar, excluded
  const vp = computeVolumeProfile(bars, { lookback: 1000, rows: 120 });
  expect(vp).not.toBeNull();
  expect(vp.barsUsed).toBe(bars.length - 1);
  expect(vp.hvn.some((p) => Math.abs(p - vp.poc) <= vp.rowSize)).toBe(true);
  expect(vp.vah).toBeGreaterThan(vp.val);
  expect(vp.thinRuns.some((x) => x.lo < 7100 && x.hi > 7300)).toBe(true);
  const lower = vp.shelfEdges.filter((e) => e.side === "LOWER").map((e) => e.price);
  expect(lower.some((p) => Math.abs(p - 7380) <= 2 * vp.rowSize)).toBe(true);
  expect(vp.lvn.some((p) => p > 7050 && p < 7350)).toBe(true);
  expect(nearestNodeBelow(vp, 7300)).toBeLessThan(7010);
});

test("volume is split across rows in proportion to overlap", () => {
  const bars = [bar(1, 100, 104, 400), bar(2, 100, 101, 0), bar(3, 103, 104, 0)];
  const vp = computeVolumeProfile(bars, { rows: 4, excludeLast: false, tickSize: 0.25 });
  const vols = vp.rows.map((x) => Math.round(x.volume));
  expect(vols).toEqual([100, 100, 100, 100]);
});

test("acceptance below the shelf edge raises a warning; a wick does not", () => {
  const { bars, t } = buildHistory();
  let tt = t;
  const recent = [];
  for (let i = 0; i < 25; i++) recent.push(bar(tt++, 7400, 7420, 3000, 7410));
  // a wick below the edge that closes back inside: no warning
  const wick = [...bars, ...recent, bar(tt, 7360, 7400, 3000, 7395), bar(tt + 1, 7390, 7405, 3000, 7398), bar(tt + 2, 0, 0, 0)];
  wick[wick.length - 1] = bar(tt + 2, 7395, 7400, 1); // forming
  expect(detectShelfBreak(wick, { lookback: 1000 }).status).toBe("NO_SHELF_BREAK");

  // two closes well below the edge: warning, next node near 6950-7000
  const brk = [...bars, ...recent, bar(tt, 7350, 7400, 3000, 7355), bar(tt + 1, 7330, 7360, 3000, 7335), bar(tt + 2, 7330, 7332, 1)];
  const res = detectShelfBreak(brk, { lookback: 1000, marginPts: 2, closesRequired: 2 });
  expect(res.status).toBe("ACCEPTED_BELOW_SHELF");
  expect(Math.abs(res.edge - 7380)).toBeLessThan(10);
  expect(res.nextNode).toBeLessThan(7010);
  expect(res.warningOnly).toBe(true);
});

test("bad input fails closed", () => {
  expect(computeVolumeProfile([])).toBeNull();
  expect(computeVolumeProfile([bar(1, 5, 5, 0), bar(2, 5, 5, 0)], { excludeLast: false })).toBeNull();
  expect(detectShelfBreak([]).status).toBe("INSUFFICIENT_DATA");
});
