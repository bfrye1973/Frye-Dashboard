// src/indicators/index.js
// Master registry + safe flattener + resolver.
// Includes: EMA (array), MFP (single), SR (single), SWING (single)

import indicatorTypes from "./shared/indicatorTypes";

import emaIndicators from "./ema";                 // default array: [EMA10, EMA20, ...]
import MFP from "./moneyFlow/profile";             // default single (id: "mfp")
import SR from "./sr";                              // default single (id: "sr")
import SWING from "./swing";                        // default single (id: "swing")

const asArray = (x) => (Array.isArray(x) ? x : []);

export const INDICATORS = [
  ...asArray(emaIndicators),
  MFP,
  SR,
  SWING,
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, def) => {
  if (def && def.id) acc[def.id] = def;
  return acc;
}, {});

// LiveLWChart calls this to expand ids -> defs + merged inputs
export function resolveIndicators(enabledIds = [], settings = {}) {
  try {
    console.info("[indicators] enabledIds =", JSON.stringify(enabledIds));
    console.info("[indicators] registryIds =", Object.keys(INDICATOR_MAP));
  } catch {}

  const list = enabledIds
    .map((id) => {
      const def = INDICATOR_MAP[id];
      if (!def) {
        try { console.warn("[indicators] missing id:", id); } catch {}
        return null;
      }
      const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
      return { def, inputs };
    })
    .filter(Boolean);

  try { console.info("[indicators] attach =", list.map(x => x.def.id)); } catch {}
  return list;
}

export default INDICATORS;
export { indicatorTypes };
