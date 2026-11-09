// Engine 16B research-only chart-side shadow of backend ABC milestone-1 geometry.
// This is NOT an Engine22 approved count, trade signal, or separate candle data feed.
// Uses only existing Engine11 chart-series candles, with the newest bar treated as forming.
export const ENGINE16_SUBMICRO_CHART_SCHEMA="engine16.submicro10m.chartResearch.v1";
const RATIOS=[0.618,1,1.272,1.618];
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const tick=x=>Math.round(x*4)/4;
const barsValid=bars=>Array.isArray(bars)&&bars.every((b,i)=>
  finite(b?.time)&&finite(b.open)&&finite(b.high)&&finite(b.low)&&finite(b.close)&&
  b.low<=b.high&&b.open>=b.low&&b.open<=b.high&&b.close>=b.low&&b.close<=b.high&&
  (i===0||b.time>bars[i-1].time));
// 10m series may have legitimate session gaps; no synthetic missing candles are inserted.
export function detectSubmicroChartAbc(chartBars,{contractVerified=false,pivotStrength=2,maxBars=240}={}) {
  const unavailable=(reason)=>({schema:ENGINE16_SUBMICRO_CHART_SCHEMA,reason,
    status:"UNAVAILABLE",candidate:null,alternatives:[],researchOnly:true,noExecution:true});
  if(!contractVerified)return unavailable("CONTRACT_NOT_VERIFIED");
  if(!Array.isArray(chartBars)||chartBars.length<9)return unavailable("INSUFFICIENT_CANDLES");
  const bars=chartBars.slice(-maxBars);
  if(!barsValid(bars))return unavailable("INVALID_OR_UNORDERED_CANDLES");
  if(!Number.isInteger(pivotStrength)||pivotStrength<1)return unavailable("INVALID_STRENGTH");
  const closed=bars.slice(0,-1); // latest candle might be forming; never use to confirm a pivot
  const pivots=[];
  for(let i=pivotStrength;i<closed.length-pivotStrength;i++){
    const b=closed[i],left=closed.slice(i-pivotStrength,i),right=closed.slice(i+1,i+1+pivotStrength);
    if([...left,...right].every(x=>b.high>x.high))
      pivots.push({id:b.time+":HIGH",kind:"HIGH",time:b.time,price:b.high,
        knownAtCandle:closed[i+pivotStrength].time});
    if([...left,...right].every(x=>b.low<x.low))
      pivots.push({id:b.time+":LOW",kind:"LOW",time:b.time,price:b.low,
        knownAtCandle:closed[i+pivotStrength].time});
  }
  let candidate=null;
  // Only latest sufficiently recent consecutive 0/A/B structure, mirroring backend v1.
  for(let i=0;i+2<pivots.length;i++){
    const [start,A,B]=pivots.slice(i,i+3);
    if(!(start.time<A.time&&A.time<B.time))continue;
    const bullish=start.kind==="LOW"&&A.kind==="HIGH"&&B.kind==="LOW"&&
      B.price>start.price&&B.price<A.price;
    const bearish=start.kind==="HIGH"&&A.kind==="LOW"&&B.kind==="HIGH"&&
      B.price<start.price&&B.price>A.price;
    if(!bullish&&!bearish)continue;
    const after=bars.filter(x=>x.time>B.time);
    // Candidate must be near current chart bar: no stale historic label posing as live.
    if(!after.length||after.length>48)continue;
    const direction=bullish?"UP":"DOWN",sign=bullish?1:-1;
    let extreme=after[0];
    const value=x=>bullish?x.high:x.low;
    for(const b of after)if(sign*(value(b)-value(extreme))>0)extreme=b;
    const extent=value(extreme);
    const range=extreme.high-extreme.low;
    const wick=bullish?extreme.high-Math.max(extreme.open,extreme.close):
      Math.min(extreme.open,extreme.close)-extreme.low;
    const wickEvidence=range>0&&wick/range>=0.55&&wick>=0.5;
    const reversal=closed.find(x=>x.time>extreme.time&&
      (bullish?x.close<extreme.close:x.close>extreme.close));
    const completed=wickEvidence&&Boolean(reversal);
    const measured=Math.abs(A.price-start.price);
    const targets=RATIOS.map(ratio=>({ratio,price:tick(B.price+sign*measured*ratio),
      rawPrice:B.price+sign*measured*ratio,measuredStart:start.id,measuredEnd:A.id,
      projectionOrigin:B.id}));
    candidate={candidateId:["ABC","ES","10m",start.id,A.id,B.id].join("|"),
      start,A,B,direction,extreme:{time:extreme.time,price:extent},
      status:completed?"C_COMPLETION_CANDIDATE":"C_DEVELOPING",
      label:completed?"C?":"C developing",
      knownAtCandle:completed?reversal.time:B.knownAtCandle,
      targets,structuralInvalidation:{price:B.price,status:"UNKNOWN",researchReferenceOnly:true},
      orthodoxSubdivisionsVerified:false,childEvidence:"UNKNOWN",
      cCompletionEvidence:completed?{wickCandle:extreme.time,reversalCandle:reversal.time}:null};
  }
  if(!candidate)return unavailable("NO_RECENT_0_A_B_CANDIDATE");
  return {schema:ENGINE16_SUBMICRO_CHART_SCHEMA,status:candidate.status,reason:null,
    candidate,alternatives:[{id:"W3_ALT|"+candidate.candidateId,
      kind:"SUBMICRO_W3_RESEARCH_ALTERNATIVE",sharedPivotId:candidate.B.id,
      authority:"UNRESOLVED_ENGINE22_CONTEXT"}],
    evidenceClock:"SOURCE_CANDLE_START_PLUS_CONFIRMED_RIGHT_BARS",
    researchOnly:true,noExecution:true};
}
