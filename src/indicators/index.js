// src/indicators/index.js
//
// Safe auto-register of indicators (recurses subfolders) with guards.
// Each indicator module should export objects shaped like:
//   { id: "ema10", inputs?: {...}, compute(candles, inputs) => result,
//     attach(chartApi, seriesMap, result, inputs) => cleanupFn }
//
// We register ONLY exports that have id + compute + attach.
// Any import/processing error is logged so the app never crashes.

function buildRegistry() {
  const REGISTRY = {};
  let ctx;

  try {
    // recurse into subfolders (true)
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

/** resolveIndicators(enabled, settings) -> [{ def, inputs }] */
export function resolveIndicators(enabled = [], settings = {}) {
  const out = [];
  for (const id of enabled) {
    const def = registry[id];
    if (!def) {
      console.warn(`[indicators] missing/invalid id: ${id}`);
      continue;
    }
    const defaults  = def.inputs || {};
    const overrides = settings[id] || {};
    out.push({ def, inputs: { ...defaults, ...overrides } });
  }
  return out;
}
