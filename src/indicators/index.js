// src/indicators/index.js
// Master registry + safe flattener + resolver.
// Includes: EMA (array), Money Flow Profile (single), Support/Resistance (single), Swing (single)

import emaIndicators from "./ema";                 // array: [ema10, ema20, ...]
import MFP from "./moneyFlow/profile";             // single (id: "mfp")
import SR from "./sr";                              // single (id: "sr")
import SWING from "./swing";                        // single (id: "swing")

const asArray = (x) => (Array.isArray(x) ? x : []);

export const INDICATORS = [
  ...asArray(emaIndicators),
  MFP,
  SR,
  SWING,
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  if (ind && ind.id) acc[ind.id] = ind;
  return acc;
}, {});

// LiveLWChart uses this to expand ids -> defs + merged inputs
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
