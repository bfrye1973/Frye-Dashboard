// Engine 2E — owner-provided 24 Elliott Wave anchors for LIVE chart presentation.
// Coordinates copied exactly from the accepted owner-anchors-v1 research table.
// No candle snapping, pivot discovery, Fibonacci calculation, or execution authority.

export const OWNER_WAVE_ANCHORS = Object.freeze([
["submicro","A Low","2026-10-26","01:00",7660.00],
["submicro","A High","2026-10-21","11:00",7810.50],
["submicro","B high","2026-10-28","13:00",7819.50],
["micro","A High","2026-10-21","11:00",7810.50],
["micro","A Low","2026-10-26","01:00",7660.00],
["micro","B high","2026-10-28","13:00",7819.50],
["subminute","A High","2026-08-13","06:00",7908.25],
["subminute","A Low","2026-09-16","11:00",7575.00],
["subminute","B high","2026-10-06","09:00",7895.50],
["minute","W1 starting low","2026-07-30","12:30",7412.50],
["minute","W1 ending high","2026-08-13","06:00",7906.25],
["minor","W1 starting low","2026-03-30","17:00",6417.00],
["minor","W1 ending high","2026-04-10","08:00",6948.75],
["minor","W2 ending low","2026-04-12","15:00",6829.00],
["minor","W3 ending high","2026-06-02","19:00",7694.25],
["minor","W4 ending low","2026-07-29","13:30",7398.00],
["intermediate","W1 starting low","2025-04-08","07:00",5188.50],
["intermediate","W1 ending high","2026-01-28","10:00",7151.00],
["intermediate","W2 ending low","2026-03-30","03:00",6407.00],
["primary","W1 starting low","2020-04-02","08:00",3200.00],
["primary","W1 ending high","2022-01-05","10:00",5620.00],
["primary","W2 ending low","2022-10-12","09:00",4306.00],
["primary","W3 ending high","2025-02-20","09:00",6487.00],
["primary","W4 ending low","2025-04-09","07:00",5182.00]
].map(([degree,label,date,time,price],i)=>Object.freeze({
  id:`OWNER-${String(i+1).padStart(2,"0")}`,
  degree,label,date,time,price,
  timezone:"America/Phoenix",
  timeSec:Math.floor(Date.parse(`${date}T${time}:00-07:00`)/1000),
  source:"OWNER_PROVIDED_2026_11_01"
})));

export function ownerAnchorsForDegree(degree="ALL"){
  const d=String(degree||"ALL").toLowerCase();
  return d==="all"?OWNER_WAVE_ANCHORS:OWNER_WAVE_ANCHORS.filter(a=>a.degree===d);
}
