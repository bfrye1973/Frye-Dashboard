// src/indicators/index.js
//
// Auto-register any indicator module in this folder.
// No hardcoded imports, so missing files (e.g., ema10.js) won’t break builds.
//
// Convention: each indicator file should export one or more objects
// that have an `id` field (e.g., { id: "ema10", ... }).
// We’ll pick up all such objects and register them by id.

function buildRegistry() {
  const REGISTRY = {};

  // Webpack (CRA) helper: import all .js files in this folder (non-recursive)
  const ctx = require.context("./", false, /\.js$/);

  ctx.keys().forEach((key) => {
    if (key === "./index.js") return; // skip this file
    const mod = ctx(key);

    // Collect any named exports that look like indicator defs (have an `id`)
    Object.values(mod).forEach((exp) => {
      if (exp && typeof exp === "object" && typeof exp.id === "string") {
        REGISTRY[exp.id] = exp;
      }
    });
  });

  return REGISTRY;
}

// Build once at module load
const REGISTRY = buildRegistry();

/**
 * resolveIndicators(enabledIndicators, indicatorSettings)
 * Returns: [{ def, inputs }, ...] in the same order as enabledIndicators.
 * - enabledIndicators: string[] (e.g., ["ema10","ema20","mfi","sr","vol"])
 * - indicatorSettings: object keyed by id with input overrides
 */
export function resolveIndicators(enabledIndicators = [], indicatorSettings = {}) {
  const out = [];
  for (const id of enabledIndicators) {
    const def = REGISTRY[id];
    if (!def) continue; // silently ignore unknown/missing indicators
    const defaults = def.inputs || {};
    const overrides = indicatorSettings[id] || {};
    const inputs = { ...defaults, ...overrides };
    out.push({ def, inputs });
  }
  return out;
}

// Optional: re-export everything we discovered (handy for testing)
export const registry = REGISTRY;
