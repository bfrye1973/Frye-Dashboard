// src/algos/pulse/formulas.js
// Ferrari Dashboard — Pulse Strategy (R12.8 + Balanced Mode)
//
// This module implements the core Pulse formulas using the deltas
// produced by /live/pills (5m DELTAS job).
//
// Expected backend JSON shape:
//
// {
//   "stamp5": "...",
//   "stamp10": "...",
//   "deltas": {
//     "market": {
//        "dBreadthPct": -12.3,   // fast Δ5m-style composite
//        "dMomentumPct": -8.1,   // slower / trend Δ10m-style composite
//        "riskOnPct": 4.2        // risk-on pulse-style value
//     },
//     "sectors": {
//        "information technology": { "d5m": -17.2, "d10m": -48.3 },
//        ...
//     }
//   }
// }

import pulseConfig from "./config.json";

const clamp = (v, lo, hi) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
};

const NOISE_THRESH = Number(pulseConfig.noiseThreshold ?? 3.0);
const SMOOTH_K = Number(pulseConfig.smoothK ?? 0.26);
const DECAY = Number(pulseConfig.decay ?? 0.93);

// ---------- Sector-level Pulse (0–100) ----------
//
// Inputs (already combined by backend):
//   d5m  = sector Δ5m (fast micro rotation)
//   d10m = sector Δ10m (slower trend shift)
//
// Original R12.8 contract:
//
//   pulse_sector =
//       0.40 * clamp(d5m + 50, 0, 100)
//     + 0.60 * clamp(d10m + 50, 0, 100)
//
export function computeSectorPulse(d5m, d10m) {
  const fast = clamp((d5m ?? 0) + 50, 0, 100);
  const trend = clamp((d10m ?? 0) + 50, 0, 100);
  const pulse = 0.4 * fast + 0.6 * trend;

  return {
    fast,  // Δ5m contribution mapped to 0–100
    trend, // Δ10m contribution mapped to 0–100
    pulse, // final 0–100 sector pulse score
  };
}

// ---------- Smoothing helpers (Balanced Mode) ----------

const smoothTowards = (prior, raw) => {
  const r = Number(raw);
  if (!Number.isFinite(r)) return prior;
  if (!Number.isFinite(prior)) return r;
  return prior + SMOOTH_K * (r - prior);
};

const applyNoiseGate = (delta) => {
  const d = Number(delta);
  if (!Number.isFinite(d)) return 0;
  return Math.abs(d) < NOISE_THRESH ? 0 : d;
};

// ---------- Market-level Pulse with smoothing & decay ----------
//
// Raw inputs (from /live/pills.deltas.market):
//   dBreadthPct → interpreted as Δ5m_market
//   dMomentumPct → interpreted as Δ10m_market
//   riskOnPct    → risk-on pulse-style value
//
// R12.8 + Balanced Mode rules:
//   - Noise gate: ignore |Δ| < noiseThreshold
//   - Decay each cycle: prev * decay
//   - Smooth: prior + smoothK * (raw - prior)
//   - Pulse score:
//       pulse = clamp(0.5*(Δ5m_eff + 50) + 0.5*(Δ10m_eff + 50), 0, 100)
//
export function computeMarketPulse(prevState, rawMarketDeltas) {
  const d5Raw = Number(rawMarketDeltas?.dBreadthPct);
  const d10Raw = Number(rawMarketDeltas?.dMomentumPct);
  const riskOnRaw = Number(rawMarketDeltas?.riskOnPct);

  // Apply noise gate
  let d5 = applyNoiseGate(d5Raw);
  let d10 = applyNoiseGate(d10Raw);

  const prev = prevState || {
    d5m: 0,        // last smoothed Δ5m_market
    d10m: 0,       // last smoothed Δ10m_market
    pulse: 50,     // last pulse score (0–100)
    riskOnPulse: 0,
    trendPulse: 0,
  };

  // Decay previous impulses (dying moves)
  const decayed5 = prev.d5m * DECAY;
  const decayed10 = prev.d10m * DECAY;

  // Smooth toward new deltas
  const d5Eff = smoothTowards(decayed5, d5);
  const d10Eff = smoothTowards(decayed10, d10);

  // Final Pulse score, 0–100
  const pulseScore = clamp(
    0.5 * (d5Eff + 50) + 0.5 * (d10Eff + 50),
    0,
    100
  );

  // Risk-on pulse: treat backend riskOnPct as combined pulse-style value
  const riskOnPulse = Number.isFinite(riskOnRaw) ? riskOnRaw : 0;

  // Trend pulse is the smoothed Δ10m_market
  const trendPulse = d10Eff;

  return {
    d5m: d5Eff,
    d10m: d10Eff,
    pulse: pulseScore,
    riskOnPulse,
    trendPulse,
  };
}
