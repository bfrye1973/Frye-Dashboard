// src/indicators/index.js — SAFE RECURSIVE LOADER WITH GUARDS

function buildRegistry() {
  const REGISTRY = {};
  let ctx;
  try { ctx = require.context("./", true, /\.js$/); }
  catch(e){ console.warn("[indicators] require.context unavailable:", e); return REGISTRY; }

  ctx.keys().forEach((key) => {
    if (key === "./index.js" || key.endsWith("/index.js")) return;
    let mod;
    try { mod = ctx(key); }
    catch(e){ console.error(`[indicators] failed loading ${key}:`, e); return; }

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

export const registry = buildRegistry();

export function resolveIndicators(enabled = [], settings = {}) {
  const out = [];
  for (const id of enabled) {
    const def = registry[id];
    if (!def) { console.warn(`[indicators] missing id: ${id}`); continue; }
    const defaults  = def.inputs || {};
    const overrides = settings[id] || {};
    out.push({ def, inputs: { ...defaults, ...overrides } });
  }
  return out;
}
