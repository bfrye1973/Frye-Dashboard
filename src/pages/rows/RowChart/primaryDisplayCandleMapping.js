// Engine 11B — read-only presentation coordinates for OWNER Primary review.
// Source: signed 2020+ Engine11 5m / 1h / 4h / 1d archive audit,
// GitHub Actions 42540949422 (all source-page SHA-256 passed).
// These are ONLY actual source candle opening timestamps, not new pivots.
// Owner supplied Arizona event time and ES price remain immutable in ownerWaveAnchors.js.
export const VERIFIED_PRIMARY_DISPLAY_OPENS = Object.freeze({
  "1d": Object.freeze({
    "2020-04-02T15:00:00.000Z": "2020-04-02T00:00:00.000Z",
    "2022-01-05T17:00:00.000Z": "2022-01-05T00:00:00.000Z",
    "2022-10-12T16:00:00.000Z": "2022-10-12T00:00:00.000Z",
    "2025-02-20T16:00:00.000Z": "2025-02-20T00:00:00.000Z",
    "2025-04-09T14:00:00.000Z": "2025-04-09T00:00:00.000Z",
  }),
  "4h": Object.freeze({
    "2020-04-02T15:00:00.000Z": "2020-04-02T12:00:00.000Z",
    "2022-01-05T17:00:00.000Z": "2022-01-05T16:00:00.000Z",
    "2022-10-12T16:00:00.000Z": "2022-10-12T16:00:00.000Z",
    "2025-02-20T16:00:00.000Z": "2025-02-20T16:00:00.000Z",
    "2025-04-09T14:00:00.000Z": "2025-04-09T12:00:00.000Z",
  }),
});

export function primaryDisplayCandleOpen(anchor, timeframe) {
  if (!anchor || anchor.degree !== "primary") return null;
  const ownerUtc = new Date(anchor.timeSec * 1000).toISOString();
  const verified = VERIFIED_PRIMARY_DISPLAY_OPENS[timeframe]?.[ownerUtc];
  return verified ? Date.parse(verified) / 1000 : null;
}
