// src/indicators/index.js
import emaIndicators from "./ema";
import MFP from "./moneyFlow/profile";
import srIndicators from "./sr";              // ⬅️ NEW

const asArray = (x) => (Array.isArray(x) ? x : []);

export const INDICATORS = [
  ...asArray(emaIndicators),
  MFP,
  ...asArray(srIndicators),                   // ⬅️ include SR
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  if (ind && ind.id) acc[ind.id] = ind;
  return acc;
}, {});

export function resolveIndicators(enabledIds = [], settings = {}) {
  const list = enabledIds.map((id) => {
    const def = INDICATOR_MAP[id];
    if (!def) { console.warn("[indicators] missing id:", id); return null; }
    const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
    return { def, inputs };
  }).filter(Boolean);

  console.info("[indicators] attach =", list.map(x => x.def.id));
  return list;
}

export default INDICATORS;

