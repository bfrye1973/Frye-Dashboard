// src/pages/rows/RowChart/DrawingToolbar.jsx
import React from "react";

export default function DrawingToolbar({
  mode,
  count,
  draft,
  canSaveDraft,
  onMode,
  onCancel,
  onSaveDraft,
}) {
  const btn = (active) => ({
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    fontWeight: 800,
    cursor: "pointer",
    userSelect: "none",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button style={btn(mode === "select")} onClick={() => onMode("select")}>
          Select
        </button>
        <button
          style={btn(mode === "trendline")}
          onClick={() => onMode("trendline")}
        >
          Trendline
        </button>
        <button style={btn(mode === "abcd")} onClick={() => onMode("abcd")}>
          ABCD
        </button>
        <button
          style={btn(mode === "elliott_triangle")}
          onClick={() => onMode("elliott_triangle")}
        >
          Triangle
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ color: "rgba(229,231,235,0.75)", fontWeight: 800, fontSize: 12 }}>
        Drawings: {count ?? 0}
      </div>

      {mode !== "select" && (
        <>
          <button
            style={{
              ...btn(false),
              background: "rgba(239,68,68,0.16)",
              border: "1px solid rgba(239,68,68,0.30)",
            }}
            onClick={onCancel}
            title="Esc"
          >
            Cancel
          </button>

          <button
            style={{
              ...btn(false),
              opacity: canSaveDraft ? 1 : 0.45,
              background: "rgba(16,185,129,0.16)",
              border: "1px solid rgba(16,185,129,0.30)",
            }}
            onClick={onSaveDraft}
            disabled={!canSaveDraft}
            title="Save in-progress triangle (optional)"
          >
            Save
          </button>

          <div style={{ color: "rgba(229,231,235,0.65)", fontSize: 12, fontWeight: 800 }}>
            {draft
              ? draft.type === "abcd"
                ? `ABCD points: ${draft.pointsSet || 0}/4`
                : draft.type === "elliott_triangle"
                ? `Triangle points: ${draft.pointsSet || 0}/5`
                : draft.type === "trendline"
                ? "Click 2 points"
                : ""
              : ""}
          </div>
        </>
      )}
    </div>
  );
}
