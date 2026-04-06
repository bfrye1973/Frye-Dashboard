// src/pages/rows/RowChart/overlays/Engine17StateOverlay.jsx

import React from "react";

export default function Engine17StateOverlay({
  overlayData,
  visible = true,
}) {
  if (!visible || !overlayData?.ok) return null;

  const fib = overlayData?.fib || {};
  const context = fib?.context || "NONE";
  const state = fib?.state || "UNKNOWN";
  const phase = fib?.waveContext?.waveState || fib?.waveState || "UNKNOWN";
  const bias = fib?.waveContext?.macroBias || fib?.macroBias || "NONE";

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 108,
        minWidth: 420,
        maxWidth: "34%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(5,8,18,0.90)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.32)",
        color: "#f3f4f6",
        padding: "12px 16px",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "110px 1fr",
          gap: 8,
          fontSize: 18,
          lineHeight: 1.25,
          fontWeight: 800,
        }}
      >
        <div style={{ color: "#94a3b8" }}>CONTEXT:</div>
        <div>{context}</div>

        <div style={{ color: "#94a3b8" }}>STATE:</div>
        <div>{state}</div>

        <div style={{ color: "#94a3b8" }}>PHASE:</div>
        <div>{phase}</div>

        <div style={{ color: "#94a3b8" }}>BIAS:</div>
        <div>{bias}</div>
      </div>
    </div>
  );
}
