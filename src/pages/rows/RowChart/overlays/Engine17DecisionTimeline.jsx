// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

function buildTimelineItems(overlayData) {
  const out = [];
  const context = overlayData?.fib?.context || "NONE";
  const state =
    (overlayData?.badges || []).find((b) => b.kind === "STATE")?.value ||
    "UNKNOWN";
  const volume =
    (overlayData?.badges || []).find((b) => b.kind === "VOLUME")?.value ||
    "NORMAL";
  const signals = Array.isArray(overlayData?.signals) ? overlayData.signals : [];

  out.push({ kind: "CONTEXT", text: `Context: ${context}` });
  out.push({ kind: "STATE", text: `State: ${state}` });
  out.push({ kind: "VOLUME", text: `Volume: ${volume}` });

  signals.forEach((s) => {
    out.push({
      kind: s.kind,
      text: `E16: ${s.label || s.kind}`,
    });
  });

  return out;
}

function dotColor(kind) {
  if (kind === "BREAKOUT_READY") return "#22c55e";
  if (kind === "BREAKDOWN_READY") return "#ef4444";
  if (kind === "IMPULSE_VOLUME_CONFIRMED") return "#a78bfa";
  if (kind === "STATE") return "#60a5fa";
  if (kind === "CONTEXT") return "#34d399";
  if (kind === "VOLUME") return "#f59e0b";
  return "#94a3b8";
}

export default function Engine17DecisionTimeline({
  overlayData,
  visible = false,
}) {
  if (!visible || !overlayData?.ok) return null;

  const items = buildTimelineItems(overlayData);
  if (!items.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 95,
        width: 980,
        maxWidth: "58%",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(5,8,18,0.88)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.34)",
        color: "#f3f4f6",
        padding: "18px 22px",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: 0.8,
          marginBottom: 14,
          color: "#cbd5e1",
          textAlign: "center",
        }}
      >
        DECISION TIMELINE
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item, idx) => (
          <div
            key={`${item.kind}-${idx}`}
            style={{
              display: "grid",
              gridTemplateColumns: "18px 1fr",
              gap: 14,
              alignItems: "start",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: dotColor(item.kind),
                marginTop: 6,
              }}
            />
            <div
              style={{
                fontSize: 22,
                lineHeight: 1.3,
                fontWeight: 700,
              }}
            >
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
