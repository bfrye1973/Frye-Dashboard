# Engine 2C — Isolated ES Research Chart Preview V1

**STATUS: DRAFT / PARTIAL VISUAL IMPLEMENTATION. NOT BROWSER-ACCEPTED. NO PRODUCTION MERGE.**

This self-contained offline chart lives only at `research/engine2c-preview/`. It does **not** import or modify the production dashboard entrypoint, RowChart, backend, execution, Journal or Replay.

## Preview startup

1. Obtain `docs/architecture/evidence/engine11-research-chart-preview-handoff-v1.json.zlib.b64` from backend draft PR #136, pinned SHA `6c5dc7f409ef60fa1f9152363315ebb57b3008fd`.
2. Decode strictly with Node: `node -e "const fs=require('fs'),z=require('zlib');fs.writeFileSync('handoff.json',z.inflateSync(Buffer.from(fs.readFileSync('engine11-research-chart-preview-handoff-v1.json.zlib.b64','utf8').trim(),'base64')))"`. Verify the fixture's upstream SHA and `handoffVersion` with the backend `read.mjs` hash checker **before** loading it into the browser; the local viewer performs schema/authority checks but not cryptographic provenance verification.
3. Open `research/engine2c-preview/index.html` locally in a modern browser. Use the file selector to load `handoff.json`. No server, external scripts, node_modules, feeds or credentials are needed.
4. Select one of three price views, seven frames and ALL/seven owner degrees. Use Load older sample / Show rollover sample, scroll or drag to pan, and zoom buttons.

**Source limitations:** The Phase 5 package has 21 sample frame/view combinations, each providing up to 5 first rows, optional 5 next rows and up to 8 rollover sample rows. It is **not** a continuous two-year interactive dataset. No synthesis, period filling, candle snapping, automatic count selection, or official Fib drawing is performed. The 25,000-row cap is implemented but cannot be stress-verified from this small fixture alone. All prices are archived samples; adjusted history is not certified ES1!.

**Marks:** The 40 original owner-node records are kept in their source layer unchanged; conditional timestamp hypotheses can be marked with orange dotted crosses. Original unresolved/outside-range marks remain in the evidence table. Source times are Phoenix hypotheses, not verified exchange times. All 34 original Fibonacci references remain withheld from official plotting.

**Known remaining acceptance work:** T24–T27 require an actual local browser exercise with fixture import, sequence/race simulation, screenshots, mobile viewport checks, 25k-bar stress/reload, and independent rollback. These have **not** yet been performed and are not marked PASS. A sample-only UI cannot demonstrate full historical paging, smooth two-year navigation or end-to-end data compatibility. Engine2B must review before approving another stage.

**Rollback:** Delete `research/engine2c-preview/` from the feature branch or close the offline page. Nothing in production imports this directory.

**Owner:** Engine2C, reporting to Engine2B. Related backend Issue #137 and central Issue #130. Engine22 exclusively owns official structural/Fib authority. Engine11 exclusively owns source-candle contracts.
