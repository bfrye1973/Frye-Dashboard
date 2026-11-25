import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import { TradeInvestigatorView, PIPELINE } from "./TradeInvestigatorPage";
import { buildQuery, redeemPairingCode, investigate, hasSession, clearSession, revokeSession } from "./investigatorClient";
import r0746 from "./fixtures/real-2026-11-24-0746.investigation.json";
import r0752 from "./fixtures/real-2026-11-24-0752.investigation.json";
import r1016 from "./fixtures/real-2026-11-24-1016.investigation.json";
import r1025 from "./fixtures/real-2026-11-24-1025.investigation.json";
import closed from "./fixtures/synthetic-closed-trade.investigation.json";

const clone = (x) => JSON.parse(JSON.stringify(x));
const markup = (data) => renderToStaticMarkup(<TradeInvestigatorView data={data} />);
const pipe = (html) => [...html.matchAll(/data-engine="(\w+)" data-status="(\w+)"/g)].map((m) => m[1] + ":" + m[2]);

const ORDER = ["engine26A", "engine3", "engine4", "engine6", "engine26B", "engine7", "engine9", "engine8", "engine10"];

test("pipeline renders in the real canonical order 26A,3,4,6,26B,7,9,8,10", () => {
  expect(PIPELINE.map((p) => p[0])).toEqual(ORDER);
  expect(pipe(markup(r1016)).map((x) => x.split(":")[0])).toEqual(ORDER);
});

test("REAL 07:46 — Engine 3 first blocker, statuses exactly as returned", () => {
  const html = markup(r0746);
  expect(html).toContain('data-first-blocker="engine3"');
  expect(html).toContain("ENGINE3_STRATEGY1_NOT_QUALIFIED");
  expect(html).toContain("7,206.75");
  expect(pipe(html)).toEqual(r0746.knownAtDecision.pipeline.map((r) => r.engine + ":" + r.status));
});

test("REAL 07:52 — Engine 4 blocker; v2 shadow shown as SHADOW comparison, never a status chip", () => {
  const html = markup(r0752);
  expect(html).toContain('data-first-blocker="engine4"');
  expect(html).toContain("ENGINE4_PARTICIPATION_NOT_CONFIRMED");
  expect(html).toContain('data-authority="SHADOW"');
  expect(html).toContain("comparison only");
  const shadowBlock = html.split('data-authority="SHADOW"')[1].split("</li>")[0];
  expect(shadowBlock).not.toMatch(/ti-chip--/);
  expect(shadowBlock).toContain("SUPPORTIVE");
  // canonical Engine 4 row is still WAITING
  expect(pipe(html)).toContain("engine4:WAITING");
});

test("REAL 10:16 — Engine 8 blocker, LONG, 3 contracts, no order; DUPLICATE flag visible", () => {
  const html = markup(r1016);
  expect(html).toContain('data-first-blocker="engine8"');
  expect(html).toContain("PAPER_ACCEPTANCE_STATE_UNAVAILABLE");
  expect(html).toContain("LONG");
  expect(html).toContain("DUPLICATE_BLOCK_RECORDED");
  expect(html).toMatch(/<dt>Contracts<\/dt><dd>3<\/dd>/);
  expect(html).toMatch(/<dt>Order created<\/dt><dd>false<\/dd>/);
  expect(html).toMatch(/<dt>Order ID<\/dt><dd><span class="ti-unknown">UNKNOWN<\/span><\/dd>/);
});

test("REAL 10:25 — SHORT, Engine 4 blocker; Engine 8/Journal absent shows UNKNOWN, not 'no trade'", () => {
  const html = markup(r1025);
  expect(html).toContain("SHORT");
  expect(html).toContain('data-first-blocker="engine4"');
  expect(html).toContain('data-lifecycle="UNKNOWN"');
  expect(html).toContain("no retention guarantee");
  expect(html).toContain('data-evidence="UNKNOWN"');
  expect(html).toContain("absence is not proof that nothing happened");
  expect(html).not.toContain("None found");
});

test("INFERRED_PROGRESS is never rendered as PASS", () => {
  const d = clone(r0752);
  const e3 = d.knownAtDecision.pipeline.find((r) => r.engine === "engine3");
  e3.status = "INFERRED_PROGRESS";
  e3.statusSource = "ENGINE28A_RECORDED_PROGRESSION";
  const html = markup(d);
  expect(pipe(html)).toContain("engine3:INFERRED_PROGRESS");
  const row = html.split('data-engine="engine3"')[1].split("</li>")[0];
  expect(row).toContain("INFERRED PROGRESS");
  expect(row).toContain("ti-chip--INFERRED_PROGRESS");
  expect(row).not.toContain("ti-chip--PASS");
  expect(row).toContain("Engine 28A progression only");
});

test("all six statuses have distinct chips; unknown values fall back to UNKNOWN", () => {
  const d = clone(r1016);
  const statuses = ["PASS", "WAITING", "BLOCKED", "NOT_REACHED", "INFERRED_PROGRESS", "UNKNOWN"];
  d.knownAtDecision.pipeline.slice(0, 6).forEach((r, i) => { r.status = statuses[i]; });
  d.knownAtDecision.pipeline[6].status = "SOMETHING_NEW";
  const html = markup(d);
  for (const s of statuses) expect(html).toContain("ti-chip--" + s);
  expect(pipe(html)[6]).toBe("engine9:UNKNOWN");
});

test("SYNTHETIC closed trade — fills, reductions, exit and gross P&L in the after-decision section", () => {
  const html = markup(closed);
  expect(html).toContain('data-lifecycle="MATCHED"');
  expect(html).toContain("FILLED_PER_ENGINE8_PAPER_STORE");
  expect(html).toContain("ENGINE10_PARTIAL_CLOSE");
  expect(html).toContain("ENGINE10_FULL_CLOSE");
  expect(html).toContain("$78.75");
  expect(html).toContain("(gross, as recorded)");
  const known = html.split('aria-label="Trade details"')[0];
  expect(known).not.toContain("ENGINE10_FULL_CLOSE");
});

test("error responses are shown, never filled in", () => {
  const html = markup({ ok: false, error: "NO_SNAPSHOT_AT_OR_BEFORE_REQUESTED_TIME", nextArchivedTime: "0746" });
  expect(html).toContain("NO_SNAPSHOT_AT_OR_BEFORE_REQUESTED_TIME");
  expect(html).toContain("07:46 (a later state; not used)");
});

test("read-only boundary: the page source has no action controls or key handling", () => {
  const dir = __dirname;
  // Code only: strip // and /* */ comments so documentation of what is forbidden does not count.
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
  const src = ["TradeInvestigatorPage.jsx", "investigatorClient.js"].map((f) => stripComments(fs.readFileSync(path.join(dir, f), "utf8"))).join("\n");
  for (const forbidden of [/X-Trade-Investigator-Access/i, /TRADE_INVESTIGATOR_ACCESS_KEY/, /localStorage/, /sessionStorage/, /document\.cookie/, /\/api\/trading/, /execute/i, /cancel/i, /lock.?reset/i, /setRetention|deleteReplay|writeReplay/i, /compress/i, /method:\s*"(PUT|DELETE|PATCH)"/]) {
    expect(src).not.toMatch(forbidden);
  }
  const posts = [...src.matchAll(/method:\s*"POST"/g)].length;
  expect(posts).toBe(2); // session redeem + session revoke only
  const buttons = [...fs.readFileSync(path.join(dir, "TradeInvestigatorPage.jsx"), "utf8").matchAll(/<button[^>]*>([^<{]*)/g)].map((m) => m[1].trim());
  expect(buttons.sort()).toEqual(["", "End session", "Start read-only session"].sort());
});

describe("client", () => {
  afterEach(() => clearSession());

  test("query building passes only allowed parameters", () => {
    expect(buildQuery({ date: "2026-11-24", time: "1016", strategyId: "intraday_scalp@10m", candidateId: " C1 ", planId: "", tradeId: undefined }))
      .toBe("date=2026-11-24&time=1016&strategyId=intraday_scalp%4010m&candidateId=C1");
  });

  test("redeem stores the token in memory and sends it as Bearer; never stores the pairing code", async () => {
    const calls = [];
    const token = "t".repeat(43);
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/session/redeem")) return { ok: true, status: 200, json: async () => ({ ok: true, accessToken: token, expiresAt: new Date(Date.now() + 3600e3).toISOString() }) };
      return { ok: true, status: 200, json: async () => r1016, headers: { get: () => "investigate;dur=40" } };
    };
    await redeemPairingCode("p".repeat(32), { fetchImpl });
    expect(hasSession()).toBe(true);
    const r = await investigate({ date: "2026-11-24", time: "1016", strategyId: "intraday_scalp@10m" }, { fetchImpl });
    expect(r.status).toBe(200);
    const get = calls[1];
    expect(get.init.headers.Authorization).toBe("Bearer " + token);
    expect(get.init.credentials).toBe("omit");
    expect(get.init.cache).toBe("no-store");
    expect(JSON.stringify(calls)).not.toMatch(/X-Trade-Investigator-Access/i);
  });

  test("401 clears the in-memory session; revoke clears it too", async () => {
    const token = "t".repeat(43);
    const fetchImpl = async (url) => url.endsWith("/session/redeem")
      ? { ok: true, status: 200, json: async () => ({ accessToken: token }) }
      : { ok: false, status: 401, json: async () => ({ ok: false, error: "SESSION_INVALID_OR_EXPIRED" }), headers: { get: () => null } };
    await redeemPairingCode("p".repeat(32), { fetchImpl });
    await investigate({ date: "2026-11-24", time: "1016", strategyId: "intraday_scalp@10m" }, { fetchImpl });
    expect(hasSession()).toBe(false);
    await redeemPairingCode("p".repeat(32), { fetchImpl });
    await revokeSession({ fetchImpl });
    expect(hasSession()).toBe(false);
  });

  test("investigate refuses without a session", async () => {
    await expect(investigate({ date: "2026-11-24", time: "1016", strategyId: "x" })).rejects.toThrow("SESSION_REQUIRED");
  });
});
