// src/algos/pulse/formulas.js
// Ferrari Dashboard — Pulse Strategy (R12.8)
//
// This module implements the core Pulse formulas using the deltas
// produced by /live/pills.
//
// It assumes backend /live/pills JSON:
//
// {
//   "stamp5": "...",
//   "stamp10": "...",
//   "deltas": {
//      "market": {
//         "dBreadthPct": -12.3,   // fast (Δ5m-style composite)
//         "dMomentumPct": -8.1,   // slower / trend (Δ10m-style composite)
//         "riskOnPct": 4.2       // risk-on pulse-style value
//      },
//      "sectors": {
//         "information technology": { "d5m": -17.2, "d10m": -48.3 },
//         ...
//      }
//   }
// }

const clamp = (v, lo, hi) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
};

// ---------- Sector-level Pulse (0–100) ----------
//
// Inputs:
//   d5m  = sector Δ5m (fast micro rotation, already weighted by backend)
//   d10m = sector Δ10m (slower trend shift)
//
// Contract (R12.8):
//   pulse_sector =
//       0.40 * clamp(d5m + 50, 0, 100)
//     + 0.60 * clamp(d10m + 50, 0, 100)
//
export function computeSectorPulse(d5m, d10m) {
  const fast = clamp(d5m + 50, 0, 100);
  const trend = clamp(d10m + 50, 0, 100);
  const pulse = 0.4 * fast + 0.6 * trend;

  return {
    fast,       // Δ5m contribution mapped to 0–100
    trend,      // Δ10m contribution mapped to 0–100
    pulse,      // final 0–100 sector pulse score
  };
}

// ---------- Market-level Pulse with smoothing & decay ----------
//
// Raw inputs (from /live/pills.deltas.market):
//   dBreadthPct = interpreted as Δ5m_market
//   dMomentumPct = interpreted as Δ10m_market
//   riskOnPct    = risk-on pulse-style value
//
// R12.8 rules applied:
//   - Ignore |Δ| < 2.5 (noise filter)
//   - Smoothing: smooth = prior + 0.35 * (raw - prior)
//   - Decay:     prior * 0.90 each cycle (dying moves)
//   - Pulse score:
//       pulse = clamp(0.5*(Δ5m_eff + 50) + 0.5*(Δ10m_eff + 50), 0, 100)
//
const NOISE_THRESH = 2.5;
const SMOOTH_K = 0.35;
const DECAY = 0.9;

const smooth = (prior, raw) => {
  if (!Number.isFinite(raw)) return prior;
  if (!Number.isFinite(prior)) return raw;
  return prior + SMOOTH_K * (raw - prior);
};

export function computeMarketPulse(prevState, rawMarketDeltas) {
  const d5Raw = Number(rawMarketDeltas?.dBreadthPct);
  const d10Raw = Number(rawMarketDeltas?.dMomentumPct);
  const riskOnRaw = Number(rawMarketDeltas?.riskOnPct);

  let d5 = Number.isFinite(d5Raw) ? d5Raw : 0;
  let d10 = Number.isFinite(d10Raw) ? d10Raw : 0;

  // Noise gate
  if (Math.abs(d5) < NOISE_THRESH) d5 = 0;
  if (Math.abs(d10) < NOISE_THRESH) d10 = 0;

  const prev = prevState || {
    d5m: 0,        // last smoothed Δ5m_market
    d10m: 0,       // last smoothed Δ10m_market
    pulse: 50,     // last pulse score (0–100)
    riskOnPulse: 0,
    trendPulse: 0,
  };

  // Apply decay
  const decayed5 = prev.d5m * DECAY;
  const decayed10 = prev.d10m * DECAY;

  // Apply smoothing toward new raw deltas
  const d5Eff = smooth(decayed5, d5);
  const d10Eff = smooth(decayed10, d10);

  // Pulse score 0–100
  const pulseScore = clamp(
    0.5 * (d5Eff + 50) + 0.5 * (d10Eff + 50),
    0,
    100
  );

  // Risk-on pulse: we treat backend riskOnPct as the already combined value.
  const riskOnPulse = Number.isFinite(riskOnRaw) ? riskOnRaw : 0;

  // Trend pulse is simply the smoothed Δ10m_market
  const trendPulse = d10Eff;

  return {
    d5m: d5Eff,
    d10m: d10Eff,
    pulse: pulseScore,
    riskOnPulse,
    trendPulse,
  };
}

// ---------- Classification helpers ----------
//
// For icon color:
//   pulse > 65  → "up"    (green burst)
//   pulse < 40  → "down"  (red flush)
//   else        → "flat"  (neutral / white)
//
export function classifyPulse(pulseScore) {
  const s = Number(pulseScore);
  if (!Number.isFinite(s)) return "flat";
  if (s > 65) return "up";
  if (s < 40) return "down";
  return "flat";
}
