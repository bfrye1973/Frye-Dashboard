import {assessOwnerNodeAgainstLoadedCandle,summarizeNodeCandleAlignment}
  from "./ownerNodeCandleAlignment";
import {containingLoadedCandleOpen} from "./intermediateMinorReview";

// Exact current Engine22 Strategy-card W1/W2 research timestamps and prices.
// This is test evidence only: the real chart still reads the LIVE snapshot.
const nodes=[
 {label:"W1 Low",timeSec:Date.parse("2026-11-09T08:00:00Z")/1000,price:7390.25},
 {label:"W1 High",timeSec:Date.parse("2026-11-09T13:00:00Z")/1000,price:7476},
 {label:"W2 research anchor",timeSec:Date.parse("2026-11-09T13:20:00Z")/1000,price:7449.25},
];
const bar=(at,lo,hi)=>({time:Date.parse(at)/1000,open:lo,high:hi,low:lo,close:hi});
const bars=[
 bar("2026-11-09T08:00:00Z",7388,7402),
 bar("2026-11-09T13:00:00Z",7465,7478),
 bar("2026-11-09T13:10:00Z",7455,7468),
 bar("2026-11-09T13:20:00Z",7447,7460),
];
const mapper=node=>containingLoadedCandleOpen(node.timeSec,"10m",bars);

test("Submicro: one exact 10m candle opening for each Engine22 Strategy timestamp",()=>{
 expect(nodes.map(mapper)).toEqual([
  Date.parse("2026-11-09T08:00:00Z")/1000,
  Date.parse("2026-11-09T13:00:00Z")/1000,
  Date.parse("2026-11-09T13:20:00Z")/1000,
 ]);
 expect(new Set(nodes.map(mapper)).size).toBe(3);
});

test("Submicro: chart positions use owner price without snapping to nearby OHLC extrema",()=>{
 expect(summarizeNodeCandleAlignment(nodes,"10m",bars,mapper)).toEqual({
  mapped:3,total:3,priceWithin:3,priceOutside:0,priceUnavailable:0,
 });
 expect(nodes.map(x=>x.price)).toEqual([7390.25,7476,7449.25]);
});

test("Submicro: price outside its OWN candle is reported, never changed or re-timed",()=>{
 const differentSource=[
  bar("2026-11-09T08:00:00Z",7391.25,7402),
  bar("2026-11-09T13:00:00Z",7465,7471.25),
  bar("2026-11-09T13:20:00Z",7451.75,7460),
 ];
 const map=node=>containingLoadedCandleOpen(node.timeSec,"10m",differentSource);
 expect(summarizeNodeCandleAlignment(nodes,"10m",differentSource,map)).toEqual({
  mapped:3,total:3,priceWithin:0,priceOutside:3,priceUnavailable:0,
 });
 expect(nodes.map(x=>x.price)).toEqual([7390.25,7476,7449.25]);
});

test("missing loaded OHLC is UNKNOWN, never a confirmed price-aligned anchor",()=>{
 const index=bars.map(b=>({time:b.time}));
 expect(assessOwnerNodeAgainstLoadedCandle(nodes[1],"10m",index,mapper(nodes[1])))
  .toBe("CANDLE_UNAVAILABLE");
 expect(assessOwnerNodeAgainstLoadedCandle(nodes[1],"10m",bars,NaN))
  .toBe("CANDLE_UNAVAILABLE");
});

test("same 30m candle for W1 High and W2 is not treated as two invented candles",()=>{
 const thirty=[bar("2026-11-09T13:00:00Z",7440,7480)];
 expect(containingLoadedCandleOpen(nodes[1].timeSec,"30m",thirty))
  .toBe(containingLoadedCandleOpen(nodes[2].timeSec,"30m",thirty));
});
