// src/indicators/index.js
import { MONEY_FLOW_INDICATORS } from "./moneyFlow";
import EMA, { makeEMA } from "./ema";
import VOLUME from "./volume";

// Define EMA10 & EMA20 using the factory
const EMA10 = makeEMA({ id: "ema10", label: "EMA 10", length: 10, color: "#60a5fa" }); // blue
const EMA20 = makeEMA({ id: "ema20", label: "EMA 20", length: 20, color: "#f59e0b" }); // amber

export const INDICATORS = [
  ...MONEY_FLOW_INDICATORS,  // mfi, cmf
  VOLUME,                    // volume histogram
  EMA10,
  EMA20,
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  acc[ind.id] = ind;
  return acc;
}, {});

export function resolveIndicators(enabledIds = [], settings = {}) {
  return enabledIds
    .map((id) => {
      const def = INDICATOR_MAP[id];
      if (!def) return null;
      const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
      return { def, inputs };
    })
    .filter(Boolean);
}
