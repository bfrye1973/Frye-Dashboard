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

// Engine 22 master workbook — exact dated, ES-priced owner research anchors.
// Workbook: Engine22 Seven Degree Elliott Wave Master, updated Nov 8, 2026.
// These are visual RESEARCH/reference coordinates, never Engine 22 count
// approval, Engine 11 price authority, trade execution, or Fib calculations.
// Rows with UNKNOWN time/price remain in the workbook but are NOT chart dots.
// The previous 24 owner historical anchors above are preserved in full.
export const OWNER_RESEARCH_WAVE_ANCHORS = Object.freeze([
  // [degree, node label, Arizona date, Arizona time, ES price, source worksheet row]
  ["minor","W1 starting low","2026-04-30","17:00",6485.00,"Minor W1-W2 Proposed!2"],
  ["minor","W1 ending high","2026-08-14","03:00",7901.75,"Minor W1-W2 Proposed!3"],
  ["minor","W2 starting high","2026-08-14","03:00",7901.75,"Minor W1-W2 Proposed!4"],

  ["minute","A starting high","2026-08-14","07:00",7901.75,"Minute ABC Proposed!2"],
  ["minute","A ending low","2026-09-16","11:00",7575.25,"Minute ABC Proposed!3"],
  ["minute","B ending high","2026-10-11","22:00",7890.25,"Minute ABC Proposed!4"],
  ["minute","C observed low candidate","2026-11-05","16:00",7322.25,"Minute ABC Proposed!5"],

  ["subminute","A starting high","2026-11-05","05:00",7735.00,"Subminute ABC Proposed!2"],
  ["subminute","A ending low","2026-11-05","08:00",7420.00,"Subminute ABC Proposed!3"],
  ["subminute","B ending high","2026-11-05","08:20",7542.00,"Subminute ABC Proposed!4"],

  ["micro","W1 starting low","2026-11-05","16:00",7321.75,"Micro W1-W2 Proposed!2"],
  // Owner correction 2026-11-08: Micro W1 high 7469.25, NOT older 7469.75.
  ["micro","W1 ending high","2026-11-06","07:50",7469.25,"Micro W1-W2 Proposed!3"],

  // Separate source node: Submicro A 7469.75 was NOT changed by Micro correction.
  ["submicro","A starting high","2026-11-06","07:50",7469.75,"Submicro ABC Proposed!2"],
  ["submicro","A ending low","2026-11-06","10:50",7396.75,"Submicro ABC Proposed!3"],
  ["submicro","B ending high","2026-11-06","12:30",7436.75,"Submicro ABC Proposed!4"],
].map(([degree,label,date,time,price,sourceRow],i)=>Object.freeze({
  id:`OWNER-RESEARCH-${String(i+1).padStart(2,"0")}`,
  degree,label,date,time,price,sourceRow,classification:"RESEARCH",
  timezone:"America/Phoenix",
  timeSec:Math.floor(Date.parse(`${date}T${time}:00-07:00`)/1000),
  source:"ENGINE22_GOOGLE_SHEETS_MASTER_2026_11_08",
})));

export const ALL_OWNER_WAVE_ANCHORS = Object.freeze([
  ...OWNER_WAVE_ANCHORS,
  ...OWNER_RESEARCH_WAVE_ANCHORS,
]);

export function ownerAnchorsForDegree(degree="ALL"){
  const d=String(degree||"ALL").toLowerCase();
  return d==="all"?ALL_OWNER_WAVE_ANCHORS:ALL_OWNER_WAVE_ANCHORS.filter(a=>a.degree===d);
}
