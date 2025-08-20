// src/indicators/index.js
// Master indicator registry + strong debug so we can see what's happening.

import { MONEY_FLOW_INDICATORS } from "./moneyFlow";   // (mfi/cmf if kept)
import MFP from "./moneyFlow/profile";                  // Money Flow Profile overlay
import EMA, { makeEMA } from "./ema";

// ----- Define EMAs -----
const EMA10 = makeEMA({ id: "ema10", label: "EMA 10", length: 10, color: "#60a5fa" });
const EMA20 = makeEMA({ id: "ema20", label: "EMA 20", length: 20, color: "#f59e0b" });

// ----- Master list -----
// (Optional) drop MFI oscillator if present in your MONEY_FLOW_INDICATORS
export const INDICATORS = [
  ...MONEY_FLOW_INDICATORS.filter(ind => ind.id !== "mfi"),
  MFP,         // ✅ Money Flow Profile overlay
  EMA10,
  EMA20,
];

// id -> def map
export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  acc[ind.id] = ind;
  return acc;
}, {});

// ----- resolver (merges defaults with per‑indicator settings) -----
export function resolveIndicators(enabledIds = [], settings = {}) {
  // DEBUG: show enabled IDs and what registry holds
  try {
    console.info("[indicators] enabledIds =", JSON.stringify(enabledIds));
    console.info("[indicators] registryIds =", Object.keys(INDICATOR_MAP));
  } catch {}

  const list = enabledIds
    .map((id) => {
      const def = INDICATOR_MAP[id];
      if (!def) {
        try { console.warn("[indicators] missing id in registry:", id); } catch {}
        return null;
      }
      const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
      return { def, inputs };
    })
    .filter(Boolean);

  try {
    console.info("[indicators] attach =", list.map(x => x.def.id));
  } catch {}

  return list;
}
