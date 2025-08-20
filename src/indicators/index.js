// src/indicators/index.js
// Master indicator registry + safe flattener so runtime never explodes.

import moneyFlowIndicators from "./moneyFlow";   // default export MUST be an array
import emaIndicators from "./ema";               // default export MUST be an array
import volumeIndicators from "./volume";         // default export (ok if empty)

// Guard: coerce any non-array to []
const asArray = (x) => (Array.isArray(x) ? x : []);

export const INDICATORS = [
  ...asArray(moneyFlowIndicators),
  ...asArray(emaIndicators),
  ...asArray(volumeIndicators),
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  if (ind && ind.id) acc[ind.id] = ind;
  return acc;
}, {});

export function resolveIndicators(enabledIds = [], settings = {}) {
  // Debug to verify types
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

  try { console.info("[indicators] attach =", list.map(x => x.def.id)); } catch {}
  return list;
}
