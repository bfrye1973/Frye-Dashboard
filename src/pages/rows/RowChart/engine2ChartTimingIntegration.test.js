import {fetchEngine11AllPages} from "./engine11HistoricalAdapter";
import {getOHLC} from "../../../lib/ohlcClient";

const ds = {
  view: "UNADJUSTED",
  datasetVersion: "research-dataset:load-probe-fixture",
  priceBasisVersion: "price-basis:load-probe-fixture",
};
const mkRow = (id, seconds) => ({
  researchCandleId:id,
  timestampUtc:new Date(seconds * 1000).toISOString(),
  prices:{open:100, high:102, low:99, close:101},
  volume:17,
  sourceContract:"ESZ2026",
});
const page = (rows,nextCursor) => ({
  datasetVersion: ds.datasetVersion,
  priceBasisVersion: ds.priceBasisVersion,
  frame:"10m", direction:"DESC",
  researchOnly:true, structuralEligible:false, executionPriceAuthority:false,
  rows, nextCursor,
});

describe("Engine 2 five-frame loading instrumentation integration", () => {
  const savedFetch = global.fetch;
  afterEach(() => { global.fetch = savedFetch; });

  test("reports each validated Engine11 page and merge, without changing OHLC or order", async () => {
    const pages=[
      page([mkRow("new",1800), mkRow("mid",1200)],"NEXT"),
      page([mkRow("old",600)],null),
    ];
    global.fetch=jest.fn().mockImplementation(async () => ({
      ok:true, status:200, json: async () => pages.shift(),
    }));
    const metrics=[], sorted=[];
    const output=await fetchEngine11AllPages({
      frame:"10m", accessKey:"test-only",dataset:ds,
      includeProvenance:false,
      onPageMetric:x=>metrics.push(x),
      onSort:x=>sorted.push(x),
    });
    expect(output.bars).toEqual([
      {time:600,open:100,high:102,low:99,close:101,volume:17},
      {time:1200,open:100,high:102,low:99,close:101,volume:17},
      {time:1800,open:100,high:102,low:99,close:101,volume:17},
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(metrics.map(x=>x.rows)).toEqual([2,1]);
    for(const m of metrics) {
      expect(m.networkMs).toBeGreaterThanOrEqual(0);
      expect(m.parseMs).toBeGreaterThanOrEqual(0);
      expect(m.transformMs).toBeGreaterThanOrEqual(0);
      expect(m.mergeMs).toBeGreaterThanOrEqual(0);
    }
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toBeGreaterThanOrEqual(0);
  });

  test("1m regular OHLC exposes a single request with network, parse and normalization timing", async () => {
    global.fetch=jest.fn().mockResolvedValue({
      ok:true, status:200, json:async()=>[
        {time:1800,open:100,high:103,low:99,close:102,volume:12},
        {time:1200,open:99,high:100,low:98,close:100,volume:10},
      ],
    });
    let m=null;
    const result=await getOHLC("ES","1m",500,x=>{m=x;});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain("/api/v1/futures/ohlc?");
    expect(String(global.fetch.mock.calls[0][0])).toContain("timeframe=1m");
    expect(result.map(b=>b.time)).toEqual([1200,1800]);
    expect(m).toMatchObject({rawRows:2,rows:2});
    expect(m.networkMs).toBeGreaterThanOrEqual(0);
    expect(m.parseMs).toBeGreaterThanOrEqual(0);
    expect(m.normalizeMs).toBeGreaterThanOrEqual(0);
  });
});
