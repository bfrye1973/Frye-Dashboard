// src/indicators/index.js
// Master indicator registry + resolver

// Each folder exports a DEFAULT ARRAY of indicator defs.
import moneyFlowIndicators from "./moneyFlow";   // ✅ default export (MFP/CMF/MFI array)
import emaIndicators from "./ema";               // default array (EMA10/EMA20, etc.)
import volumeIndicators from "./volume";         // default array (if present)

// Build the flat list
export const INDICATORS = [
  ...(moneyFlowIndicators || []),
  ...(emaIndicators || []),
  ...(volumeIndicators || []),
];

// id -> def
export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  acc[ind.id] = ind;
  return acc;
}, {});

// Merge defaults with per‑indicator settings
export function resolveIndicators(enabledIds = [], settings = {}) {
  // Light debug to verify what's attaching
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
