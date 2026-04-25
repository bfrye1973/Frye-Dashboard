// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

function formatWave(value) {
  if (!value) return "—";
  return String(value).replace(/^IN_/, "").replaceAll("_", " ");
}

function formatText(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value).replaceAll("_", " ");
}

function formatLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function conditionText(code) {
  const c = String(code || "").toUpperCase();

  if (c === "BULLISH_BUT_WEAKENING") return "Bullish trend is weakening";
  if (c === "SHORT_RISK_RISING") return "Short risk is rising";
  if (c === "BEARISH_BUT_WEAKENING") return "Bearish trend is weakening";
  if (c === "LONG_RISK_RISING") return "Long risk is rising";

  return null;
}

export default function Engine17DecisionTimeline({
  overlayData,
  visible = true,
}) {
  if (!visible || !overlayData?.ok) return null;

  const fib = overlayData?.fib || {};
  const wave = fib?.waveContext || {};

  const primary = formatWave(wave?.primaryPhase);
  const intermediate = formatWave(wave?.intermediatePhase);
  const minor = formatWave(wave?.minorPhase);

  // IMPORTANT:
  // 4H trend must come ONLY from backend 4H truth.
  // Do NOT fall back to executionBias.
  const trend4h = formatText(fib?.trendState_4h, "—");

  const prepBias = String(fib?.prepBias || "NONE").toUpperCase();
  const readiness = formatText(fib?.readinessLabel, "WAIT");
  const executionBias = formatText(fib?.executionBias, "—");
  const strategyType = String(fib?.strategyType || "NONE").toUpperCase();
  const trend1h = String(fib?.trendState_1h || "").toUpperCase();
  const trend4hRaw = String(fib?.trendState_4h || "").toUpperCase();
  const decisionAction = String(fib?.decisionAction || "").toUpperCase();
  const invalidated = !!fib?.invalidated;

  const watchShort = !!fib?.continuationWatchShort;
  const watchLong = !!fib?.continuationWatchLong;
  const triggerShort = !!fib?.continuationTriggerShort;
  const triggerLong = !!fib?.continuationTriggerLong;

  const breakdownRef = formatLevel(fib?.breakdownRef);
  const lastHigherLow = formatLevel(fib?.lastHigherLow);
  const lastLowerHigh = formatLevel(fib?.lastLowerHigh);
  const wave3Status = String(fib?.wave3Status || "").toUpperCase();
  const nextStructure = String(fib?.nextExpectedStructure || "").toUpperCase();
  const conditionLines = Array.isArray(fib?.waveReasonCodes)
  ? fib.waveReasonCodes.map(conditionText).filter(Boolean).slice(0, 2)
  : [];

  let currentRead = "No active setup";
  let confirmation = "No confirmation condition";
  // --- WAVE 3 EXTENSION PRIORITY LOGIC (TOP PRIORITY) ---
  if (wave3Status === "ACTIVE_EXTENSION") {
    currentRead = "Wave 3 Active";
    confirmation = "Watching for extension";
  }

  if (
    fib?.exhaustionTriggerShort &&
    executionBias === "LONG ONLY" &&
    trend4hRaw === "LONG_ONLY"
  ) {
    currentRead = "Trend remains long-only";
    confirmation =
      "Short exhaustion risk present • Short is countertrend and blocked • Wait for higher timeframe breakdown";
  }
  if (wave3Status === "FIRST_WARNING") {
    currentRead = "Minor W3 Warning";
    confirmation = "Possible W4 forming";
  }

  if (prepBias === "SHORT_PREP" && watchShort) {
    currentRead = "Short prep active — watching for breakdown";
    confirmation = breakdownRef
      ? `Break below ${breakdownRef} confirms structure breakdown`
      : lastHigherLow
      ? `Break below ${lastHigherLow} confirms downside continuation`
      : "Break below structure confirms breakdown";
  }

  if (prepBias === "LONG_PREP" && watchLong) {
    currentRead = "Long prep active — watching for breakout";
    confirmation = lastLowerHigh
      ? `Break above ${lastLowerHigh} confirms upside continuation`
      : "Break above structure confirms upside continuation";
  }

  if (strategyType === "EXHAUSTION" && wave3Status !== "ACTIVE_EXTENSION") {
  currentRead = "Exhaustion setup active";

  if (executionBias === "LONG ONLY" || executionBias === "LONG_ONLY") {
    confirmation = "Watching for downside reversal";
  } else if (executionBias === "SHORT ONLY" || executionBias === "SHORT_ONLY") {
    confirmation = "Watching for upside reversal";
  } else {
    confirmation = "Watching for reversal confirmation";
  }
}

  if (triggerShort) {
    currentRead = "Downside continuation confirmed";
    confirmation = breakdownRef
      ? `Break below ${breakdownRef} confirmed downside continuation`
      : lastHigherLow
      ? `Break below ${lastHigherLow} confirmed downside continuation`
      : "Downside structure break confirmed";
  }

  if (triggerLong) {
    currentRead = "Upside continuation confirmed";
    confirmation = lastLowerHigh
      ? `Break above ${lastLowerHigh} confirmed upside continuation`
      : "Upside structure break confirmed";
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 109,
        width: 760,
        maxWidth: "72%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(6,10,20,0.94)",
        padding: "16px 20px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 28,
          lineHeight: 1.35,
          marginBottom: 10,
          color: "#f8fafc",
        }}
      >
        {`Primary ${primary} | Intermediate ${intermediate} | Minor ${minor}`}
      </div>

      <div
        style={{
          fontSize: 22,
          lineHeight: 1.45,
          marginBottom: 8,
          color: "#cbd5e1",
          fontWeight: 800,
        }}
      >
        {`HTF Bias: ${trend4h}`}
      </div>

      <div
        style={{
          fontSize: 22,
          lineHeight: 1.45,
          marginBottom: 8,
          color: "#e5e7eb",
          fontWeight: 800,
        }}
      >
        {currentRead}
      </div>

      <div
        style={{
          fontSize: 20,
          lineHeight: 1.45,
          marginBottom: 8,
          color: "#cbd5e1",
          fontWeight: 700,
        }}
      >
        {confirmation}
      </div>
      
      {conditionLines.length > 0 && (
        <div
          style={{
            fontSize: 19,
            lineHeight: 1.4,
            marginBottom: 8,
           color: "#fbbf24",
           fontWeight: 700,
         }}
       >
         {conditionLines.map((line, idx) => (
           <div key={idx}>{line}</div>
         ))}
       </div>
     )}
      <div
        style={{
          fontSize: 18,
          lineHeight: 1.4,
          color: "#94a3b8",
          fontWeight: 700,
        }}
      >
        {`Execution (LTF): ${executionBias} | Readiness: ${readiness}`}
      </div>
    </div>
  );
}
