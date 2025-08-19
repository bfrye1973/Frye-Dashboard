// src/indicators/index.js
import { MONEY_FLOW_INDICATORS } from "./moneyFlow";   // (mfi/cmf if you keep them)
import MFP from "./moneyFlow/profile";                  // <-- NEW
import EMA, { makeEMA } from "./ema";

// Define EMAs
const EMA10 = makeEMA({ id: "ema10", label: "EMA 10", length: 10, color: "#60a5fa" });
const EMA20 = makeEMA({ id: "ema20", label: "EMA 20", length: 20, color: "#f59e0b" });

export const INDICATORS = [
  // Keep any existing families:
  ...MONEY_FLOW_INDICATORS.filter(i => i.id !== "mfi"), // optional: drop the oscillator if you want
  MFP,      // Money Flow Profile overlay
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
