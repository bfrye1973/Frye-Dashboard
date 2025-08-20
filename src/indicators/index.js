// src/indicators/index.js
// Minimal, stable registry: EMAs only. Safe flattener + resolver.

import emaIndicators from "./ema";

const asArray = (x) => (Array.isArray(x) ? x : []);

export const INDICATORS = [
  ...asArray(emaIndicators),
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  if (ind && ind.id) acc[ind.id] = ind;
  return acc;
}, {});

// keep this export — LiveLWChart expects it
export function resolveIndicators(enabledIds = [], settings = {}) {
  try {
    console.info("[indicators] enabledIds =", JSON.stringify(enabledIds));
    console.info("[indicators] registryIds =", Object.keys(INDICATOR_MAP));
  } catch {}
  const list = enabledIds
    .map((id) => {
      const def = INDICATOR_MAP[id];
      if (!def) { try { console.warn("[indicators] missing id:", id); } catch {}; return null; }
      const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
      return { def, inputs };
    })
    .filter(Boolean);

  try { console.info("[indicators] attach =", list.map(x => x.def.id)); } catch {}
  return list;
}

export default INDICATORS;
