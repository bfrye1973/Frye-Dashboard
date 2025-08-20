// src/indicators/index.js
// Master indicator registry + safe flattener + resolver

import moneyFlowIndicators from "./moneyFlow";
import emaIndicators from "./ema";
import volumeIndicators from "./volume";
import rsiIndicators from "./rsi";
import srBreaksIndicators from "./srBreaks";

const asArray = (x) => (Array.isArray(x) ? x : []);

export const INDICATORS = [
  ...asArray(moneyFlowIndicators),
  ...asArray(emaIndicators),
  ...asArray(volumeIndicators),
  ...asArray(rsiIndicators),
  ...asArray(srBreaksIndicators),
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  if (ind && ind.id) acc[ind.id] = ind;
  return acc;
}, {});

// ✅ bring back resolveIndicators for LiveLWChart.jsx
export function resolveIndicators(enabledIds = [], settings = {}) {
  try {
    console.info("[indicators] enabledIds =", JSON.stringify(enabledIds));
    console.info("[indicators] registryIds =", Object.keys(INDICATOR_MAP));
  } catch {}

  const list = enabledIds
    .map((id) => {
      const def = INDICATOR_MAP[id];
      if (!def) { try { console.warn("[indicators] missing id:", id); } catch {} ; return null; }
      const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
      return { def, inputs };
    })
    .filter(Boolean);

  try { console.info("[indicators] attach =", list.map(x => x.def.id)); } catch {}
  return list;
}

// (optional) default export if other files import the whole array
export default INDICATORS;
