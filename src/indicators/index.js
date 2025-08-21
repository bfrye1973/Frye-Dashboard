// src/indicators/index.js
import emaIndicators from "./ema";
import MFP from "./moneyFlow/profile";
import SR from "./sr";
import SWING from "./swing";
import SQUEEZE from "./squeeze";   // ⬅️ new
import SMI from "./smi";           // ⬅️ new
import VOL from "./volume";        // ⬅️ new

const asArray = (x) => (Array.isArray(x) ? x : []);

export const INDICATORS = [
  ...asArray(emaIndicators),
  MFP,
  SR,
  SWING,
  SQUEEZE,
  SMI,
  VOL,
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, def) => {
  if (def && def.id) acc[def.id] = def;
  return acc;
}, {});

export function resolveIndicators(enabledIds = [], settings = {}) {
  const list = enabledIds
    .map((id) => {
      const def = INDICATOR_MAP[id];
      if (!def) { console.warn("[indicators] missing id:", id); return null; }
      const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
      return { def, inputs };
    })
    .filter(Boolean);
  console.info("[indicators] attach =", list.map(x => x.def.id));
  return list;
}

export default INDICATORS;
