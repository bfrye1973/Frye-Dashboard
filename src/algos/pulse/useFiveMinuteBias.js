// src/algos/pulse/useFiveMinuteBias.js
// 5m Micro Bias hook — reads /live/pills and computes avg d5m + bias + turbo

import React from "react";

const PULSE_URL =
  process.env.REACT_APP_PULSE_URL ||
  process.env.REACT_APP_PILLS_URL ||
  process.env.REACT_APP_INTRADAY_SANDBOX_URL ||
  "";

// Map avg d5m → "bull" | "neutral" | "bear"
function biasFromAvgD5m(avgD5m) {
  if (!Number.isFinite(avgD5m)) return "neutral";
  if (avgD5m >= 15) return "bull";
  if (avgD5m <= -15) return "bear";
  return "neutral";
}

// Optional turbo classification for strong tilts
function turboFromAvgD5m(avgD5m) {
  if (!Number.isFinite(avgD5m)) return null;
  if (avgD5m >= 30) return "bull";
  if (avgD5m <= -30) return "bear";
  return null;
}

/**
 * useFiveMinuteBias
 *
 * Returns:
 *   avgD5m → smoothed average d5m across sectors
 *   bias   → "bull" | "neutral" | "bear"
 *   turbo  → "bull" | "bear" | null  (strong micro impulse)
 *   ts     → latest stamp5 / deltasUpdatedAt from /live/pills
 */
export function useFiveMinuteBias() {
  const [state, setState] = React.useState({
    avgD5m: null,
    bias: "neutral",
    turbo: null,
    ts: null,
  });

  React.useEffect(() => {
    if (!PULSE_URL) return;

    let stop = false;
    let prevAvg = null; // EMA memory

    async function pull() {
      try {
        const sep = PULSE_URL.includes("?") ? "&" : "?";
        const res = await fetch(`${PULSE_URL}${sep}t=${Date.now()}`, {
          cache: "no-store",
        });
        const j = await res.json();

        // /live/pills schema:
        // { stamp5, stamp10, sectors: { key: { d5m, d10m } } }
        const sectors = j?.sectors || {};
        const values = Object.values(sectors);

        let avgD5mRaw = null;
        if (values.length > 0) {
          let sum = 0;
          let count = 0;
          for (const s of values) {
            const d5 = Number(s?.d5m);
            if (Number.isFinite(d5)) {
              sum += d5;
              count += 1;
            }
          }
          if (count > 0) avgD5mRaw = sum / count;
        }

        // EMA-style smoothing on avgD5m
        let avgSmooth = avgD5mRaw;
        if (Number.isFinite(avgD5mRaw)) {
          if (Number.isFinite(prevAvg)) {
            // 70% old, 30% new
            avgSmooth = prevAvg + 0.3 * (avgD5mRaw - prevAvg);
          }
          prevAvg = avgSmooth;
        }

        if (stop) return;

        const bias = biasFromAvgD5m(avgSmooth);
        const turbo = turboFromAvgD5m(avgSmooth);

        setState({
          avgD5m: avgSmooth,
          bias,
          turbo,
          ts:
            j?.stamp5 ||
            j?.deltasUpdatedAt ||
            j?.sectorsUpdatedAt ||
            j?.updated_at ||
            null,
        });
      } catch (err) {
        console.error("[useFiveMinuteBias] error:", err);
        if (!stop) {
          setState({
            avgD5m: null,
            bias: "neutral",
            turbo: null,
            ts: null,
          });
        }
      }
    }

    pull();
    const id = setInterval(pull, 30_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
