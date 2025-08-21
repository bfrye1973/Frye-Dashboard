// src/logic/engineLightRules.js
export const engineDefaults = {
  momentumAlert: -200,
  momentumGood: 200,
  breadthWarn: 50,
  psiWarn: 80,
  psiGood: 20,
  distDaysWindow: 20,
  distDaysTrigger: 5,
  srWarnPct: 0.003,
  srBreakPct: 0.005,
  latchBars: 2,
};

export const LIGHTS_META = {
  overheat: { label: "Overheat",  icon:"🔥" },
  turbo:    { label: "Turbo",     icon:"🟢" },
  lowoil:   { label: "Low Oil",   icon:"🟡" },
  squeeze:  { label: "Compression", icon:"🟡" },
  expansion:{ label: "Expansion", icon:"🟢" },
  dist:     { label: "Distribution", icon:"⛔" },
  div:      { label: "Divergence", icon:"⚠️" },
  srwall:   { label: "Break Wall",  icon:"🧱" },
  breakout: { label: "Breakout",    icon:"🚀" },
};
