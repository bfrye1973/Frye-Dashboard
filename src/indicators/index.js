// src/indicators/index.js
import { MONEY_FLOW_INDICATORS } from "./moneyFlow";   // keep your existing family if you want CMF later
import MFP from "./moneyFlow/profile";                  // ✅ add profile
import EMA, { makeEMA } from "./ema";

// EMAs
const EMA10 = makeEMA({ id: "ema10", label: "EMA 10", length: 10, color: "#60a5fa" });
const EMA20 = makeEMA({ id: "ema20", label: "EMA 20", length: 20, color: "#f59e0b" });

export const INDICATORS = [
  ...MONEY_FLOW_INDICATORS.filter(ind => ind.id !== "mfi"), // optional: drop oscillator if present
  MFP,         // ✅ Money Flow Profile overlay
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
