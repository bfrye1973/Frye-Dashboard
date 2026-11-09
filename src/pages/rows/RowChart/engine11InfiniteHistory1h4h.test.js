import {createEngine115mInfiniteHistoryProof} from "./engine11InfiniteHistory5mProof";

const mk=(frame,start,count)=>Array.from({length:count},(_,i)=>{
  const t=(start+i)*({"1h":3600,"4h":14400,"1d":86400})[frame];
  return {time:t,open:4000+i,high:4003+i,low:3998+i,
    close:4001+i,volume:20+i};
});
const page=(frame,bars,nextCursor)=>({
  bars,
  page:{frame,researchOnly:true,structuralEligible:false,
    executionPriceAuthority:false,nextCursor,
    rows:[...bars].reverse().map(b=>({sourceContract:"ESZ2026",time:b.time})),
  },
});
function fixture(){
  let cb=null;let range={from:1,to:100};
  const price=[],volume=[],live=[];
  const chart={timeScale:()=>({
    subscribeVisibleLogicalRangeChange:fn=>cb=fn,
    unsubscribeVisibleLogicalRangeChange:fn=>{if(fn===cb)cb=null},
    getVisibleRange:()=>({...range}),
    setVisibleRange:v=>range={...v},
  })};
  const priceSeries={setData:v=>price.push(v),update:v=>live.push(v),
    barsInLogicalRange:v=>({barsBefore:v.from})};
  const volumeSeries={setData:v=>volume.push(v),update:()=>{}};
  return {chart,priceSeries,volumeSeries,price,volume,live,
    range:()=>range,scroll:v=>cb?.(v)};
}
for(const frame of ["1h","4h","1d"]){
  describe("Engine11B authentic page contract "+frame,()=>{
    test("first verified 1000 rows render with one request, scroll gets exactly one older page",async()=>{
      const v=fixture();
      const request=jest.fn()
        .mockResolvedValueOnce(page(frame,mk(frame,1000,1000),"older"))
        .mockResolvedValueOnce(page(frame,mk(frame,0,1000),null));
      const p=createEngine115mInfiniteHistoryProof({...v,frame,fetchPage:request,ownerKey:"test"});
      expect(await p.start()).toBe(true);
      expect(request).toHaveBeenCalledTimes(1);
      expect(v.price[0]).toHaveLength(1000);
      expect(p.snapshot()).toMatchObject({
        loadedBars:1000,archiveLastTime:1999*({"1h":3600,"4h":14400,"1d":86400})[frame],
        terminalContract:"ESZ2026",
      });
      const secs=({"1h":3600,"4h":14400,"1d":86400})[frame];
      expect(p.candleOpenAt(1500*secs+25)).toBe(1500*secs);
      expect(p.candleOpenAt(50*secs)).toBeNull();
      const after=mk(frame,2000,1)[0];
      expect(p.updateLive(after,{contractVerified:false})).toBe(false);
      expect(p.updateLive(after,{contractVerified:true})).toBe(true);
      expect(await p.loadOlder()).toBe(true);
      expect(request).toHaveBeenCalledTimes(2);
      expect(v.price.at(-1)).toHaveLength(2001);
      expect(v.price.at(-1).at(-1).time).toBe(after.time);
      expect(p.candleOpenAt(50*secs+100)).toBe(50*secs);
      p.destroy();
    });
    test("contract-gated bridge fills older-to-current gap without mutating archive or LIVE close",async()=>{
      const v=fixture();const seed=mk(frame,1000,1000);
      const p=createEngine115mInfiniteHistoryProof({...v,frame,
        fetchPage:async()=>page(frame,seed,null)});
      expect(await p.start()).toBe(true);
      const secs=({"1h":3600,"4h":14400,"1d":86400})[frame];
      const live={time:2004*secs,open:9999,high:10001,low:9998,close:10000,volume:12};
      expect(p.updateLive(live,{contractVerified:true})).toBe(true);
      expect(p.appendVerifiedRecent(mk(frame,2000,10),{contractVerified:false})).toBe(0);
      expect(p.appendVerifiedRecent(mk(frame,2000,10),{contractVerified:true})).toBe(9);
      expect(v.price.at(-1)[999]).toMatchObject({time:seed[999].time,
        open:seed[999].open,close:seed[999].close});
      expect(v.price.at(-1).find(b=>b.time===live.time).close).toBe(10000);
      expect(p.snapshot().latestTime).toBe(2009*secs);
      p.destroy();
    });
  });
}
