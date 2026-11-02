// Engine 2 — presentation-only guards for the immutable Engine 11 chart source.
// These helpers never modify research candles, rollover dates or price basis.

export function expectedLiveTicker(sourceContract) {
  const match = /^ES([HMUZ])(\d{4})$/.exec(String(sourceContract || ""));
  return match ? `ES${match[1]}${match[2].slice(-1)}` : null;
}

export function liveContractMatchesHistory(sourceContract, resolvedTicker) {
  const expected = expectedLiveTicker(sourceContract);
  return Boolean(expected && String(resolvedTicker || "").toUpperCase() === expected);
}

export function liveBucketIsAfterArchive(bucketTime, archiveLastTime) {
  return Number.isFinite(bucketTime) &&
    Number.isFinite(archiveLastTime) &&
    bucketTime > archiveLastTime;
}

export function fullChartLogicalRange(totalBars, requestedBars) {
  const length = Number(totalBars);
  const count = Number(requestedBars);
  if (!Number.isInteger(length) || length < 1 || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  const to = length - 1;
  return { from: Math.max(0, to - Math.floor(count) + 1), to };
}
