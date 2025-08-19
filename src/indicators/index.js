// Master registry that the chart can use
import { MONEY_FLOW_INDICATORS } from "./moneyFlow";

export const INDICATORS = [
  ...MONEY_FLOW_INDICATORS,
];

export const INDICATOR_MAP = INDICATORS.reduce((acc, ind) => {
  acc[ind.id] = ind;
  return acc;
}, {});

// Optional helper: resolve enabled indicators with settings
export function resolveIndicators(enabledIds = [], settings = {}) {
  return enabledIds
    .map((id) => {
      const def = INDICATOR_MAP[id];
      if (!def) return null;
      const inputs = { ...(def.defaults || {}), ...(settings[id] || {}) };
      return { def, inputs };
    })
    .filter(Boolean);
}
