// src/pages/rows/RowChart/overlays/Engine17Badges.jsx

import React from "react";

function pretty(value, fallback = "UNKNOWN") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toneFor(kind, value, extra = null) {
  if (kind === "STATE") {
    if (/continuation long/i.test(String(value))) {
      return {
        bg: "rgba(34,197,94,0.16)",
        border: "rgba(34,197,94,0.50)",
        color: "#bbf7d0",
      };
    }
    if (/continuation short/i.test(String(value))) {
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

  if (kind === "STRUCTURE") {
    if (/short/i.test(String(value))) {
      return {
        bg: "rgba(245,158,11,0.16)",
        border: "rgba(245,158,11,0.50)",
        color: "#fde68a",
      };
    }
    if (/long/i.test(String(value))) {
      return {
        bg: "rgba(34,197,94,0.14)",
        border: "rgba(34,197,94,0.42)",
        color: "#bbf7d0",
      };
    }
    return {
      bg: "rgba(255,255,255,0.08)",
      border: "rgba(255,255,255,0.18)",
      color: "#f3f4f6",
    };
  }

  if (kind === "EXECUTION") {
    if (/long/i.test(String(value))) {
      return {
        bg: "rgba(59,130,246,0.18)",
        border: "rgba(59,130,246,0.60)",
        color: "#bfdbfe",
      };
    }
    if (/short/i.test(String(value))) {
      return {
        bg: "rgba(239,68,68,0.16)",
        border: "rgba(239,68,68,0.50)",
        color: "#fecaca",
      };
    }
    return {
      bg: "rgba(148,163,184,0.12)",
      border: "rgba(148,163,184,0.35)",
      color: "#cbd5e1",
    };
  }

  if (kind === "READINESS") {
    if (String(value) === "WATCH") {
      return {
        bg: "rgba(96,165,250,0.18)",
        border: "rgba(96,165,250,0.55)",
        color: "#bfdbfe",
      };
    }
    if (String(value) === "WAIT") {
      return {
        bg: "rgba(148,163,184,0.12)",
        border: "rgba(148,163,184,0.35)",
        color: "#cbd5e1",
      };
    }
    return {
      bg: "rgba(255,255,255,0.08)",
      border: "rgba(255,255,255,0.18)",
      color: "#f3f4f6",
    };
  }

  if (kind === "ALIGNMENT") {
    const s10 = num(extra?.score10);
    const s30 = num(extra?.score30);
    const best = Math.max(
      Number.isFinite(s10) ? s10 : -Infinity,
      Number.isFinite(s30) ? s30 : -Infinity
    );

    if (best >= 75) {
      return {
        bg: "rgba(34,197,94,0.16)",
        border: "rgba(34,197,94,0.50)",
        color: "#bbf7d0",
      };
    }
    if (best >= 50) {
      return {
        bg: "rgba(245,158,11,0.16)",
        border: "rgba(245,158,11,0.50)",
        color: "#fde68a",
      };
    }
    return {
      bg: "rgba(239,68,68,0.16)",
      border: "rgba(239,68,68,0.50)",
      color: "#fecaca",
    };
  }

  if (kind === "SCALP") {
    const s10 = num(extra?.overall10);
    const s30 = num(extra?.overall30);
    const best = Math.max(
      Number.isFinite(s10) ? s10 : -Infinity,
      Number.isFinite(s30) ? s30 : -Infinity
    );

    if (best >= 70) {
      return {
        bg: "rgba(34,197,94,0.16)",
        border: "rgba(34,197,94,0.50)",
        color: "#bbf7d0",
      };
    }
    if (best >= 40) {
      return {
        bg: "rgba(245,158,11,0.16)",
        border: "rgba(245,158,11,0.50)",
        color: "#fde68a",
      };
    }
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

function formatState(fib) {
  const executionBias = pretty(fib?.executionBias, "NONE");
  const prepBias = pretty(fib?.prepBias, "NONE");

  if (
    executionBias === "LONG_ONLY" &&
    /short/i.test(prepBias)
  ) {
    return "Continuation Long";
  }

  if (
    executionBias === "SHORT_ONLY" &&
    /long/i.test(prepBias)
  ) {
    return "Continuation Short";
  }

  if (executionBias === "LONG_ONLY") return "Long Active";
  if (executionBias === "SHORT_ONLY") return "Short Active";

  return pretty(fib?.state, "Unknown");
}

function formatStructure(fib) {
  const prepBias = pretty(fib?.prepBias, "NONE");

  if (prepBias === "SHORT_PREP") return "Short Prep";
  if (prepBias === "LONG_PREP") return "Long Prep";
  if (prepBias === "LONG") return "Long";
  if (prepBias === "SHORT") return "Short";
  if (prepBias === "NONE") return "None";

  return prepBias.replaceAll("_", " ");
}

function formatExecution(fib) {
  const executionBias = pretty(fib?.executionBias, "NONE");

  if (executionBias === "LONG_ONLY") return "Long Only";
  if (executionBias === "SHORT_ONLY") return "Short Only";
  if (executionBias === "NONE") return "None";

  return executionBias.replaceAll("_", " ");
}

function formatReadiness(fib) {
  return pretty(fib?.readinessLabel, "WAIT").replaceAll("_", " ");
}

function formatAlignment(fib) {
  const s10 = pretty(fib?.marketAlignment10State, "—");
  const s30 = pretty(fib?.marketAlignment30State, "—");
  return `10M ${s10} / 30M ${s30}`;
}

function formatScalp(fib) {
  const s10 = num(fib?.scalpOverall10);
  const s30 = num(fib?.scalpOverall30);
  const a = Number.isFinite(s10) ? s10.toFixed(0) : "—";
  const b = Number.isFinite(s30) ? s30.toFixed(0) : "—";
  return `10M ${a} • 30M ${b}`;
}

function Badge({ label, value, tone }) {
  return (
    <div
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
      {label}: {String(value)}
    </div>
  );
}

export default function Engine17Badges({
  overlayData,
  visible = true,
}) {
  if (!visible || !overlayData?.ok) return null;

  const fib = overlayData?.fib || {};

  const stateValue = formatState(fib);
  const structureValue = formatStructure(fib);
  const executionValue = formatExecution(fib);
  const readinessValue = formatReadiness(fib);
  const alignmentValue = formatAlignment(fib);
  const scalpValue = formatScalp(fib);

  const decisionBadges = [
    {
      label: "STATE",
      value: stateValue,
      tone: toneFor("STATE", stateValue),
    },
    {
      label: "STRUCTURE",
      value: structureValue,
      tone: toneFor("STRUCTURE", structureValue),
    },
    {
      label: "EXECUTION",
      value: executionValue,
      tone: toneFor("EXECUTION", executionValue),
    },
    {
      label: "READINESS",
      value: readinessValue,
      tone: toneFor("READINESS", readinessValue),
    },
  ];

  const marketBadges = [
    {
      label: "ALIGNMENT",
      value: alignmentValue,
      tone: toneFor("ALIGNMENT", alignmentValue, {
        score10: fib?.marketAlignment10Score,
        score30: fib?.marketAlignment30Score,
      }),
    },
    {
      label: "SCALP",
      value: scalpValue,
      tone: toneFor("SCALP", scalpValue, {
        overall10: fib?.scalpOverall10,
        overall30: fib?.scalpOverall30,
      }),
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 110,
        display: "flex",
        alignItems: "flex-start",
        gap: 18,
        maxWidth: "72%",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "flex-end",
        }}
      >
        {decisionBadges.map((b) => (
          <Badge
            key={b.label}
            label={b.label}
            value={b.value}
            tone={b.tone}
          />
        ))}
      </div>

      <div
        style={{
          width: 1,
          alignSelf: "stretch",
          background: "rgba(255,255,255,0.10)",
          minHeight: 40,
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "flex-end",
        }}
      >
        {marketBadges.map((b) => (
          <Badge
            key={b.label}
            label={b.label}
            value={b.value}
            tone={b.tone}
          />
        ))}
      </div>
    </div>
  );
}
