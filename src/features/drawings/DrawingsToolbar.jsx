import React from "react";

function ToolBtn({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        // ✅ IMPORTANT: prevent the chart engine from treating toolbar clicks as chart clicks
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        border: active ? "2px solid rgba(59,130,246,0.95)" : "1px solid rgba(255,255,255,0.14)",
        background: active ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.06)",
        color: "#e5e7eb",
        fontWeight: 900,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        userSelect: "none",
      }}
    >
      {children}
    </button>
  );
}

export default function DrawingsToolbar({ mode, onMode, onDelete }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 10,
        zIndex: 200,            // ✅ above everything
        pointerEvents: "auto",   // ✅ ensure clicks work
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 10,
        borderRadius: 16,
        background: "rgba(10,10,18,0.78)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
      }}
    >
      <ToolBtn active={mode === "select"} title="Select" onClick={() => onMode?.("select")}>
        ⛶
      </ToolBtn>

      <ToolBtn active={mode === "trendline"} title="Trend Line" onClick={() => onMode?.("trendline")}>
        ／
      </ToolBtn>

      <ToolBtn active={mode === "hline"} title="Horizontal Line" onClick={() => onMode?.("hline")}>
        ―
      </ToolBtn>

      <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "4px 0" }} />

      <ToolBtn active={false} title="Delete selected (Del)" onClick={() => onDelete?.()}>
        🗑
      </ToolBtn>
    </div>
  );
}
