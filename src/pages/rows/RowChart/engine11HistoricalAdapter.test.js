import { fetchEngine11AllPages, fetchEngine11Page } from "./engine11HistoricalAdapter";

const dataset = {
  view: "UNADJUSTED",
  datasetVersion: "research-dataset:fixture",
  priceBasisVersion: "price-basis:fixture",
};

const row = (id, time, contract) => ({
  researchCandleId: id,
  frame: "10m",
  sourceContract: contract,
  timestampUtc: new Date(time * 1000).toISOString(),
  prices: { open: 100, high: 102, low: 99, close: 101 },
  volume: 20,
});

describe("Engine 11 source contract provenance", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  test("one page preserves latest physical contract", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200, ok: true,
      json: async () => ({
        datasetVersion: dataset.datasetVersion,
        priceBasisVersion: dataset.priceBasisVersion,
        frame: "10m", direction: "DESC",
        researchOnly: true, structuralEligible: false, executionPriceAuthority: false,
        rows: [row("latest", 2000, "ESZ2026"), row("older", 1400, "ESU2026")],
        nextCursor: null,
      }),
    });
    const result = await fetchEngine11Page({
      dataset, frame: "10m", accessKey: "fixture-owner-token",
    });
    expect(result.lastSourceContract).toBe("ESZ2026");
    expect(result.bars).toHaveLength(2);
  });

  test("all-pages mode retains terminal contract without retaining row provenance", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200, ok: true,
      json: async () => ({
        datasetVersion: dataset.datasetVersion,
        priceBasisVersion: dataset.priceBasisVersion,
        frame: "10m", direction: "DESC",
        researchOnly: true, structuralEligible: false, executionPriceAuthority: false,
        rows: [row("latest", 2000, "ESZ2026"), row("older", 1400, "ESU2026")],
        nextCursor: null,
      }),
    });
    const result = await fetchEngine11AllPages({
      dataset, frame: "10m", accessKey: "fixture-owner-token", includeProvenance: false,
    });
    expect(result.rows).toBe(2);
    expect(result.lastSourceContract).toBe("ESZ2026");
    expect(result.provenanceRows).toEqual([]);
    expect(result.bars[0].time).toBe(1400);
  });
});
