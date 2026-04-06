// src/pages/rows/RowChart/overlays/Engine17Badges.jsx

import React from "react";

function toneFor(kind, value) {
  if (kind === "READINESS" && value === "WATCH") {
    return {
      bg: "rgba(96,165,250,0.18)",
      border: "rgba(96,165,250,0.55)",
      color: "#bfdbfe",
    };
  }

  if (kind === "READINESS" && value === "WAIT") {
    return {
      bg: "rgba(148,163,184,0.12)",
      border: "rgba(148,163,184,0.35)",
      color: "#cbd5e1",
    };
  }

  if (kind === "STRATEGY") {
    return {
      bg: "rgba(192,132,252,0.18)",
      border: "rgba(192,132,252,0.50)",
      color: "#e9d5ff",
    };
  }

  if (kind === "PHASE") {
    return {
      bg: "rgba(168,85,247,0.16)",
      border: "rgba(168,85,247,0.50)",
      color: "#e9d5ff",
    };
  }

  if (kind === "BIAS" && value === "SHORT_PREFERENCE") {
    return {
      bg: "rgba(239,68,68,0.16)",
      border: "rgba(239,68,68,0.50)",
      color: "#fecaca",
    };
  }

  if (kind === "BIAS" && value === "LONG_PREFERENCE") {
    return {
      bg: "rgba(34,197,94,0.16)",
      border: "rgba(34,197,94,0.50)",
      color: "#bbf7d0",
    };
  }

  if (kind === "STATE" && value === "ABOVE_PULLBACK") {
    return {
      bg: "rgba(34,197,94,0.16)",
      border: "rgba(34,197,94,0.50)",
      color: "#bbf7d0",
    };
  }

  if (kind === "STATE" && (value === "IN_PULLBACK" || value === "DEEP_PULLBACK")) {
    return {
      bg: "rgba(245,158,11,0.16)",
      border: "rgba(245,158,11,0.50)",
      color: "#fde68a",
    };
  }

  if (kind === "STATE" && value === "BELOW_PULLBACK") {
    return {
      bg: "rgba(239,68,68,0.16)",
      border: "rgba(239,68,68,0.50)",
      color: "#fecaca",
    };
  }

  if (kind === "CONTEXT" && value === "LONG_CONTEXT") {
    return {
      bg: "rgba(16,185,129,0.16)",
      border: "rgba(16,185,129,0.50)",
      color: "#bbf7d0",
    };
  }

  if (kind === "CONTEXT" && value === "SHORT_CONTEXT") {
    return {
      bg: "rgba(239,68,68,0.16)",
      border: "rgba(239,68,68,0.50)",
      color: "#fecaca",
    };
  }

  return {
    bg: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.18)",
    color: "#f3f4f6",
  };
}

function uniqueByKind(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.kind}|${item.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export default function Engine17Badges({
  overlayData,
  visible = true,
  showConfidenceStack = true,
  showReplaySyncedState = false,
}) {
  if (!visible || !overlayData?.ok) return null;

  const fib = overlayData?.fib || {};
  const meta = overlayData?.meta || {};

  const contextValue = fib?.context || "NONE";
  const stateValue = fib?.state || "UNKNOWN";
  const phaseValue = fib?.waveContext?.waveState || fib?.waveState || "UNKNOWN";
  const biasValue = fib?.waveContext?.macroBias || fib?.macroBias || "NONE";
  const readinessValue = fib?.readinessLabel || "WAIT";
  const strategyValue = fib?.strategyType || "NONE";

  const primary = [
    { kind: "CONTEXT", value: contextValue },
    { kind: "STATE", value: stateValue },
    { kind: "PHASE", value: phaseValue },
    { kind: "BIAS", value: biasValue },
  ];

  if (readinessValue && readinessValue !== "WAIT") {
    primary.unshift({
      kind: "READINESS",
      value: readinessValue,
    });
  }

  if (strategyValue && strategyValue !== "NONE") {
    primary.unshift({
      kind: "STRATEGY",
      value: strategyValue,
    });
  }

  const extras = [];

  if (showConfidenceStack) {
    if (meta?.sourceEnginesUsed?.length) {
      extras.push({
        kind: "ENGINES",
        value: meta.sourceEnginesUsed.join(", "),
      });
    }
  }

  if (showReplaySyncedState) {
    extras.push({
      kind: "REPLAY_SYNC",
      value: "PENDING",
    });
  }

  const allBadges = uniqueByKind([...primary, ...extras]);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 110,
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        justifyContent: "flex-end",
        maxWidth: "48%",
        pointerEvents: "none",
      }}
    >
      {allBadges.map((b, idx) => {
        const tone = toneFor(b.kind, b.value);
        return (
          <div
            key={`${b.kind}-${idx}`}
            style={{
              padding: "8px 14px",
              borderRadius: 12,
              border: `1.5px solid ${tone.border}`,
              background: tone.bg,
              color: tone.color,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 0.3,
              boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
              backdropFilter: "blur(3px)",
              whiteSpace: "nowrap",
            }}
          >
            {b.kind}: {String(b.value)}
          </div>
        );
      })}
    </div>
  );
}
