// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

function buildTimelineItems(overlayData) {
  const out = [];
  const context = overlayData?.fib?.context || "NONE";
  const state = (overlayData?.badges || []).find((b) => b.kind === "STATE")?.value || "UNKNOWN";
  const volume = (overlayData?.badges || []).find((b) => b.kind === "VOLUME")?.value || "NORMAL";
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
        left: 12,
        bottom: 12,
        zIndex: 91,
        width: 360,
        maxWidth: "42%",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(5,8,18,0.78)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
        color: "#f3f4f6",
        padding: 12,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 0.6,
          marginBottom: 10,
          color: "#cbd5e1",
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
              gridTemplateColumns: "10px 1fr",
              gap: 10,
              alignItems: "start",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background:
                  item.kind === "BREAKOUT_READY"
                    ? "#22c55e"
                    : item.kind === "BREAKDOWN_READY"
                    ? "#ef4444"
                    : item.kind === "IMPULSE_VOLUME_CONFIRMED"
                    ? "#a78bfa"
                    : "#94a3b8",
                marginTop: 4,
              }}
            />
            <div style={{ fontSize: 12, lineHeight: 1.35 }}>{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
