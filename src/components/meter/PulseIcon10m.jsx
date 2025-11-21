// src/components/meter/PulseIcon10m.jsx
// Ferrari Dashboard — 10m Pulse Icon (R12.8)

import React from "react";
import {
  computeMarketPulse,
  classifyPulse,
} from "../../algos/pulse/formulas";

// We reuse the same env var as the sandbox deltas workflow.
// This should point at /live/pills or the intraday deltas endpoint.
const PULSE_URL = process.env.REACT_APP_INTRADAY_SANDBOX_URL || "";

function useMarketPulse10m() {
  const [pulseState, setPulseState] = React.useState(null);

  React.useEffect(() => {
    if (!PULSE_URL) return;

    let stop = false;
    let currentState = pulseState || null;

    async function pull() {
      try {
        const sep = PULSE_URL.includes("?") ? "&" : "?";
        const r = await fetch(`${PULSE_URL}${sep}t=${Date.now()}`, {
          cache: "no-store",
        });
        const j = await r.json();

        const market = j?.deltas?.market || {};
        // Compute smoothed / decayed pulse state
        const next = computeMarketPulse(currentState, {
          dBreadthPct: Number(market.dBreadthPct ?? null),
          dMomentumPct: Number(market.dMomentumPct ?? null),
          riskOnPct: Number(market.riskOnPct ?? null),
        });

        currentState = next;
        if (!stop) {
          setPulseState(next);
        }
      } catch {
        if (!stop) {
          setPulseState(null);
        }
      }
    }

    pull();
    const id = setInterval(pull, 30_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // PULSE_URL is effectively constant at runtime

  return pulseState;
}

export default function PulseIcon10m() {
  const pulse = useMarketPulse10m();
  const score = pulse?.pulse;

  const mode = classifyPulse(score); // "up" | "down" | "flat"

  let bg;
  let shadow;
  if (mode === "up") {
    bg = "#22c55e";
    shadow = "0 0 8px rgba(34,197,94,0.7)";
  } else if (mode === "down") {
    bg = "#ef4444";
    shadow = "0 0 8px rgba(239,68,68,0.7)";
  } else {
    bg = "#e5e7eb";
    shadow = "0 0 6px rgba(148,163,184,0.4)";
  }

  const label =
    Number.isFinite(score) && score !== null ? score.toFixed(0) : "—";

  const tooltip = Number.isFinite(score)
    ? `Market Pulse: ${score.toFixed(1)}`
    : "Market Pulse: n/a";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: "#9ca3af",
        fontWeight: 600,
      }}
    >
      <div
        title={tooltip}
        style={{
          width: 22,
          height: 22,
          borderRadius: "999px",
          border: "2px solid #020617",
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: shadow,
          fontSize: 11,
          fontWeight: 700,
          color: mode === "flat" ? "#111827" : "#0b1120",
        }}
      >
        {label}
      </div>
      <span>Pulse</span>
    </div>
  );
}
