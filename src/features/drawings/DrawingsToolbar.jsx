import React from "react";

const Btn = ({ active, title, onClick, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 36,
      height: 36,
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.12)",
      background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
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

export default function DrawingsToolbar({ mode, onMode, onDelete }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 10,
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
        borderRadius: 14,
        background: "rgba(10,10,18,0.75)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Btn active={mode === "select"} title="Select" onClick={() => onMode("select")}>
        ⛶
      </Btn>

      <Btn active={mode === "trendline"} title="Trend Line" onClick={() => onMode("trendline")}>
        ／
      </Btn>

      <Btn active={mode === "hline"} title="Horizontal Line" onClick={() => onMode("hline")}>
        ―
      </Btn>

      <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "4px 0" }} />

      <Btn active={false} title="Delete selected (Del)" onClick={onDelete}>
        🗑
      </Btn>
    </div>
  );
}
