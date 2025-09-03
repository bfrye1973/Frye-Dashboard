// src/indicators/index.js
//
// Safe auto-register of indicators (recurses subfolders), with guards.
// Each indicator module should export one or more objects that include an `id` field
// (e.g., export const EMA10 = { id: "ema10", ... }). We register by id.

function buildRegistry() {
  const REGISTRY = {};

  let ctx;
  try {
    // Recurse all .js files under ./ (CRA / Webpack)
    ctx = require.context("./", true, /\.js$/);
  } catch (e) {
    console.warn("[indicators] require.context unavailable:", e);
    return REGISTRY;
  }

  ctx.keys().forEach((key) => {
    // skip any index.js to avoid self-import loops
    if (key === "./index.js" || key.endsWith("/index.js")) return;

    // import module; never let a bad module crash the app
    let mod;
    try {
      mod = ctx(key);
    } catch (e) {
      console.error(`[indicators] failed loading ${key}:`, e);
      return;
    }

    // collect any named exports that look like indicator defs (have an `id`)
    try {
      Object.values(mod).forEach((exp) => {
        if (exp && typeof exp === "object" && typeof exp.id === "string") {
          REGISTRY[exp.id] = exp;
        }
      });
    } catch (e) {
      console.error(`[indicators] failed processing exports from ${key}:`, e);
    }
  });

  return REGISTRY;
}

const REGISTRY = buildRegistry();

/**
 * resolveIndicators(enabled, settings)
 * Returns [{ def, inputs }, ...] keeping the order of `enabled`.
 * - enabled: string[] of ids, e.g., ["ema10","ema20","mfi","sr","vol"]
 * - settings: per-id overrides (merged with def.inputs)
 */
export function resolveIndicators(enabled = [], settings = {}) {
  const out = [];
  for (const id of enabled) {
    const def = REGISTRY[id];
    if (!def) {
      console.warn(`[indicators] missing id: ${id}`);
      continue;
    }
    const defaults  = def.inputs || {};
    const overrides = settings[id] || {};
    out.push({ def, inputs: { ...defaults, ...overrides } });
  }
  return out;
}

// Optional: export registry for debugging
export const registry = REGISTRY;
