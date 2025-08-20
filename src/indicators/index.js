// src/indicators/index.js
// Master indicator registry — ensures Money Flow Profile is included.

import { MONEY_FLOW_INDICATORS } from "./moneyFlow";     // your existing family (mfi/cmf)
import MFP from "./moneyFlow/profile";                    // ✅ Money Flow Profile
import EMA, { makeEMA } from "./ema";

// --- Define EMAs ---
const EMA10 = makeEMA({ id: "ema10", label: "EMA 10", length: 10, color: "#60a5fa" });
const EMA20 = makeEMA({ id: "ema20", label: "EMA 20", length: 20, color: "#f59e0b" });

// --- Master list ---
// (Optionally drop the oscillator if present)
export const INDICATORS = [
  ...MONEY_FLOW_INDICATORS.filter(ind => ind.id !== "mfi"),
  MFP,         // ✅ Money Flow Profile overlay
  EMA10,
  EMA20,
];

// --- id → def map ---
export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  acc[ind.id] = ind;
  return acc;
}, {});

// --- resolver (merges defaults with per‑indicator settings) ---
export function resolveIndicators(enabledIds = [], settings = {}) {
  const list = enabledIds
    .map((id) => {
      const def = INDICATOR_MAP[id];
      if (!def) return null;
      const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
      return { def, inputs };
    })
    .filter(Boolean);

  // Debug: see what the chart will actually attach
  try {
    console.info(
      "[indicators] attach:",
      list.map(x => x.def.id)
    );
  } catch {}

  return list;
}
