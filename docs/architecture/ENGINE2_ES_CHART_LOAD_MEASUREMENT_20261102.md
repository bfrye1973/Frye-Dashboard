# Engine 2 — ES chart historical-loading measurement (isolated, 2026-11-02)

**Status:** instrumentation only; not deployed. No archive, roll-selection, LIVE aggregation or chart-setData behavior changed. Owner-directed production rollback remains active.

## Scope and observed source paths

| RowChart frame | Path | Expected Engine 11 pages / rows |
| --- | --- | --- |
| 1m | /api/v1/futures/ohlc (one request, variable rows) | No Engine 11 1m dataset |
| 5m | /engine2c-private-history/page (2020+ pinned) | 472 / 471,044 |
| 10m | /engine2c-private-history/page (2020+ pinned) | 236 / 235,733 |
| 1h | /engine2c-private-history/page (2020+ pinned) | 40 / 39,364 |
| 4h | /engine2c-private-history/page (2020+ pinned) | 10 / 9,319 |

**Important:** RowChart supports 1m/5m/10m/1h/4h, but not 2H. A reported 2H→5m transition needs separate research-chart routing investigation; do not assume 2H uses this component.

## Activation / collection

On an isolated build/locally tested copy, navigate to existing dashboard chart URL with \`engine2LoadAudit=1\`. Use original session authorization for the Engine 11 private archive, without ever copying the owner key into a log, CI secret, or URL.

The browser emits **[Engine2 Chart Load Audit]** once per load in console and stores at most 30 sanitized summaries in \`window.__engine2ChartLoadReports\`. Only counts, durations, source path, symbol/frame and repeat-visit metadata are recorded. No candles, owner key, private data or query strings are stored.

Run in same browser session (fresh and repeat): 1m→5m→10m→1h→4h→5m→10m, plus a separately documented 2H→5m research-page switch if applicable. Record failed/fallback loads and network status independently.

## Metrics and interpretation

- \`requests\`: successfully parsed historical endpoint responses; if one errors before JSON, request count can undercount. For exact HTTP attempts/error statuses inspect DevTools Network alongside this log.
- \`rowsDownloaded\`: raw OHLC row count on regular path; total verified page rows on Engine 11.
- \`networkMs\`: sum of \`fetch()\` durations to response headers (does not include response-body transfer).
- \`browserParseMs\`: measured \`response.json()\` including body download and JSON parse; do not call this CPU-only JSON parsing.
- \`browserTransformMs\`: page-level OHLC conversion/copy/dedup preparation or regular OHLC normalization.
- \`browserMergeMs\`: per-page ID/time map insertions.
- \`browserSortMs\`: terminal ascending sort.
- \`historyFetchCompleteMs\`: end-to-end historical download plus processing before React/chart seed.
- \`seedPrepareMs\`: RowChart sorting and bounded UI-cache preparation.
- \`candleSetDataMs\`: synchronous Lightweight Charts candlestick \`setData()\` call.
- \`volumeSetDataMs\`: synchronous histogram update.
- \`firstVerifiedPageMs\`: first successful validated historical page; *not* time until displayed.
- \`firstPaintOpportunityMs\`: two \`requestAnimationFrame\` callbacks after seed; a paint opportunity proxy, *not* proof that candles rendered on pixels. Confirm actual first visible candle in an isolated Playwright screenshot test before making a visibility claim.
- \`repeatedTimeframe\`, \`visit\`: whether the same frame/symbol has triggered the effect before. The existing code refetches when returning to an earlier timeframe and also reseeds when range/volume changes; no cache was introduced.

## Decision gates

1. Compare 1m vs 5m/10m vs 1h/4h network/parsing/merge/setData contributions with actual browser traces.
2. If sequential page latency is dominant, design a separate approved progressive-loading candidate with first-page visibility and full-history atomic authority. Do not overwrite historical data or use the truncated UI cache as a new source.
3. Keep \`src/pages/rows/RowChart/ownerWaveAnchors.js\`, Engine 22 Fib/anchor renderers, quarterly rollover files, provider routes and LIVE feed untouched in this measurement PR.
4. Do not merge this instrumentation PR to production without explicit owner acceptance; no production timings are claimed from test fixtures.
