// src/indicators/index.js

// --- import each indicator object ---
// (these files should already exist in your repo; leave any that you don't use commented out)
import { ema10 } from "./ema10";
import { ema20 } from "./ema20";
import { mfi } from "./mfi";                // Money Flow Index (0–100)
import { squeeze } from "./squeeze";        // LuxAlgo-style squeeze (separate pane)
import { smi } from "./smi";                // SMI oscillator (separate pane)
import { vol } from "./vol";                // Volume histogram (separate pane)

// NEW — Support / Resistance + Break markers (overlay on price)
import { supportResistance as sr } from "./supportResistance";

// Re-export individual indicators (optional but handy elsewhere)
export { ema10 } from "./ema10";
export { ema20 } from "./ema20";
export { mfi } from "./mfi";
export { squeeze } from "./squeeze";
export { smi } from "./smi";
export { vol } from "./vol";
export { supportResistance as sr } from "./supportResistance";

// Registry the chart component will use
const REGISTRY = {
  ema10,          // overlay (teal)
  ema20,          // overlay (orange)
  mfi,            // overlay (left axis 0–100 guides)
  squeeze,        // SEPARATE pane
  smi,            // SEPARATE pane
  vol,            // SEPARATE pane
  sr,             // overlay (red/blue lines + “B” markers)
};

/**
 * resolveIndicators(enabledIndicators, indicatorSettings)
 * Produces a list like: [{ def, inputs }, ...] in the same order as enabledIndicators.
 * - enabledIndicators: string[] (e.g., ["ema10","ema20","mfi","sr","vol"])
 * - indicatorSettings: object keyed by id with overrides (optional)
 */
export function resolveIndicators(enabledIndicators = [], indicatorSettings = {}) {
  const out = [];
  for (const id of enabledIndicators) {
    const def = REGISTRY[id];
    if (!def) continue; // ignore unknown ids
    const defaults = def.inputs || {};
    const overrides = indicatorSettings[id] || {};
    const inputs = { ...defaults, ...overrides };
    out.push({ def, inputs });
  }
  return out;
}
