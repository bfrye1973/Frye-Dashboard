# Engine2C Phase 3 integration rollback and acceptance

Integration PR: #63. This is DEVELOPMENT ONLY. Never merge or deploy before Engine2B approves exact tested SHA.

## Baseline
Frontend repository main at audit: `fe99cddfd7a219da484aa7a8413a76dd7f865d7a`. **Do not assume this equals the deployed Render SHA.** Actual production service/deployed SHA are a predeployment hold pending owner-confirmed Render workspace inventory.

## What changed
- The entire original `src/pages/rows/RowChart/index.jsx` remains byte-for-byte unchanged.
- `src/lib/ohlcClient.js` is unchanged. LIVE uses the same history, SSE, overlays, engine timelines and control UI.
- `src/pages/NewDashboard.jsx` and `src/pages/FullChart.jsx` import the new `RowChartModeGate.jsx`, which chooses precisely one renderer.
- Four exact runtime research assets from accepted PR #61 are served as CRA static public files at `public/engine2c-research/`. All approved research counts and labels are preserved.
- `?engine2cChart=research` opens archive-only research; `?engine2cChart=live` restores the legacy live chart. The two visible buttons perform the same operation.
- Default is LIVE. Only explicitly configuring `REACT_APP_ENGINE2C_DEFAULT_RESEARCH=true` at a separately approved deployment build changes the default to RESEARCH. The build flag must be tested in the intended deployment environment.

## What is *not* supported in RESEARCH mode
The small archived fixture cannot provide a current executable ES price or a complete two-year scrollable chart. Existing LIVE EMA, Engine 17 timeline, production Fib/Shelf/zone overlays, market snapshot subscriptions and drawing tools are not reproduced inside the research iframe; returning to LIVE restores them.

## Independent rollback
Immediate user-visible rollback: use LIVE button (no app rebuild). URL rollback: `?engine2cChart=live`. Operations rollback, only if manager explicitly directs: disable the build-time research default flag on next approved deployment, or redeploy the verified previous Render deployed SHA (not the unverified main-branch SHA). Undoing a merge must **not** discard concurrent production work.

## Test procedure
`npm ci && npm run build`. Actual dashboard /chart test is `research/engine2c-preview/dashboard-integration-smoke.cjs` in Chromium at 1440×900 and 390×844, loading the built CRA SPA; switching LIVE/RESEARCH; validating the archive iframe and taking integrated screenshot evidence. CI workflow `.github/workflows/engine2c-rowchart-integration.yml`. **Do not claim success before completed green job and screenshot artifact.**

## Deployment gate
Engine2B must confirm the real Render deployed commit/service identity (workspace consent needed), review integrated screenshots, frontend build and rollback test, and verify research-only, data basis and engine isolation. No production merge/deploy permitted under current directive.
