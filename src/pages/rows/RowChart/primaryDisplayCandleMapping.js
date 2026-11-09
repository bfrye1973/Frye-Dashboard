// Engine11B — verified DISPLAY candle opens for owner-updated Primary B-ADJ-OFF coordinates.
// Source: Engine 22 Master Primary!A2:F6 and SHA-256 verified 2020+ Engine11 archive
// workflow run 42547254670. X display opens only; owner event timestamp/price unchanged.
// The existing archive/contract prices must never be modified to fit the overlay.
export const VERIFIED_PRIMARY_DISPLAY_OPENS = Object.freeze({
  "1d": Object.freeze({
    "2020-04-01T15:00:00.000Z": "2020-04-01T00:00:00.000Z",
    "2022-01-04T17:00:00.000Z": "2022-01-04T00:00:00.000Z",
    "2022-10-13T16:00:00.000Z": "2022-10-13T00:00:00.000Z",
    "2025-02-19T16:00:00.000Z": "2025-02-19T00:00:00.000Z",
    "2025-04-07T14:00:00.000Z": "2025-04-07T00:00:00.000Z",
  }),
  "4h": Object.freeze({
    "2020-04-01T15:00:00.000Z": "2020-04-01T12:00:00.000Z",
    "2022-01-04T17:00:00.000Z": "2022-01-04T16:00:00.000Z",
    "2022-10-13T16:00:00.000Z": "2022-10-13T16:00:00.000Z",
    "2025-02-19T16:00:00.000Z": "2025-02-19T16:00:00.000Z",
    "2025-04-07T14:00:00.000Z": "2025-04-07T12:00:00.000Z",
  }),
});

export function primaryDisplayCandleOpen(anchor, timeframe) {
  if (!anchor || anchor.degree !== "primary") return null;
  const ownerUtc = new Date(anchor.timeSec * 1000).toISOString();
  const verified = VERIFIED_PRIMARY_DISPLAY_OPENS[timeframe]?.[ownerUtc];
  return verified ? Date.parse(verified) / 1000 : null;
}
