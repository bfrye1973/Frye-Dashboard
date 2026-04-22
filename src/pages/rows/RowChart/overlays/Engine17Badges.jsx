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
  if (v.includes("NO ALIGNMENT")) return "NO ALIGNMENT";
  if (v.includes("NONE")) return "NO ALIGNMENT";
  if (v.includes("BULL")) return "BULL";
  if (v.includes("BEAR")) return "BEAR";

  return humanize(value, "—");
}

function formatState(fib) {
  const prepBias = String(fib?.prepBias || "").toUpperCase();
  const triggerShort = !!fib?.continuationTriggerShort;
  const triggerLong = !!fib?.continuationTriggerLong;
  const watchShort = !!fib?.continuationWatchShort;
  const watchLong = !!fib?.continuationWatchLong;

  if (triggerShort) return "CONFIRMED SHORT";
  if (triggerLong) return "CONFIRMED LONG";
  if (prepBias === "SHORT_PREP" && watchShort) return "BREAKDOWN WATCH";
  if (prepBias === "LONG_PREP" && watchLong) return "BREAKOUT WATCH";

  const state = text(fib?.state, "Unknown");
  return humanize(state, "Unknown");
}

function formatStructure(fib) {
  const prepBias = String(fib?.prepBias || "").toUpperCase();

  if (prepBias === "SHORT_PREP") return "SHORT PREP";
  if (prepBias === "LONG_PREP") return "LONG PREP";
  if (prepBias === "SHORT_PREFERENCE") return "SHORT PREFERENCE";
  if (prepBias === "LONG_PREFERENCE") return "LONG PREFERENCE";
  if (prepBias === "NONE" || !prepBias) return "NONE";

  return humanize(prepBias, "NONE").toUpperCase();
}

function formatExecution(fib) {
  const executionBias = String(fib?.executionBias || "").toUpperCase();

  if (executionBias === "LONG_ONLY") return "LONG ONLY";
  if (executionBias === "SHORT_ONLY") return "SHORT ONLY";
  if (executionBias === "NONE" || !executionBias) return "NEUTRAL";

  return humanize(executionBias, "NEUTRAL").toUpperCase();
}

function formatReadiness(fib) {
  const raw = String(fib?.readinessLabel || "").toUpperCase();

  if (raw === "WAIT_FOR_MAGNET_RESOLUTION") return "WAIT FOR BREAK";
  if (raw === "WATCH_FOR_BREAKDOWN") return "WAIT FOR BREAK";
  if (raw === "WATCH_FOR_BREAKOUT") return "WAIT FOR BREAK";
  if (raw === "WATCH") return "WATCH";
  if (raw === "WAIT") return "NOT READY";
  if (raw === "READY") return "READY";
  if (raw === "ENTER") return "TRIGGERED";

  return humanize(raw || "WAIT", "WAIT").toUpperCase();
}

function formatBias(fib) {
  const direction = String(fib?.decisionDirection || fib?.direction || "").toUpperCase();
  const context = String(fib?.context || "").toUpperCase();

  if (direction === "LONG") return "LONG";
  if (direction === "SHORT") return "SHORT";
  if (context.includes("LONG")) return "LONG";
  if (context.includes("SHORT")) return "SHORT";

  return "NEUTRAL";
}

function shortWave(value) {
  const raw = String(value || "").toUpperCase();
  if (!raw) return "—";
  if (raw.startsWith("IN_")) return raw.replace("IN_", "");
  return raw.replaceAll("_", " ");
}

function formatWave(fib) {
  const wave = fib?.waveContext || {};
  const p = shortWave(wave?.primaryPhase);
  const i = shortWave(wave?.intermediatePhase);
  const m = shortWave(wave?.minorPhase);

  return `${p} / ${i} / ${m}`;
}

function formatQuality(fib) {
  const score = num(fib?.qualityScore);
  const grade = text(fib?.qualityGrade, "").toUpperCase();

  const scoreText = score == null ? "—" : String(Math.round(score));

  if (grade) return `${scoreText} (${grade})`;
  return scoreText;
}

function formatAlignment10(fib) {
  return simplifyAlignmentState(fib?.marketAlignment10State);
}

function formatAlignment30(fib) {
  return simplifyAlignmentState(fib?.marketAlignment30State);
}

function toneForState(value) {
  const v = String(value || "").toLowerCase();

  if (v.includes("confirmed short") || v.includes("breakdown")) {
    return {
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.42)",
      color: "#fee2e2",
    };
  }

  if (v.includes("confirmed long") || v.includes("breakout")) {
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

  if (v.includes("TRIGGERED") || v.includes("READY")) {
    return {
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.42)",
      color: "#dcfce7",
    };
  }

  if (v.includes("WATCH")) {
    return {
      bg: "rgba(255,255,255,0.09)",
      border: "rgba(255,255,255,0.22)",
      color: "#ffffff",
    };
  }

  if (v.includes("WAIT") || v.includes("NOT READY")) {
    return {
      bg: "rgba(148,163,184,0.10)",
      border: "rgba(148,163,184,0.26)",
      color: "#cbd5e1",
    };
  }

  return {
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.16)",
    color: "#f8fafc",
  };
}

function toneForBias(value) {
  const v = String(value || "").toUpperCase();

  if (v === "SHORT") {
    return {
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.42)",
      color: "#fee2e2",
    };
  }

  if (v === "LONG") {
    return {
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.42)",
      color: "#dcfce7",
    };
  }

  return {
    bg: "rgba(148,163,184,0.10)",
    border: "rgba(148,163,184,0.26)",
    color: "#cbd5e1",
  };
}

function toneForWave() {
  return {
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.16)",
    color: "#f8fafc",
  };
}

function toneForQuality(fib) {
  const score = num(fib?.qualityScore);

  if (score != null && score >= 70) {
    return {
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.42)",
      color: "#dcfce7",
    };
  }

  if (score != null && score >= 40) {
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

function toneForAlignmentScore(score) {
  const n = num(score);

  if (n != null && n >= 75) {
    return {
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.42)",
      color: "#dcfce7",
    };
  }

  if (n != null && n >= 50) {
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
        gap: 10,
        padding: large ? "11px 16px" : "10px 14px",
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
          fontSize: large ? 11 : 10,
          fontWeight: 900,
          letterSpacing: 0.85,
          opacity: 0.78,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: large ? 15 : 13,
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
  const biasValue = formatBias(fib);
  const waveValue = formatWave(fib);
  const qualityValue = formatQuality(fib);
  const alignment10Value = formatAlignment10(fib);
  const alignment30Value = formatAlignment30(fib);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        right: 12,
        zIndex: 115,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        width: "calc(100% - 24px)",
        pointerEvents: "none",
       }}
     >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-start",
          gap: 8,
          flex: "1 1 auto",
          minWidth: 0,
        }}
      >
        <Badge
          label="STATE"
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
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8,
          flex: "1 1 auto",
          minWidth: 0,
        }}
      >
        <Badge
          label="BIAS"
          value={biasValue}
          tone={toneForBias(biasValue)}
        />
        <Badge
          label="WAVE"
          value={waveValue}
          tone={toneForWave()}
        />
        <Badge
          label="QUALITY"
          value={qualityValue}
          tone={toneForQuality(fib)}
        />
        <Badge
          label="ALIGNMENT 10"
          value={alignment10Value}
          tone={toneForAlignmentScore(fib?.marketAlignment10Score)}
        />
        <Badge
          label="ALIGNMENT 30"
          value={alignment30Value}
          tone={toneForAlignmentScore(fib?.marketAlignment30Score)}
        />
      </div>
    </div>
  );
}
