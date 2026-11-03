import {createEngine115mInfiniteHistoryProof} from "./engine11InfiniteHistory5mProof";

function testPage(frame, first, count, nextCursor) {
  const seconds = frame === "10m" ? 600 : 300;
  const bars = Array.from({length: count}, (_, i) => ({
    time: (first + i) * seconds, open: 5000 + i,
    high: 5001 + i, low: 4999 + i, close: 5000.5 + i, volume: 5,
  }));
  return {
    bars,
    page: {
      frame, researchOnly: true, structuralEligible: false,
      executionPriceAuthority: false, nextCursor,
      rows: [...bars].reverse().map(b => ({sourceContract:"ESZ2026",time:b.time})),
    },
  };
}

function makeChart() {
  let listener = null;
  let visible = {from: 100 * 600, to: 900 * 600};
  const priceSets = [], priceUpdates = [], ranges = [];
  const volumeSets = [];
  const timeScale = {
    subscribeVisibleLogicalRangeChange: fn => {listener = fn;},
    unsubscribeVisibleLogicalRangeChange: fn => {if (listener === fn) listener = null;},
    getVisibleRange: () => ({...visible}),
    setVisibleRange: r => {visible = r; ranges.push(r);},
  };
  return {
    chart: {timeScale: () => timeScale},
    priceSeries: {
      setData: rows => priceSets.push(rows),
      update: bar => priceUpdates.push(bar),
      barsInLogicalRange: r => ({barsBefore:r.from}),
    },
    volumeSeries: {setData:rows=>volumeSets.push(rows),update:()=>{}},
    priceSets, priceUpdates, volumeSets, ranges,
    onScroll: range => listener?.(range),
    connected: () => !!listener,
  };
}

describe("Engine11B isolated ES 10m recent-first RowChart data contract", () => {
  test("loads the latest page without fetching 236 pages", async () => {
    const ui = makeChart();
    const fetchPage = jest.fn(async () => testPage("10m", 1000, 1000, "prev"));
    const pager = createEngine115mInfiniteHistoryProof({
      ...ui, frame:"10m", fetchPage, ownerKey:"fixture-only",
    });
    expect(await pager.start()).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage.mock.calls[0][0]).toMatchObject({frame:"10m",cursor:null});
    expect(ui.priceSets[0]).toHaveLength(1000);
    expect(pager.snapshot().terminalContract).toBe("ESZ2026");
    pager.destroy();
  });

  test("loads older 10m candles once on scroll without removing live candles", async () => {
    const ui = makeChart();
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(testPage("10m", 1000, 1000, "prev"))
      .mockResolvedValueOnce(testPage("10m", 0, 1000, null));
    const pager = createEngine115mInfiniteHistoryProof({
      ...ui, frame:"10m", fetchPage, ownerKey:"fixture-only",
    });
    expect(await pager.start()).toBe(true);
    const live = {time:2000*600,open:300,high:301,low:299,close:300.5,volume:3};
    expect(pager.updateLive(live, {contractVerified:true})).toBe(true);
    expect(ui.priceUpdates).toHaveLength(1);
    expect(await pager.loadOlder()).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(ui.priceSets.at(-1)).toHaveLength(2001);
    expect(ui.priceSets.at(-1).at(-1).time).toBe(live.time);
    expect(ui.ranges.at(-1)).toEqual({from:100*600,to:900*600});
    pager.destroy();
    expect(ui.connected()).toBe(false);
  });

  test("rejects an incorrect timeframe page without clearing displayed history", async () => {
    const ui = makeChart();
    const errors = [];
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(testPage("10m",1000,1000,"prev"))
      .mockResolvedValueOnce(testPage("5m",0,1000,null));
    const pager = createEngine115mInfiniteHistoryProof({
      ...ui, frame:"10m", fetchPage, onError:e=>errors.push(e.message),
    });
    expect(await pager.start()).toBe(true);
    expect(await pager.loadOlder()).toBe(false);
    expect(ui.priceSets).toHaveLength(1);
    expect(errors).toEqual(["ENGINE11_PAGER_PAGE_CONTEXT"]);
    pager.destroy();
  });
});
