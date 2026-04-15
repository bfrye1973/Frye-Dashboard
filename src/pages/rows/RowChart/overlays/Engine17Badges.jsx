// src/pages/rows/RowChart/overlays/Engine17Badges.jsx

import React from "react";

function text(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function humanize(value, fallback = "None") {
  const raw = text(value, fallback);
  if (raw === "—") return fallback;
  return raw.replaceAll("_", " ");
}

function simplifyAlignmentState(value) {
  const v = String(value || "").toUpperCase();

  if (!v) return "—";
  if (v.includes("FULL")) return "FULL";
  if (v.includes("PARTIAL")) return "PARTIAL";
  if (v.includes("NONE")) return "NONE";
  if (v.includes("BULL")) return "BULL";
  if (v.includes("BEAR")) return "BEAR";

  return humanize(value, "—");
}

function formatState(fib) {
  const state = text(fib?.state, "Unknown");
  return humanize(state, "Unknown");
}

function formatStructure(fib) {
  const prepBias = String(fib?.prepBias || "").toUpperCase();

  if (prepBias === "SHORT_PREP") return "Short Prep";
  if (prepBias === "LONG_PREP") return "Long Prep";
  if (prepBias === "SHORT_PREFERENCE") return "Short Preference";
  if (prepBias === "LONG_PREFERENCE") return "Long Preference";
  if (prepBias === "NONE" || !prepBias) return "None";

  return humanize(prepBias, "None");
}

function formatExecution(fib) {
  const executionBias = String(fib?.executionBias || "").toUpperCase();

  if (executionBias === "LONG_ONLY") return "Long Only";
  if (executionBias === "SHORT_ONLY") return "Short Only";
  if (executionBias === "NONE" || !executionBias) return "None";

  return humanize(executionBias, "None");
}

function formatReadiness(fib) {
  return humanize(fib?.readinessLabel, "WAIT");
}

function formatAlignment(fib) {
  const s10 = simplifyAlignmentState(fib?.marketAlignment10State);
  const s30 = simplifyAlignmentState(fib?.marketAlignment30State);
  return `10M ${s10} / 30M ${s30}`;
}

function formatScalp(fib) {
  const s10 = num(fib?.scalpOverall10);
  const s30 = num(fib?.scalpOverall30);

  const left = s10 == null ? "—" : String(Math.round(s10));
  const right = s30 == null ? "—" : String(Math.round(s30));

  return `10M ${left} • 30M ${right}`;
}

function toneForState(value) {
  const v = String(value || "").toLowerCase();

  if (v.includes("long")) {
    return {
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.42)",
      color: "#dcfce7",
    };
  }

  if (v.includes("short")) {
    return {
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.42)",
      color: "#fee2e2",
    };
  }

  return {
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.16)",
    color: "#f8fafc",
  };
}

function toneForStructure(value) {
  const v = String(value || "").toLowerCase();

  if (v.includes("short")) {
    return {
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.44)",
      color: "#fde68a",
    };
  }

  if (v.includes("long")) {
    return {
      bg: "rgba(250,204,21,0.12)",
      border: "rgba(250,204,21,0.36)",
      color: "#fef08a",
    };
  }

  return {
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.16)",
    color: "#f8fafc",
  };
}

function toneForExecution(value) {
  const v = String(value || "").toLowerCase();

  if (v.includes("long")) {
    return {
      bg: "rgba(59,130,246,0.16)",
      border: "rgba(59,130,246,0.48)",
      color: "#dbeafe",
    };
  }

  if (v.includes("short")) {
    return {
      bg: "rgba(96,165,250,0.14)",
      border: "rgba(96,165,250,0.42)",
      color: "#dbeafe",
    };
  }

  return {
    bg: "rgba(148,163,184,0.10)",
    border: "rgba(148,163,184,0.26)",
    color: "#cbd5e1",
  };
}

function toneForReadiness(value) {
  const v = String(value || "").toUpperCase();

  if (v === "WATCH") {
    return {
      bg: "rgba(255,255,255,0.09)",
      border: "rgba(255,255,255,0.22)",
      color: "#ffffff",
    };
  }

  if (v === "WAIT") {
    return {
      bg: "rgba(148,163,184,0.10)",
      border: "rgba(148,163,184,0.26)",
      color: "#cbd5e1",
    };
  }

  if (v === "GO" || v === "READY" || v === "ENTER") {
    return {
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.42)",
      color: "#dcfce7",
    };
  }

  return {
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.16)",
    color: "#f8fafc",
  };
}

function toneForAlignment(fib) {
  const s10 = num(fib?.marketAlignment10Score);
  const s30 = num(fib?.marketAlignment30Score);

  const best = Math.max(
    Number.isFinite(s10) ? s10 : -Infinity,
    Number.isFinite(s30) ? s30 : -Infinity
  );

  if (best >= 75) {
    return {
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.42)",
      color: "#dcfce7",
    };
  }

  if (best >= 50) {
    return {
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.42)",
      color: "#fde68a",
    };
  }

  return {
    bg: "rgba(239,68,68,0.14)",
    border: "rgba(239,68,68,0.42)",
    color: "#fee2e2",
  };
}

function toneForScalp(fib) {
  const s10 = num(fib?.scalpOverall10);
  const s30 = num(fib?.scalpOverall30);

  const best = Math.max(
    Number.isFinite(s10) ? s10 : -Infinity,
    Number.isFinite(s30) ? s30 : -Infinity
  );

  if (best >= 70) {
    return {
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.42)",
      color: "#dcfce7",
    };
  }

  if (best >= 40) {
    return {
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.42)",
      color: "#fde68a",
    };
  }

  return {
    bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.42)",
      color: "#fee2e2",
  };
}

function Badge({ label, value, tone, large = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: large ? "9px 14px" : "8px 12px",
        borderRadius: 11,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        boxShadow: "0 2px 10px rgba(0,0,0,0.24)",
        backdropFilter: "blur(3px)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontSize: large ? 10 : 9,
          fontWeight: 900,
          letterSpacing: 0.8,
          opacity: 0.78,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: large ? 13 : 12,
          fontWeight: large ? 900 : 800,
          letterSpacing: 0.2,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function Engine17Badges({ overlayData, visible = true }) {
  if (!visible || !overlayData?.ok) return null;

  const fib = overlayData?.fib || {};

  const stateValue = formatState(fib);
  const structureValue = formatStructure(fib);
  const executionValue = formatExecution(fib);
  const readinessValue = formatReadiness(fib);
  const alignmentValue = formatAlignment(fib);
  const scalpValue = formatScalp(fib);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 115,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 12,
        maxWidth: "78%",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Badge
          label="TEST STATE"
          value={stateValue}
          tone={toneForState(stateValue)}
          large={true}
        />
        <Badge
          label="STRUCTURE"
          value={structureValue}
          tone={toneForStructure(structureValue)}
        />
        <Badge
          label="EXECUTION"
          value={executionValue}
          tone={toneForExecution(executionValue)}
        />
        <Badge
          label="READINESS"
          value={readinessValue}
          tone={toneForReadiness(readinessValue)}
        />
      </div>

      <div
        style={{
          width: 1,
          height: 32,
          background: "rgba(255,255,255,0.14)",
          flex: "0 0 auto",
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Badge
          label="ALIGNMENT"
          value={alignmentValue}
          tone={toneForAlignment(fib)}
        />
        <Badge
          label="SCALP"
          value={scalpValue}
          tone={toneForScalp(fib)}
        />
      </div>
    </div>
  );
}
