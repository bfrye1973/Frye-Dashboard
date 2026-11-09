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
  // Owner corrected Minor W1 start to March 30, 2026, 17:00 AZ @6342;
  // re-read from connected Master Minor W1-W2 Proposed!A2:F3.
  anchor("minor","W1 starting low","2026-03-30","17:00",6342,"OWNER RESEARCH"),
  anchor("minor","W1 ending high","2026-08-13","06:00",7841.25,"OWNER RESEARCH"),
  // W2 low near 7325 is NOT a confirmed time/price pivot per shared
  // evidence. Its '16:00' field conflicts with UNKNOWN-time notes.
]);
// Explicit research entries from the connected updated Master, November 8.
// These are chart-review markers, NOT promotions of Engine22 live counts.
// Missing/unknown endings are deliberately omitted from coordinates.
export const MINUTE_REVIEW_ANCHORS=Object.freeze([
  anchor("minute","A starting high","2026-08-14","07:00",7832.25,"OWNER RESEARCH — TIME CONFLICT WITH MINOR"),
  anchor("minute","A ending low","2026-09-16","11:00",7575.25,"OWNER RESEARCH"),
  anchor("minute","B ending high","2026-10-11","22:00",7887,"OWNER RESEARCH"),
  anchor("minute","C observed low candidate","2026-11-05","16:00",7322.25,"PROVISIONAL — NOT CONFIRMED"),
]);

export const SUBMINUTE_REVIEW_ANCHORS=Object.freeze([
  anchor("subminute","A starting high","2026-10-14","05:00",7876,"OWNER RESEARCH"),
  anchor("subminute","A ending low","2026-10-25","16:00",7647,"OWNER RESEARCH — TIME NEEDS REVIEW"),
  anchor("subminute","B ending high","2026-10-28","08:20",7819,"OWNER RESEARCH"),
  // Subminute C ending low intentionally absent — UNKNOWN.
]);

export const MICRO_REVIEW_ANCHORS=Object.freeze([
  anchor("micro","A Low","2026-11-03","16:00",7484.75,"OWNER RESEARCH"),
  // The active Micro sheet A High CELL is Oct 28 12:00 @7819.25,
  // while its note disagrees with Nov 6 07:50 @7469.25.
  // Show as research only and flag discrepancy; do NOT claim W1 approved.
  anchor("micro","A High","2026-10-28","12:00",7819.25,"CONFLICT — SHEET NOTE DISAGREES"),
  anchor("micro","B","2026-11-05","05:00",7740,"PROVISIONAL — W2 NOT CONFIRMED"),
  // Micro C is blank in the sheet: do not fabricate.
]);

// Historical Submicro ABC source (worksheet rows 2-5), retained for
// provenance. These older ABC markers are no longer the selected chart view.
// No source sheet values or Engine 22 canonical wave model are changed.
export const SUBMICRO_PREVIOUS_ABC_ANCHORS=Object.freeze([
  anchor("submicro","A starting high","2026-11-06","07:50",7469.75,"OLDER ABC RESEARCH"),
  anchor("submicro","A ending low","2026-11-06","10:50",7396.75,"OLDER ABC RESEARCH"),
  anchor("submicro","B ending high","2026-11-06","12:30",7436.75,"OLDER ABC RESEARCH"),
]);

// OWNER UPDATED SAME SHEET: Submicro ABC Proposed!A23:E26, directly re-read
// 2026-11-09. Cells C/D are native Google DATE/TIME numeric values displayed
// as AZ clock dates/times; values below are the formatted source values.
// This is only a source-presented W1/W2 *research* interpretation.
// W3 is blank. A valid event time requires a REAL loaded candle; do not
// invent/snap a candle or claim that W2 was owner-confirmed as a wave ending.
export const SUBMICRO_REVIEW_ANCHORS=Object.freeze([
  anchor("submicro","W1 Low","2026-11-05","15:20",7324,"OWNER RESEARCH — NEW SHEET ROW 24"),
  anchor("submicro","W1 High","2026-11-06","07:40",7469,"OWNER RESEARCH — NEW SHEET ROW 23"),
  anchor("submicro","W2","2026-11-08","15:00",7362,"OWNER RESEARCH — NEW SHEET ROW 25; CANDLE MATCH PENDING"),
]);

export const MINOR_W2_RESEARCH_LEVELS=Object.freeze([
  {ratio:"0.236",price:7487.50,status:"UNVERIFIED"},
  {ratio:"0.500",price:7091.75,status:"UNVERIFIED"},
  {ratio:"0.618",price:6914.75,status:"UNVERIFIED"},
  {ratio:"0.786",price:6662.75,status:"UNVERIFIED"},
  {ratio:"0.886",price:6513.00,status:"UNVERIFIED"},
  {ratio:"1.000",price:6342.00,status:"UNVERIFIED"},
].map(x=>Object.freeze(x)));

// Only map an owner event to the opening of a REAL, already-loaded candle.
// Candle-start timestamps are source authority. Never synthesize a bar,
// silently replace the owner's event timestamp or perform an unbounded fetch.
// The archive has daily UTC opens and session-dependent 4h opens.
export const OWNER_NODE_FRAME_SECONDS = Object.freeze({
  "1m":60,"5m":300,"10m":600,"15m":900,
  "30m":1800,"1h":3600,"4h":14400,"1d":86400,
});

export function containingLoadedCandleOpen(eventTimeSec,timeframe,bars){
  const duration=OWNER_NODE_FRAME_SECONDS[timeframe];
  if(!duration||!Number.isFinite(eventTimeSec)||!Array.isArray(bars)||!bars.length)return null;
  // The Engine11 historical adapter sorts source candle times ascending.
  // Binary search avoids re-scanning 39k 1h bars on each pan/zoom redraw.
  let low=0, high=bars.length-1, match=null;
  while(low<=high){
    const mid=(low+high)>>1;
    const time=Number(bars[mid]?.time);
    if(!Number.isFinite(time))return null;
    if(time<=eventTimeSec){match=time;low=mid+1;}
    else high=mid-1;
  }
  if(match===null||eventTimeSec>=match+duration)return null;
  return match;
}

export function checkedDisplayCandleOpen(anchor,timeframe,bars){
  if(!Number.isFinite(anchor?.timeSec))return null;
  return containingLoadedCandleOpen(anchor.timeSec,timeframe,bars);
}
