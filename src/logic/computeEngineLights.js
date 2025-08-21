// src/logic/computeEngineLights.js
import { engineDefaults } from "./engineLightRules";
const avg = (a) => (a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0);

export function computeEngineLights({
  candles = [],
  momentum = 0,
  breadth  = 0,
  psi,            // optional
  srZones = [],   // optional [{type, price}]
  prior = {},
  cfg = {},
}) {
  const o = { ...engineDefaults, ...(cfg||{}) };
  const out = {};
  const n = candles.length;
  if (!n) return latchAllOff(prior);

  const last = candles[n-1] || {};
  const close = last.close ?? 0;

  // price 5‑bar trend
  const last5 = candles.slice(-5).map(c=>c.close);
  const prev5 = candles.slice(-10,-5).map(c=>c.close);
  const priceUp = avg(last5) > avg(prev5);

  // distribution days
  const last20 = candles.slice(-o.distDaysWindow);
  const volMA20 = avg(last20.map(c=>c.volume ?? 0));
  const distCount = last20.filter((c,i,arr)=>{
    if (i===0) return false;
    const prev = arr[i-1];
    return c.close < prev.close && (c.volume ?? 0) > volMA20;
  }).length;

  // nearest resistance pct + breakout
  let nearestResPct = Infinity, breakout = false;
  for (const z of srZones || []) {
    if (z.type !== "res") continue;
    const pct = Math.abs(z.price - close)/Math.max(1e-6, close);
    nearestResPct = Math.min(nearestResPct, pct);
    if (close > z.price*(1+o.srBreakPct)) breakout = true;
  }

  const latch = (id, now) => {
    const prev = prior[id] || {};
    if (now && now !== "off") return { state: now, ttl: o.latchBars };
    if (prev.ttl > 0) return { state: prev.state, ttl: prev.ttl - 1 };
    return { state: "off", ttl: 0 };
  };

  out.overheat = latch("overheat", (momentum <= o.momentumAlert || avg([momentum, breadth]) < 0) ? "alert" : null);
  out.turbo    = latch("turbo",    (momentum >= o.momentumGood && breadth > 0) ? "good" : null);
  out.lowoil   = latch("lowoil",   breadth <= o.breadthWarn ? "warn" : null);
  out.squeeze  = latch("squeeze",  (psi !== undefined && psi >= o.psiWarn) ? "warn" : null);
  out.expansion= latch("expansion",(psi !== undefined && psi <= o.psiGood) ? "good" : null);
  out.dist     = latch("dist",     distCount >= o.distDaysTrigger ? "alert" : null);
  out.div      = latch("div",      (priceUp && breadth < 0) ? "warn" : null);
  out.srwall   = latch("srwall",   nearestResPct <= o.srWarnPct ? "warn" : null);
  out.breakout = latch("breakout", breakout ? "good" : null);

  return out;
}

function latchAllOff(prev = {}) {
  const out = {};
  for (const k of Object.keys(prev)) {
    const p = prev[k];
    out[k] = p?.ttl > 0 ? { state: p.state, ttl: p.ttl - 1 } : { state: "off", ttl: 0 };
  }
  return out;
}
