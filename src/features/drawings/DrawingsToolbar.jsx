import React from "react";

function Tile({ active, title, onClick, children }) {
  return (
    <div
      role="button"
      tabIndex={0}
      title={title}
      onMouseDown={(e) => {
        // prevent chart drag from starting when clicking toolbar
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick?.();
        }
      }}
      style={{
        width: 42,
        height: 42,
        borderRadius: 12,
        border: active
          ? "2px solid rgba(59,130,246,0.95)"
          : "1px solid rgba(255,255,255,0.18)",
        background: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.07)",
        color: "#e5e7eb",
        fontWeight: 900,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        userSelect: "none",
      }}
    >
      {children}
    </div>
  );
}

export default function DrawingsToolbar({ mode = "select", onMode, onDelete }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 10,
        zIndex: 9999,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 10,
        borderRadius: 16,
        background: "rgba(10,10,18,0.82)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Debug mini label so we can SEE the mode (remove later) */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: "rgba(229,231,235,0.75)",
          textAlign: "center",
          marginBottom: 2,
        }}
      >
        {String(mode || "select")}
      </div>

      <Tile active={mode === "select"} title="Select" onClick={() => onMode?.("select")}>
        ⛶
      </Tile>

      <Tile
        active={mode === "trendline"}
        title="Trend Line"
        onClick={() => onMode?.("trendline")}
      >
        ／
      </Tile>

      <Tile active={mode === "hline"} title="Horizontal Line" onClick={() => onMode?.("hline")}>
        ―
      </Tile>

      <div style={{ height: 1, background: "rgba(255,255,255,0.14)", margin: "4px 0" }} />

      <Tile active={false} title="Delete selected (Del)" onClick={() => onDelete?.()}>
        🗑
      </Tile>
    </div>
  );
}
