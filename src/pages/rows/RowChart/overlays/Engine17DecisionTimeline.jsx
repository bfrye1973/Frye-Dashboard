// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

function formatWave(w) {
  if (!w) return "—";
  return w.replace("IN_", "").replaceAll("_", " ");
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

  let interpretation = "No active setup";
  let confirmation = "No confirmation";

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
    confirmation = "Wave 4 breakdown in progress";
  }

  if (triggerLong) {
    interpretation = "Upside continuation confirmed";
    confirmation = "Bullish continuation in progress";
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 120,
        width: 520,
        maxWidth: "60%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(6,10,20,0.92)",
        padding: 14,
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 6 }}>
        {`Primary ${primary} | Intermediate ${intermediate} | Minor ${minor}`}
      </div>

      <div style={{ fontSize: 13, marginBottom: 6 }}>
        4H Trend: {executionBias.replaceAll("_", " ")}
      </div>

      <div style={{ fontSize: 13, marginBottom: 6 }}>
        {interpretation}
      </div>

      <div style={{ fontSize: 13, opacity: 0.85 }}>
        {confirmation}
      </div>
    </div>
  );
}
