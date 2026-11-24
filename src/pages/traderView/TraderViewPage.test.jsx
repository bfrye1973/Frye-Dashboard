import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import { TraderViewView } from "./TraderViewPage";
import live from "./fixtures/live-2026-11-24T0018Z.traderView.v1.json";

const clone = (x) => JSON.parse(JSON.stringify(x));
const markup = (data, extra = {}) => renderToStaticMarkup(<TraderViewView data={data} {...extra} />);

test("live sample renders NO_TRADE from Engine 6 and the pipeline as given", () => {
  const view = markup(live);
  expect(view).toContain('data-verdict="NO_TRADE"');
  expect(view).toContain("NO TRADE — WAITING");
  expect(view).toContain("Engine 6: stand down.");
  // pipeline statuses are copied from the contract, in order
  const pipe = [...view.matchAll(/data-pipe="(\w+)".*?data-status="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  expect(pipe).toEqual(["location:READY", "reaction:WAITING", "participation:WAITING", "permission:BLOCKED"]);
  // market direction chip replaces the old Bias chip
  expect(view).toContain("Market direction");
  expect(view).toContain("N · Neutral · 58.52");
  expect(view).not.toContain("Short watch");
  expect(view).toContain("SHORT (watch only)");
});

test("Engine 3 shows canonical answer with timeframes as evidence only", () => {
  const view = markup(live);
  expect(view).toContain("No reaction yet");
  expect(view).toContain("Timeframe evidence only");
  expect(view).toContain("Pushing higher");
});

test("Engine 4 shadow number is tagged Shadow; legacy ratio only in details", () => {
  const view = markup(live);
  expect(view).toMatch(/5-min vs normal<span class="tv-chip tv-chip--SHADOW"/);
  expect(view).toContain("Legacy bar-to-bar ratio (details only)");
});

test("Engine 22 far-level warning and market card titled groups", () => {
  const view = markup(live);
  expect(view).toContain("more than 5% from price");
  expect(view).toContain("ES price trend (ES Master lights)");
  expect(view).toContain("Market breadth (whole-market internals)");
});

test("PAPER_ALLOWED renders the allowed verdict from the contract", () => {
  const d = clone(live);
  d.verdict = { state: "PAPER_ALLOWED", label: "PAPER ALLOWED", plainEnglish: "Engine 6: paper allowed.", source: "Engine 6" };
  d.pipeline[3].status = "READY";
  const view = markup(d);
  expect(view).toContain('data-verdict="PAPER_ALLOWED"');
  expect(view).toContain("tv-verdict--allowed");
  expect(view).toContain("PAPER ALLOWED");
});

test("STALE shows the warning banner and STALE badge", () => {
  const d = clone(live);
  d.freshness.status = "STALE";
  const view = markup(d);
  expect(view).toContain('role="alert"');
  expect(view).toContain("tv-chip--STALE");
});

test("missing engines render UNAVAILABLE cards without crashing", () => {
  const d = clone(live);
  delete d.sections.reaction;
  d.sections.structure = null;
  // backend contract shape for a missing engine
  d.sections.permission = { ...d.sections.permission, status: "INFO", state: "UNAVAILABLE", label: "Unavailable", facts: [] };
  d.marketDirection = { state: "UNAVAILABLE" };
  const view = markup(d);
  const unavailable = view.match(/data-status="UNAVAILABLE"/g) || [];
  expect(unavailable.length).toBeGreaterThanOrEqual(3);
  expect(view).toContain("Unavailable — this engine");
});

test("no data: loading and unavailable states", () => {
  expect(markup(null, { loading: true })).toContain("Loading Trader View");
  expect(markup(null, { err: "HTTP 410" })).toContain("Trader View unavailable: HTTP 410");
});

test("last-good data stays visible when a refresh fails", () => {
  const view = markup(live, { err: "HTTP 502" });
  expect(view).toContain("Showing the last good reading");
  expect(view).toContain("NO TRADE — WAITING");
});

test("phone layout rules exist at the shell breakpoints", () => {
  const css = fs.readFileSync(path.join(__dirname, "traderView.css"), "utf8");
  expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.tv-cards \{ grid-template-columns: 1fr; \}/);
  expect(css).toMatch(/@media \(max-width: 980px\)/);
  expect(css).toMatch(/min-height: 44px/);
});

test("frontend never calls any endpoint but trader-view and has no inline colors", () => {
  const dir = __dirname;
  const src = ["TraderViewPage.jsx", "TraderComponents.jsx"].map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  const hook = fs.readFileSync(path.join(dir, "../../hooks/useTraderView.js"), "utf8");
  expect(src).not.toMatch(/fetch\(/);
  expect(hook).toMatch(/\/api\/v1\/trader-view\?symbol=/);
  expect(hook).not.toMatch(/dashboard-snapshot|market-meter/);
  expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
});

test("mock mode labels the badge SAMPLE, never LIVE", () => {
  const view = markup(live, { mock: true });
  expect(view).toContain("tv-chip--SAMPLE");
  expect(view).not.toContain("tv-chip--LIVE");
  expect(markup(live)).toContain("tv-chip--LIVE");
});
