import {
  fetchEngine11AllPages,
} from "./engine11HistoricalAdapter";

function row(id, ts, close) {
  return {
    researchCandleId: id,
    frame: "1h",
    priceBasisVersion: "basis:test",
    structuralEligible: false,
    executionPriceAuthority: false,
    timestampUtc: ts,
    prices: {
      open: close - 1,
      high: close + 1,
      low: close - 2,
      close,
    },
    volume: 10,
  };
}

const dataset = {
  view: "UNADJUSTED",
  datasetVersion: "research-dataset:test",
  priceBasisVersion: "basis:test",
};

function page(requestCursor, nextCursor, rows) {
  return {
    datasetVersion: dataset.datasetVersion,
    priceBasisVersion: dataset.priceBasisVersion,
    frame: "1h",
    direction: "DESC",
    requestCursor,
    nextCursor,
    researchOnly: true,
    structuralEligible: false,
    executionPriceAuthority: false,
    rows,
  };
}

test("walks the complete cursor chain and returns chronological bars", async () => {
  const responses = [
    page(null, "p2", [
      row("c3", "2026-01-03T00:00:00Z", 103),
      row("c2", "2026-01-02T00:00:00Z", 102),
    ]),
    page("p2", null, [
      row("c1", "2026-01-01T00:00:00Z", 101),
    ]),
  ];

  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => responses.shift(),
  }));

  const out = await fetchEngine11AllPages({
    frame: "1h",
    accessKey: "owner-test",
    dataset,
    includeProvenance: false,
  });

  expect(out.pages).toBe(2);
  expect(out.rows).toBe(3);
  expect(out.bars.map((x) => x.close)).toEqual([101, 102, 103]);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(global.fetch.mock.calls[1][0]).toContain("cursor=p2");
});

test("fails closed on duplicate timestamps across pages", async () => {
  const responses = [
    page(null, "p2", [row("c2", "2026-01-02T00:00:00Z", 102)]),
    page("p2", null, [row("c1", "2026-01-02T00:00:00Z", 101)]),
  ];

  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => responses.shift(),
  }));

  await expect(
    fetchEngine11AllPages({
      frame: "1h",
      accessKey: "owner-test",
      dataset,
      includeProvenance: false,
    })
  ).rejects.toThrow("ENGINE11_DUPLICATE_TIMESTAMP");
});
