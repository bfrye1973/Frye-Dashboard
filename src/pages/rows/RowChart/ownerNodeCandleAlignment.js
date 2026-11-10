// Inspect the SAME OHLC bars already loaded in the LIVE Engine2 chart.
// Never fetch another provider, move an Engine22 node, change its ES price,
// or use candle extrema to replace owner-supplied anchors.
import {containingLoadedCandleOpen} from "./intermediateMinorReview";

export function assessOwnerNodeAgainstLoadedCandle(anchor,timeframe,bars,mappedCandleOpen){
  if(!Number.isFinite(anchor?.timeSec)||!Number.isFinite(anchor?.price)||
    !Array.isArray(bars)||!Number.isFinite(mappedCandleOpen))
    return "CANDLE_UNAVAILABLE";
  const sourceCandleOpen=containingLoadedCandleOpen(anchor.timeSec,timeframe,bars);
  if(!Number.isFinite(sourceCandleOpen)||sourceCandleOpen!==mappedCandleOpen)
    return "CANDLE_UNAVAILABLE";
  // For full Engine11 time-only historical indexes, a real OHLC bar may
  // not be present in the current React working window. Never guess it.
  const bar=bars.find(b=>Number(b.time)===sourceCandleOpen);
  if(!bar||!Number.isFinite(Number(bar.high))||
    !Number.isFinite(Number(bar.low))||Number(bar.low)>Number(bar.high))
    return "CANDLE_UNAVAILABLE";
  const lo=Number(bar.low),hi=Number(bar.high);
  return anchor.price>=lo&&anchor.price<=hi
    ?"PRICE_WITHIN_CANDLE":"PRICE_OUTSIDE_CANDLE";
}

export function summarizeNodeCandleAlignment(anchors,timeframe,priceBars,openAt){
  const summary={mapped:0,total:anchors.length,priceWithin:0,priceOutside:0,
    priceUnavailable:0};
  for(const a of anchors){
    const open=openAt(a);
    if(!Number.isFinite(open))continue;
    summary.mapped++;
    const alignment=assessOwnerNodeAgainstLoadedCandle(a,timeframe,priceBars,open);
    if(alignment==="PRICE_WITHIN_CANDLE")summary.priceWithin++;
    else if(alignment==="PRICE_OUTSIDE_CANDLE")summary.priceOutside++;
    else summary.priceUnavailable++;
  }
  return summary;
}
