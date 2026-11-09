// Owner-updated Engine22 master sheet snapshots (read-only chart presentation).
// Source: connected Engine22 Seven Degree Elliott Wave Master (Nov 8, 2026):
// Intermediate!A2:F4 and Minor W1-W2 Proposed!A2:M13.
// Research levels are NOT confirmed market touches, orders, or Engine22 count promotions.
const az=(date,time)=>Math.floor(Date.parse(date+"T"+time+":00-07:00")/1000);
const anchor=(degree,label,date,time,price,classification="HISTORICAL")=>Object.freeze({
  degree,label,date,time,price,classification,timezone:"America/Phoenix",timeSec:az(date,time),
});
export const INTERMEDIATE_REVIEW_ANCHORS=Object.freeze([
  anchor("intermediate","W1 starting low","2025-04-09","07:00",4877),
  anchor("intermediate","W1 ending high","2026-01-28","10:00",7044),
  anchor("intermediate","W2 ending low","2026-03-31","03:00",6345),
]);
export const MINOR_REVIEW_ANCHORS=Object.freeze([
  // Owner corrected invalid 2026-04-31 to 2026-04-30 in
  // connected sheet; direct re-read verified Apr 30, 17:00 AZ @6342.
  anchor("minor","W1 starting low","2026-04-30","17:00",6342,"OWNER RESEARCH"),
  anchor("minor","W1 ending high","2026-08-13","06:00",7841.25,"OWNER RESEARCH"),
  // W2 low near 7325 is NOT a confirmed time/price pivot per shared
  // evidence. Its '16:00' field conflicts with UNKNOWN-time notes.
]);
export const MINOR_W2_RESEARCH_LEVELS=Object.freeze([
  {ratio:"0.236",price:7487.50,status:"UNVERIFIED"},
  {ratio:"0.500",price:7091.75,status:"UNVERIFIED"},
  {ratio:"0.618",price:6914.75,status:"UNVERIFIED"},
  {ratio:"0.786",price:6662.75,status:"UNVERIFIED"},
  {ratio:"0.886",price:6513.00,status:"UNVERIFIED"},
  {ratio:"1.000",price:6342.00,status:"UNVERIFIED"},
].map(x=>Object.freeze(x)));

export function checkedDisplayCandleOpen(anchor,timeframe,bars){
  if(!["1d","4h"].includes(timeframe)||!Number.isFinite(anchor?.timeSec)||!Array.isArray(bars))return null;
  const seconds=timeframe==="1d"?86400:14400;
  // Search existing Engine11 chart candle OPEN times. No guess, no nearest
  // arbitrary bar and no mutation of source event timestamp or price.
  let found=null;
  for(const bar of bars){
    const t=Number(bar.time);
    if(Number.isFinite(t)&&t<=anchor.timeSec&&(found===null||t>found))found=t;
  }
  if(found===null||anchor.timeSec>=found+seconds)return null;
  return found;
}
