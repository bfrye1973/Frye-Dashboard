import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Engine18LivePanel from "./Engine18LivePanel";
import fixture from "../../pages/engine18/engine18LiveFixture.json";

const markup = (props) => renderToStaticMarkup(<Engine18LivePanel {...props} />);

test("renders the current read, fixed level cards and the owner break rule text", () => {
  const view = markup({ snapshot: fixture.snapshot, synthetic: true });
  expect(view).toMatch(/data-testid="current-read-line"[^>]*>[^<]*absorbing/i);
  const cards = view.match(/data-testid="level-card"/g) || [];
  expect(cards.length).toBe(fixture.snapshot.lines.length);
  expect(view).toContain("full-body 1-min candle");
  expect(view).toContain("PREVIEW (synthetic data)");
  expect(view).not.toMatch(/\b(buy now|sell now|enter long|enter short)\b/i);
});

test("zero lines and warming up are valid states", () => {
  expect(markup({ snapshot: { ...fixture.snapshot, lines: [], noLineReason: "NO_EVIDENCE" } })).toContain("Zero lines is a valid answer");
  expect(markup({ snapshot: null })).toContain("warming up");
});
