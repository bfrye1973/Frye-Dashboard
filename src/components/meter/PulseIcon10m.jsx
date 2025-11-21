// src/components/meter/PulseIcon10m.jsx
// Ferrari Dashboard — 10m Pulse Icon (R12.8 + Balanced Mode)

import React from "react";
import { computeMarketPulse } from "../../algos/pulse/formulas";
import pulseConfig from "../../algos/pulse/config.json";

// Prefer a dedicated Pulse URL, fallback to sandbox if needed.
const PULSE_URL =
  process.env.REACT_APP_PULSE_URL ||
  process.env.REACT_APP_INTRADAY_SANDBOX_URL ||
  "";

// Balanced Mode hysteresis thresholds
const GREEN_ON = Number(pulseConfig.greenOn ?? 66);
const GREEN_OFF = Number(pulseConfig.greenOff ?? 63);
const RED_ON = Number(pulseConfig.redOn ?? 39);
const RED_OFF = Number(pulseConfig.redOff ?? 42);
// hysteresisCycles is 1 in our config, so we don't need extra cycle counters

// Decide visual mode with hysteresis using previous mode + new pulse score.
// Modes: "up" (green), "down" (red), "flat" (neutral/white).
function classifyWithHysteresis(prevMode, pulseScore) {
  const s = Number(pulseScore);
  if (!Number.isFinite(s)) return "flat";

  // Start from previous mode and gently move toward new regime
  if (prevMode === "up") {
    // Stay green while above greenOff threshold.
    if (s >= GREEN_OFF) return "up";
    // Drop to red only if really washed out
    if (s <= RED_ON) return "down";
    // Otherwise neutral
    return "flat";
  }

  if (prevMode === "down") {
    // Stay red while below redOff threshold.
    if (s <= RED_OFF) return "down";
    // If we jump high enough, can go straight green
    if (s >= GREEN_ON) return "up";
    return "flat";
  }

  // prevMode === "flat"
  if (s >= GREEN_ON) return "up";
  if (s <= RED_ON) return "down";
  return "flat";
}

// Hook: poll /live/pills (or configured Pulse endpoint) and compute Pulse state.
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

        // Use updater form so we always get the latest pulseState
        setPulseState((prev) => {
          const next = computeMarketPulse(prev, {
            dBreadthPct: Number(market.dBreadthPct ?? null),
            dMomentumPct: Number(market.dMomentumPct ?? null),
            riskOnPct: Number(market.riskOnPct ?? null),
          });

          // Update visual mode based on Balanced hysteresis
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
 * PulseIcon10m
 * Renders a small bar-chart icon + Pulse score for the 10-minute Market Pulse.
 * New behavior:
 *   - Reads from /live/pills (5m DELTAS job via PULSE_URL)
 *   - Uses Balanced Mode smoothing / decay / hysteresis
 *   - Color:
 *       green: strong positive pulse
 *       red:   strong negative pulse
 *       white: neutral / mixed
 *
 * The `data` prop from RowMarketOverview is intentionally ignored now;
 * Pulse is driven entirely by the deltas feed.
 */
export default function PulseIcon10m(/* { data } */) {
  const { pulseState, visualMode } = useMarketPulse10m();
  const score = pulseState?.pulse;

  let fillColor;
  if (visualMode === "up") {
    fillColor = "#19c37d"; // green
  } else if (visualMode === "down") {
    fillColor = "#ff5a5a"; // red
  } else {
    fillColor = "#e5e7eb"; // neutral / white
  }

  const container = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 6px",
    borderRadius: 8,
    border: "1px solid rgba(120,150,190,.25)",
    background: "rgba(8,12,20,.55)",
    color: "#e5e7eb",
    lineHeight: 1.1,
  };

  const valStyle = {
    fontWeight: 700,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
  };

  const lblStyle = {
    fontSize: 10,
    opacity: 0.85,
  };

  const title =
    `Pulse 10m • Score: ${
      Number.isFinite(score) ? score.toFixed(1) : "—"
    }` + (pulseState
      ? ` • d5m: ${pulseState.d5m.toFixed(1)} • d10m: ${pulseState.d10m.toFixed(
          1
        )}`
      : "");

  return (
    <div style={container} title={title}>
      {/* bar-chart glyph, colored by visualMode */}
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <rect x="1" y="9" width="3" height="6" rx="1" fill={fillColor} />
        <rect
          x="6"
          y="6"
          width="3"
          height="9"
          rx="1"
          fill={fillColor}
          opacity=".9"
        />
        <rect
          x="11"
          y="3"
          width="3"
          height="12"
          rx="1"
          fill={fillColor}
          opacity=".8"
        />
      </svg>

      {/* value + label */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <span style={valStyle}>
          {Number.isFinite(score) ? score.toFixed(1) : "—"}
        </span>
        <span style={lblStyle}>Pulse</span>
      </div>
    </div>
  );
}
