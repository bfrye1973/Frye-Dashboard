// src/pages/rows/RowChart/overlays/Engine17Badges.jsx

import React from "react";

function toneFor(kind, value) {
  if (kind === "VOLUME" && value === "CONFIRMED") {
    return { bg: "rgba(167,139,250,0.18)", border: "rgba(167,139,250,0.55)", color: "#ddd6fe" };
  }
  if (kind === "STATE" && value === "ABOVE_PULLBACK") {
    return { bg: "rgba(34,197,94,0.16)", border: "rgba(34,197,94,0.50)", color: "#bbf7d0" };
  }
  if (kind === "STATE" && (value === "IN_PULLBACK" || value === "DEEP_PULLBACK")) {
    return { bg: "rgba(245,158,11,0.16)", border: "rgba(245,158,11,0.50)", color: "#fde68a" };
  }
  if (kind === "STATE" && value === "BELOW_PULLBACK") {
    return { bg: "rgba(239,68,68,0.16)", border: "rgba(239,68,68,0.50)", color: "#fecaca" };
  }
  if (kind === "CONTEXT" && value === "LONG_CONTEXT") {
    return { bg: "rgba(16,185,129,0.16)", border: "rgba(16,185,129,0.50)", color: "#bbf7d0" };
  }
  if (kind === "CONTEXT" && value === "SHORT_CONTEXT") {
    return { bg: "rgba(239,68,68,0.16)", border: "rgba(239,68,68,0.50)", color: "#fecaca" };
  }
  return { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.18)", color: "#f3f4f6" };
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
  const confidence = [];

  if (showConfidenceStack) {
    badges.forEach((b) => confidence.push({ kind: b.kind, value: b.value }));
    if (meta?.sourceEnginesUsed?.length) {
      confidence.push({
        kind: "ENGINES",
        value: meta.sourceEnginesUsed.join(", "),
      });
    }
    if (meta?.missingSections?.length) {
      confidence.push({
        kind: "MISSING",
        value: meta.missingSections.join(", "),
      });
    }
  }

  if (showReplaySyncedState) {
    confidence.push({
      kind: "REPLAY_SYNC",
      value: "PENDING",
    });
  }

  if (!confidence.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 12,
        zIndex: 91,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "flex-end",
        maxWidth: "52%",
        pointerEvents: "none",
      }}
    >
      {confidence.map((b, idx) => {
        const tone = toneFor(b.kind, b.value);
        return (
          <div
            key={`${b.kind}-${idx}`}
            title={b.kind}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              color: tone.color,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.2,
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
