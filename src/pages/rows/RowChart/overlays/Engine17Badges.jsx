// src/pages/rows/RowChart/overlays/Engine17Badges.jsx

import React from "react";

function toneFor(kind, value) {
  if (kind === "EXHAUSTION_READY_SHORT") {
    return {
      bg: "rgba(239,68,68,0.22)",
      border: "rgba(239,68,68,0.65)",
      color: "#fecaca",
    };
  }
  if (kind === "EXHAUSTION_READY_LONG") {
    return {
      bg: "rgba(34,197,94,0.20)",
      border: "rgba(34,197,94,0.62)",
      color: "#bbf7d0",
    };
  }
  if (kind === "READINESS") {
    return {
      bg: "rgba(248,250,252,0.12)",
      border: "rgba(248,250,252,0.32)",
      color: "#f8fafc",
    };
  }
  if (kind === "STRATEGY") {
    return {
      bg: "rgba(192,132,252,0.18)",
      border: "rgba(192,132,252,0.50)",
      color: "#e9d5ff",
    };
  }
  if (kind === "VOLUME" && value === "CONFIRMED") {
    return {
      bg: "rgba(167,139,250,0.18)",
      border: "rgba(167,139,250,0.55)",
      color: "#ddd6fe",
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

  const badges = Array.isArray(overlayData?.badges) ? overlayData.badges : [];
  const meta = overlayData?.meta || {};
  const fib = overlayData?.fib || {};

  const contextValue =
    badges.find((b) => b.kind === "CONTEXT")?.value || fib?.context || "NONE";

  const stateValue =
    badges.find((b) => b.kind === "STATE")?.value || fib?.state || "UNKNOWN";

  const volumeValue =
    badges.find((b) => b.kind === "VOLUME")?.value ||
    (fib?.impulseVolumeConfirmed ? "CONFIRMED" : "NORMAL");

  const primary = [
    { kind: "CONTEXT", value: contextValue },
    { kind: "STATE", value: stateValue },
    { kind: "VOLUME", value: volumeValue },
  ];

  if (fib?.exhaustionDetected && fib?.exhaustionActive) {
    primary.unshift({
      kind: fib.exhaustionShort
        ? "EXHAUSTION_READY_SHORT"
        : "EXHAUSTION_READY_LONG",
      value: "EXHAUSTION READY",
    });
  } else if (fib?.readinessLabel && fib.readinessLabel !== "NO_SETUP") {
    primary.unshift({
      kind: "READINESS",
      value: fib.readinessLabel,
    });
  }

  if (fib?.strategyType && fib.strategyType !== "NONE") {
    primary.push({
      kind: "STRATEGY",
      value: fib.strategyType,
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

    if (meta?.missingSections?.length) {
      extras.push({
        kind: "MISSING",
        value: meta.missingSections.join(", "),
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
              padding: "10px 16px",
              borderRadius: 12,
              border: `1.5px solid ${tone.border}`,
              background: tone.bg,
              color: tone.color,
              fontSize: 20,
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
