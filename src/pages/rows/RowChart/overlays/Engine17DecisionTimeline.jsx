// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

function formatWave(w) {
  if (!w) return "—";
  return w.replace("IN_", "").replace("_", " ");
}

export default function Engine17DecisionTimeline({
  overlayData,
  visible = true,
}) {
  if (!visible || !overlayData?.ok) return null;

  const fib = overlayData?.fib || {};

  const wave = fib.waveContext || {};

  const primary = formatWave(wave.primaryPhase);
  const intermediate = formatWave(wave.intermediatePhase);
  const minor = formatWave(wave.minorPhase);

  const trend4h = fib.trendState_4h || "—";

  const prepBias = fib.prepBias || "NONE";
  const executionBias = fib.executionBias || "NONE";

  const watchShort = fib.continuationWatchShort;
  const watchLong = fib.continuationWatchLong;

  const triggerShort = fib.continuationTriggerShort;
  const triggerLong = fib.continuationTriggerLong;

  const breakdownRef = fib.breakdownRef;

  const readiness = fib.readinessLabel || "WAIT";

  // -------------------------------
  // Interpretation (NO guessing)
  // -------------------------------

  let interpretation = "No active setup";
  let confirmation = "No confirmation condition";

  if (prepBias === "SHORT_PREP" && watchShort) {
    interpretation = "Short prep active — watching for breakdown";
    confirmation = breakdownRef
      ? `Break below ${Number(breakdownRef).toFixed(2)} confirms downside continuation`
      : "Break below structure confirms downside continuation";
  }

  if (prepBias === "LONG_PREP" && watchLong) {
    interpretation = "Long prep active — watching for breakout";
    confirmation = fib.lastLowerHigh
      ? `Break above ${Number(fib.lastLowerHigh).toFixed(2)} confirms upside continuation`
      : "Break above structure confirms upside continuation";
  }

  if (triggerShort) {
    interpretation = "Downside continuation confirmed";
    confirmation = "Wave 4 pullback / breakdown in progress";
  }

  if (triggerLong) {
    interpretation = "Upside continuation confirmed";
    confirmation = "Bullish continuation in progress";
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        top: 70,
        zIndex: 105,
        width: 420,
        maxWidth: "32%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(6,10,20,0.90)",
        padding: 14,
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
        STRUCTURE
      </div>

      <div style={{ fontSize: 14, marginBottom: 6 }}>
        Primary: {primary}
      </div>
      <div style={{ fontSize: 14, marginBottom: 6 }}>
        Intermediate: {intermediate}
      </div>
      <div style={{ fontSize: 14, marginBottom: 10 }}>
        Minor: {minor}
      </div>

      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
        TREND
      </div>

      <div style={{ fontSize: 14, marginBottom: 10 }}>
        4H Trend: {trend4h}
      </div>

      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
        CURRENT READ
      </div>

      <div style={{ fontSize: 14, marginBottom: 10 }}>
        {interpretation}
      </div>

      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
        CONFIRMATION
      </div>

      <div style={{ fontSize: 14, marginBottom: 10 }}>
        {confirmation}
      </div>

      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
        EXECUTION
      </div>

      <div style={{ fontSize: 14 }}>
        {executionBias.replace("_", " ")} | {readiness.replace("_", " ")}
      </div>
    </div>
  );
}
