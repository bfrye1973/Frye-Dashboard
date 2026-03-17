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
        top: 12,
        left: "36%",                 // ✅ moved LEFT
        transform: "translateX(-50%)",
        zIndex: 95,
        width: 720,                 // ✅ smaller box
        maxWidth: "42%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(5,8,18,0.88)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.32)",
        color: "#f3f4f6",
        padding: "14px 18px",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: 0.6,
          marginBottom: 10,
          color: "#cbd5e1",
          textAlign: "center",
        }}
      >
        DECISION TIMELINE
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item, idx) => (
          <div
            key={`${item.kind}-${idx}`}
            style={{
              display: "grid",
              gridTemplateColumns: "14px 1fr",
              gap: 10,
              alignItems: "start",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: dotColor(item.kind),
                marginTop: 6,
              }}
            />
            <div
              style={{
                fontSize: 18,
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
