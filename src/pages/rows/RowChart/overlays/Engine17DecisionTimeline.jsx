// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

function formatWave(w) {
  if (!w) return "—";
  return String(w).replace("IN_", "").replaceAll("_", " ");
}

function formatBias(v, fallback = "—") {
  if (!v) return fallback;
  return String(v).replaceAll("_", " ");
}

function formatLevel(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : null;
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

  const trend4h = formatBias(fib?.trendState_4h || fib?.executionBias, "—");
  const prepBias = String(fib?.prepBias || "NONE").toUpperCase();
  const readiness = formatBias(fib?.readinessLabel, "WAIT");

  const watchShort = !!fib?.continuationWatchShort;
  const watchLong = !!fib?.continuationWatchLong;
  const triggerShort = !!fib?.continuationTriggerShort;
  const triggerLong = !!fib?.continuationTriggerLong;

  const breakdownRef = formatLevel(fib?.breakdownRef);
  const lastLowerHigh = formatLevel(fib?.lastLowerHigh);

  let currentRead = "No active setup";
  let confirmation = "No confirmation condition";

  if (prepBias === "SHORT_PREP" && watchShort) {
    currentRead = "Short prep active — watching for breakdown";
    confirmation = breakdownRef
      ? `Break below ${breakdownRef} confirms downside continuation`
      : "Break below structure confirms downside continuation";
  }

  if (prepBias === "LONG_PREP" && watchLong) {
    currentRead = "Long prep active — watching for breakout";
    confirmation = lastLowerHigh
      ? `Break above ${lastLowerHigh} confirms upside continuation`
      : "Break above structure confirms upside continuation";
  }

  if (triggerShort) {
    currentRead = "Downside continuation confirmed";
    confirmation = breakdownRef
      ? `Break below ${breakdownRef} confirmed downside continuation`
      : "Breakdown confirmed";
  }

  if (triggerLong) {
    currentRead = "Upside continuation confirmed";
    confirmation = lastLowerHigh
      ? `Break above ${lastLowerHigh} confirmed upside continuation`
      : "Breakout confirmed";
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 58,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 109,
        width: 640,
        maxWidth: "68%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(6,10,20,0.92)",
        padding: "12px 16px",
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
          fontSize: 18,
          lineHeight: 1.35,
          marginBottom: 6,
          color: "#f8fafc",
        }}
      >
        {`Primary ${primary} | Intermediate ${intermediate} | Minor ${minor}`}
      </div>

      <div
        style={{
          fontSize: 15,
          lineHeight: 1.45,
          marginBottom: 4,
          color: "#cbd5e1",
        }}
      >
        {`4H Trend: ${trend4h}`}
      </div>

      <div
        style={{
          fontSize: 15,
          lineHeight: 1.45,
          marginBottom: 4,
          color: "#e5e7eb",
          fontWeight: 700,
        }}
      >
        {currentRead}
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.45,
          marginBottom: 4,
          color: "#cbd5e1",
        }}
      >
        {confirmation}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.4,
          color: "#94a3b8",
          fontWeight: 700,
        }}
      >
        {`Readiness: ${readiness}`}
      </div>
    </div>
  );
}
