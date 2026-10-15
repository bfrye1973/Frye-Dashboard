# ENGINE 2C — V2 historical-data release gate (manager decision document)

**Development-only. No production service is authorized by this document.**
Current public dashboard stays at the same URL and defaults to LIVE. Research V2
remains dormant without an approved, same-origin server-side handler.

## What the tested implementation already proves

- Engine11 accepted source SHA: `45a351f1bd264d807ee7a3fadc92bae5dba6f4dc`.
- Archive artifact #11901549711; ZIP SHA256:
  `e47f6ef694a36f3b022322b0ff855c8be38276f3510ac6b3ef19fc52a4d781f6`.
- Three views, seven frames, 466841 separate view-specific records, 480
  source-pinned pages; no price reconstruction.
- Private localhost Chromium verification at run #38774255461:
  1000/5000/25000 candles, oldest/newest reload, desktop/mobile, 40 source
  owner nodes and 34 withheld Fibonacci refs.
- This evidence does NOT establish lawful online display to owner/partners.

## Smallest secure serving proposal, NOT mounted

1. Keep the existing Frye Dashboard website and LIVE/RESEARCH controls.
2. Add a dedicated *read-only research route* at an existing manager-approved
   server, reachable through the same-origin dashboard reverse proxy after
   verifying the existing host supports it. Never add these bytes to CRA
   `public/` or the public GitHub repo.
3. Protect **every** research page request server-side using an approved,
   auditable authenticated session, checked before reading any chart chunk.
   The frontend alone must never be the access-control boundary. A secret query
   parameter, CORS restrictions, hidden iframe or unguessable URL is NOT authentication.
4. Check each requester against the exact audience licensed by Massive/CME
   before enabling that user's access. Deny others by default; implement a
   revocation switch and request-level access logging without raw prices.
5. Serve one immutable max-1000-row page per request, with view/frame/version/
   cursor pins matching Engine11 `pageDataset`. No source archive, receipts,
   provider token, raw request body or normalized observation table can be
   exposed by the handler. Reject path traversal, wrong basis/version, expired
   session and repeated/incompatible cursor with 4xx.
6. Rate-limit requests and disable shared/public CDN caching; send
   `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`,
   and appropriate CSP/CSRF protections for the actual session model.
7. Store any approved chart-only chunks outside the public document root and
   behind the same service's file-permission boundary. Verify their checksums
   and effective contract/roll/gap manifests at deployment; do not transfer
   or retain the original private source archives absent separate approval.
8. Preserve existing RowChart/ohlcClient/Engine26/Execution/Journal/Replay
   untouched. In RESEARCH mode, fetch only the research route; in LIVE mode,
   use the original streaming chart. Rollback: turn off the route and research
   feature gate; original five-row fixture and LIVE button remain available.

## Decisions required before any production exposure

A. **Display entitlement:** Review the signed Massive subscription and applicable
CME terms for historical futures data. Confirm whether hosted presentation to
the owner is permitted; confirm whether the two partner viewers require
separate display/redistribution agreements, exchange licenses, fees or reporting.
No assumption that custom indicators or logins grant data rights.

B. **Concrete serving destination:** Identify existing Render service ID,
authenticated entrypoint, session verification method, storage location,
reverse-proxy capability, security owner and retention policy. Render static
sites alone cannot protect public static historical files. Do not deploy
the localhost CI server; it is deliberately unauthenticated and runner-only.

C. **Production release:** Engine2B acceptance of exact PR SHA, explicit owner
authorization and a rollback/window plan. Independently verify Render's
running SHA, real authenticated page access, unauthorized-user denial, LIVE
candles and desktop/mobile V2 rendering after release.

## Explicit non-goals

No new market-data provider; no chart rewrite; no additional Render purchase;
no backend trading-route modifications; no public archive relocation;
no official Engine22 wave/Fibonacci promotion.
