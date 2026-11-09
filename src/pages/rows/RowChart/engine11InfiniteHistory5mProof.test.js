import {createEngine115mInfiniteHistoryProof} from "./engine11InfiniteHistory5mProof";

const makeBars=(start,count)=>Array.from({length:count},(_,i)=>{
  const t=(start+i)*300;
  return {time:t,open:100+i,high:102+i,low:99+i,close:101+i,volume:10+i};
});
const page=(bars,nextCursor)=>{
  const rows=bars.slice().reverse().map((b,i)=>({
    researchCandleId:"test-"+b.time,
    frame:"5m",sourceContract:"ESZ2026",
    timestampUtc:new Date(b.time*1000).toISOString(),
    prices:{open:b.open,high:b.high,low:b.low,close:b.close},
    volume:b.volume,
  }));
  return {
    bars,
    page:{frame:"5m",researchOnly:true,structuralEligible:false,
      executionPriceAuthority:false, rows,nextCursor},
  };
};
function chartFixture(){
  const calls={priceSet:[],priceUpdate:[],volumeSet:[],volumeUpdate:[],ranges:[]};
  let listener=null,range={from:950,to:999};
  const chart={timeScale:()=>({
    subscribeVisibleLogicalRangeChange:cb=>{listener=cb;},
    unsubscribeVisibleLogicalRangeChange:cb=>{if(listener===cb)listener=null;},
    getVisibleRange:()=>({...range}),
    setVisibleRange:r=>{calls.ranges.push(r);range={...r};},
  })};
  const priceSeries={
    setData:d=>calls.priceSet.push(d),
    update:b=>calls.priceUpdate.push(b),
    barsInLogicalRange:r=>({barsBefore:r.from}),
  };
  const volumeSeries={
    setData:d=>calls.volumeSet.push(d),
    update:b=>calls.volumeUpdate.push(b),
  };
  return {chart,priceSeries,volumeSeries,calls,trigger:r=>listener?.(r),isSubscribed:()=>!!listener};
}

describe("Engine11 five-minute Infinite History: isolated chart contract",()=>{
  test("first verified 1,000 candles display without awaiting 472 pages",async()=>{
    const ui=chartFixture();
    let requests=0,cached=null;
    const fetchPage=jest.fn(async()=>{requests++;return page(makeBars(1000,1000),"OLDER");});
    const p=createEngine115mInfiniteHistoryProof({
      ...ui,fetchPage,onWorkingBars:bars=>cached=bars,ownerKey:"test-not-real",
    });
    expect(await p.start()).toBe(true);
    expect(requests).toBe(1);
    expect(ui.calls.priceSet).toHaveLength(1);
    expect(ui.calls.priceSet[0]).toHaveLength(1000);
    expect(cached).toHaveLength(1000);
    expect(p.snapshot()).toMatchObject({
      started:true,pages:1,loadedBars:1000,nextCursor:"OLDER",
      terminalContract:"ESZ2026",
    });
    expect(fetchPage.mock.calls[0][0]).toMatchObject({cursor:null,frame:"5m"});
    p.destroy();
  });

  test("owner nodes map to real candle opens as paged history becomes available",async()=>{
    const ui=chartFixture();
    const responses=[page(makeBars(1000,1000),"OLDER"),page(makeBars(0,1000),null)];
    let i=0;
    const p=createEngine115mInfiniteHistoryProof({...ui,fetchPage:async()=>responses[i++]});
    expect(p.candleOpenAt(1200*300)).toBeNull();
    expect(await p.start()).toBe(true);
    expect(p.candleOpenAt(1200*300+120)).toBe(1200*300);
    expect(p.candleOpenAt(20*300)).toBeNull();
    expect(await p.loadOlder()).toBe(true);
    expect(p.candleOpenAt(20*300+250)).toBe(20*300);
    expect(p.candleOpenAt(-100)).toBeNull();
    p.destroy();
    expect(p.candleOpenAt(20*300)).toBeNull();
  });

  test("scroll loads an older page only once and preserves visible time range",async()=>{
    const ui=chartFixture();
    let next=0;
    const responses=[page(makeBars(1000,1000),"OLDER"),page(makeBars(0,1000),null)];
    const fetchPage=jest.fn(async()=>responses[next++]);
    const p=createEngine115mInfiniteHistoryProof({...ui,fetchPage});
    expect(await p.start()).toBe(true);
    ui.trigger({from:500,to:550});
    expect(fetchPage).toHaveBeenCalledTimes(1);
    ui.trigger({from:10,to:60});
    // async request starts immediately, but the resolution awaits the microtask.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(p.snapshot().loadedBars).toBe(2000);
    expect(ui.calls.priceSet).toHaveLength(2);
    expect(ui.calls.priceSet[1][0].time).toBe(0);
    expect(ui.calls.priceSet[1].at(-1).time).toBe(1999*300);
    expect(ui.calls.ranges.at(-1)).toEqual({from:950,to:999});
    expect(ui.isSubscribed()).toBe(true);
    p.destroy();
    expect(ui.isSubscribed()).toBe(false);
  });

  test("LIVE uses update(), survives an older page committed during retrieval",async()=>{
    const ui=chartFixture();
    let releaseOlder;
    const olderBlocked=new Promise(resolve=>{releaseOlder=resolve;});
    let requests=0;
    const fetchPage=async()=>{
      requests++;
      if(requests===1)return page(makeBars(1000,1000),"OLDER");
      await olderBlocked;
      return page(makeBars(0,1000),null);
    };
    const p=createEngine115mInfiniteHistoryProof({...ui,fetchPage});
    expect(await p.start()).toBe(true);
    const pending=p.loadOlder();
    const newBar={time:2000*300,open:50,high:51,low:49,close:50.5,volume:7};
    expect(p.updateLive(newBar,{contractVerified:false})).toBe(false);
    expect(p.updateLive({...newBar,time:1999*300},{contractVerified:true})).toBe(false);
    expect(p.updateLive(newBar,{contractVerified:true})).toBe(true);
    expect(ui.calls.priceUpdate).toEqual([{
      time:2000*300,open:50,high:51,low:49,close:50.5,
    }]);
    const forming={...newBar,close:50.75};
    expect(p.updateLive(forming,{contractVerified:true})).toBe(true);
    releaseOlder();
    expect(await pending).toBe(true);
    expect(ui.calls.priceSet).toHaveLength(2);
    expect(ui.calls.priceSet.at(-1)).toHaveLength(2001);
    expect(ui.calls.priceSet.at(-1).at(-1)).toEqual({
      time:2000*300,open:50,high:51,low:49,close:50.75,
    });
    expect(p.snapshot().latestTime).toBe(2000*300);
    p.destroy();
  });

  test("bad overlapping page fails closed without resetting history",async()=>{
    const ui=chartFixture(),errors=[];
    let n=0;
    const fetchPage=async()=>{
      n++;
      return n===1?page(makeBars(1000,1000),"OLDER"):
        page(makeBars(1800,300),null);
    };
    const p=createEngine115mInfiniteHistoryProof({
      ...ui,fetchPage,onError:e=>errors.push(e.message),
    });
    expect(await p.start()).toBe(true);
    expect(await p.loadOlder()).toBe(false);
    expect(ui.calls.priceSet).toHaveLength(1);
    expect(p.snapshot().loadedBars).toBe(1000);
    expect(errors).toEqual(["ENGINE11_PROOF_OVERLAPPING_OLDER_PAGE"]);
    p.destroy();
  });

  test("UI 25k cache never truncates the actual 26k plotted history",async()=>{
    const ui=chartFixture();
    let n=25,latestCache=[];
    const fetchPage=jest.fn(async()=>{
      const bars=makeBars(n*1000,1000);
      const next=n===0?null:String(n-1);
      n--;
      return page(bars,next);
    });
    const p=createEngine115mInfiniteHistoryProof({
      ...ui,fetchPage,onWorkingBars:bs=>latestCache=bs,
    });
    expect(await p.start()).toBe(true);
    for(let i=0;i<25;i++)expect(await p.loadOlder()).toBe(true);
    expect(p.snapshot().loadedBars).toBe(26000);
    expect(ui.calls.priceSet.at(-1)).toHaveLength(26000);
    expect(latestCache).toHaveLength(25000);
    expect(fetchPage).toHaveBeenCalledTimes(26);
    // The old RowChart would re-seed from the 25k cache during LIVE gap
    // reconciliation, silently deleting the oldest 1,000 plotted candles.
    const plottedBeforeLive = ui.calls.priceSet.length;
    const live = {time:26000 * 300, open:50,high:51,low:49,close:50.5,volume:7};
    expect(p.updateLive(live,{contractVerified:true})).toBe(true);
    expect(ui.calls.priceSet).toHaveLength(plottedBeforeLive);
    expect(ui.calls.priceUpdate.at(-1).time).toBe(26000*300);
    expect(p.snapshot().loadedBars).toBe(26001);
    expect(p.snapshot().earliestTime).toBe(0);
    expect(latestCache).toHaveLength(25000);
    p.destroy();
  });

  test("recent 5m bridge fills gap, never modifies archive overlap, and preserves LIVE collision",async()=>{
    const ui=chartFixture();
    const original=makeBars(1000,1000);
    const fetchPage=jest.fn(async()=>page(original,"older"));
    const p=createEngine115mInfiniteHistoryProof({...ui,fetchPage});
    expect(await p.start()).toBe(true);
    const originalLast=ui.calls.priceSet[0].at(-1);
    const live={time:2003*300,open:88,high:90,low:86,close:89,volume:8};
    expect(p.updateLive(live,{contractVerified:true})).toBe(true);
    const recent=[...makeBars(1997,3),...makeBars(2000,7)];
    const setCount=ui.calls.priceSet.length;
    expect(p.appendVerifiedRecent(recent,{contractVerified:false})).toBe(0);
    expect(ui.calls.priceSet).toHaveLength(setCount);
    expect(p.appendVerifiedRecent(recent,{contractVerified:true})).toBe(6);
    expect(p.snapshot().loadedBars).toBe(1007);
    expect(p.snapshot().earliestTime).toBe(1000*300);
    expect(p.snapshot().latestTime).toBe(2006*300);
    const plotted=ui.calls.priceSet.at(-1);
    expect(plotted[999]).toEqual(originalLast);
    expect(plotted.find(b=>b.time===live.time).close).toBe(live.close);
    expect(plotted[1000].time).toBe(2000*300);
    expect(ui.calls.ranges.at(-1)).toEqual({from:950,to:999});
    expect(fetchPage).toHaveBeenCalledTimes(1);
    p.destroy();
  });

  test("recent 10m verifies contract gate and retains older-on-scroll pagination after bridge",async()=>{
    const ui=chartFixture();
    const factor=2;
    const original=makeBars(1000,1000).map(b=>({...b,time:b.time*factor}));
    const prior=makeBars(0,1000).map(b=>({...b,time:b.time*factor}));
    // The older shared fixture is stamped 5m; adapt the page context to 10m.
    const fixture10m=(bars,cursor)=>({
      ...page(bars,cursor),page:{...page(bars,cursor).page,frame:"10m"}
    });
    const fetchPage=jest.fn()
      .mockImplementationOnce(async()=>fixture10m(original,"older"))
      .mockImplementationOnce(async()=>fixture10m(prior,null));
    const p=createEngine115mInfiniteHistoryProof({...ui,frame:"10m",fetchPage});
    expect(await p.start()).toBe(true);
    const recent=makeBars(2000,12).map(b=>({...b,time:b.time*factor}));
    expect(p.appendVerifiedRecent(recent,{contractVerified:true})).toBe(12);
    expect(p.snapshot().loadedBars).toBe(1012);
    expect(await p.loadOlder()).toBe(true);
    expect(p.snapshot().loadedBars).toBe(2012);
    expect(p.snapshot().earliestTime).toBe(0);
    expect(p.snapshot().latestTime).toBe(2011*600);
    expect(ui.calls.priceSet.at(-1)).toHaveLength(2012);
    p.destroy();
  });
});
