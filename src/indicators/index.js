// src/indicators/index.js
//
// Safe auto-register of indicators (recurses subfolders) with guards.
// An indicator module should export objects that include:
//   { id: "ema10", compute(candles, inputs) => result, attach(chartApi, seriesMap, result, inputs) => cleanupFn }
// We register only exports that have id + compute + attach functions.
// Any import/processing error is caught so the app never crashes.

function buildRegistry() {
  const REGISTRY = {};
  let ctx;

  try {
    ctx = require.context("./", true, /\.js$/); // recurse
  } catch (e) {
    console.warn("[indicators] require.context unavailable:", e);
    return REGISTRY;
  }

  ctx.keys().forEach((key) => {
    // skip any index.js to avoid self-import loops
    if (key === "./index.js" || key.endsWith("/index.js")) return;

    // import the module; never let a bad module crash the app
    let mod;
    try {
      mod = ctx(key);
    } catch (e) {
      console.error(`[indicators] failed loading ${key}:`, e);
      return;
    }

    // collect valid indicator exports
    try {
      Object.values(mod).forEach((exp) => {
        if (
          exp &&
          typeof exp === "object" &&
          typeof exp.id === "string" &&
          typeof exp.compute === "function" &&
          typeof exp.attach === "function"
        ) {
          REGISTRY[exp.id] = exp;
        }
      });
    } catch (e) {
      console.error(`[indicators] failed processing exports from ${key}:`, e);
    }
  });

  return REGISTRY;
}

export const registry = buildRegistry();

/**
 * resolveIndicators(enabled, settings) -> [{ def, inputs }]
 * Only returns indicators that passed validation.
 */
export function resolveIndicators(enabled = [], settings = {}) {
  const out = [];
  for (const id of enabled) {
    const def = registry[id];
    if (!def) {
      console.warn(`[indicators] missing or invalid id: ${id}`);
      continue;
    }
    const defaults  = def.inputs || {};
    const overrides = settings[id] || {};
    out.push({ def, inputs: { ...defaults, ...overrides } });
  }
  return out;
}

