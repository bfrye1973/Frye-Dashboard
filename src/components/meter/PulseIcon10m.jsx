// src/components/meter/PulseIcon10m.jsx
// Ferrari Dashboard — 10m Pulse Icon (R12.8 + Balanced Mode, 7-bar visual, BIGGER)

import React from "react";
import { computeMarketPulse } from "../../algos/pulse/formulas";
import pulseConfig from "../../algos/pulse/config.json";

// Prefer dedicated Pulse URL, fallback to sandbox if needed.
const PULSE_URL =
  process.env.REACT_APP_PULSE_URL ||
  process.env.REACT_APP_INTRADAY_SANDBOX_URL ||
  "";

// Balanced Mode hysteresis thresholds
const GREEN_ON = Number(pulseConfig.greenOn ?? 66);
const GREEN_OFF = Number(pulseConfig.greenOff ?? 63);
const RED_ON = Number(pulseConfig.redOn ?? 39);
const RED_OFF = Number(pulseConfig.redOff ?? 42);

// Decide visual mode ("up" | "down" | "flat") with hysteresis
function classifyWithHysteresis(prevMode, pulseScore) {
  const s = Number(pulseScore);
  if (!Number.isFinite(s)) return "flat";

  if (prevMode === "up") {
    if (s >= GREEN_OFF) return "up";
    if (s <= RED_ON) return "down";
    return "flat";
  }

  if (prevMode === "down") {
    if (s <= RED_OFF) return "down";
    if (s >= GREEN_ON) return "up";
    return "flat";
  }

  // prevMode === "flat"
  if (s >= GREEN_ON) return "up";
  if (s <= RED_ON) return "down";
  return "flat";
}

// Hook: poll Pulse endpoint and compute state over time
function useMarketPulse10m() {
  const [pulseState, setPulseState] = React.useState(null);
  const [visualMode, setVisualMode] = React.useState("flat");

  React.useEffect(() => {
    if (!PULSE_URL) return;

    let stop = false;

    async function pull() {
      try {
        const sep = PULSE_URL.includes("?") ? "&" : "?";
        const r = await fetch(`${PULSE_URL}${sep}t=${Date.now()}`, {
          cache: "no-store",
        });
        const j = await r.json();
        const market = j?.deltas?.market || {};

        setPulseState((prev) => {
          const next = computeMarketPulse(prev, {
            dBreadthPct: Number(market.dBreadthPct ?? null),
            dMomentumPct: Number(market.dMomentumPct ?? null),
            riskOnPct: Number(market.riskOnPct ?? null),
          });

          setVisualMode((prevMode) =>
            classifyWithHysteresis(prevMode, next.pulse)
          );

          return next;
        });
      } catch {
        if (!stop) {
          setPulseState(null);
          setVisualMode("flat");
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

  return { pulseState, visualMode };
}

/**
 * 7-bar Pulse visual (bigger)
 * - 7 vertical bars, center tallest (like an EQ / signal meter)
 * - More positive pulse → more bars lit + darker green
 * - More negative pulse → more bars lit + darker red
 */
export default function PulseIcon10m(/* { data } */) {
  const { pulseState, visualMode } = useMarketPulse10m();
  const score = pulseState?.pulse;

  const intensity = Number.isFinite(score) ? score : 50;

  // Map score 0–100 to 0–7 "lit" bars for each direction
  let litBars = 0;
  if (visualMode === "up") {
    litBars = Math.round((intensity / 100) * 7);
  } else if (visualMode === "down") {
    // For down, invert so lower score = more red bars
    const neg = 100 - intensity;
    litBars = Math.round((neg / 100) * 7);
  } else {
    litBars = 0;
  }
  litBars = Math.max(0, Math.min(7, litBars));

  // Taller bar heights (pixels) – center tallest
  const heights = [10, 16, 22, 28, 22, 16, 10];

  // Color ramps (light → dark) for 7 levels
  const greenRamp = [
    "#bbf7d0",
    "#86efac",
    "#4ade80",
    "#22c55e",
    "#16a34a",
    "#15803d",
    "#166534",
  ];
  const redRamp = [
    "#fecaca",
    "#fca5a5",
    "#f87171",
    "#ef4444",
    "#dc2626",
    "#b91c1c",
    "#991b1b",
  ];
  const neutralRamp = [
    "#e5e7eb",
    "#e5e7eb",
    "#d1d5db",
    "#9ca3af",
    "#6b7280",
    "#4b5563",
    "#374151",
  ];

  const muted = "#1f2933";

  const getBarColor = (index) => {
    if (visualMode === "up" && litBars > 0) {
      const shadeIndex = Math.min(litBars - 1, greenRamp.length - 1);
      return index < litBars ? greenRamp[shadeIndex] : muted;
    }
    if (visualMode === "down" && litBars > 0) {
      const shadeIndex = Math.min(litBars - 1, redRamp.length - 1);
      return index < litBars ? redRamp[shadeIndex] : muted;
    }
    // Neutral mode: soft gray ramp based on distance from 50
    const neutralLevel = Math.round(
      (Math.
