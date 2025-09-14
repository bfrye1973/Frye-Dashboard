// src/pages/rows/RowModeToggle.jsx
import React from "react";
import MarketNarrator from "../../components/MarketNarrator";
import { useViewMode, ViewModes } from "../../context/ModeContext";

export default function RowModeToggle() {
  const { mode, setMode } = useViewMode();

  const Btn = ({ id, children, title }) => {
    const active = mode === id;
    return (
      <button
        type="button"
        onClick={() => setMode(id)}
        aria-pressed={active}
        title={title}
        className="btn"
        style={{
          // keep your .btn look but add active state without needing new CSS
          background: active ? "#0f172a" : "#0b0b0b",
          color: "#e5e7eb",
          border: `1px solid ${active ? "#475569" : "#2b2b2b"}`,
          borderRadius: 8,
          padding: "6px 10px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {children}
      </button>
    );
  };

  return (
    <section id="view-modes" className="panel" style={{ padding: 8 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">View Modes</div>

        <div className="small" style={{ display: "flex", gap: 8 }}>
          <Btn
            id={ViewModes.METER_TILES}
            title="Show Market Meter + tiles layout"
          >
            Meter + Tiles
          </Btn>

          <Btn
            id={ViewModes.TRAFFIC}
            title="Compact traffic-light chips"
          >
            Traffic Lights
          </Btn>

          <Btn
            id={ViewModes.ARROWS}
            title="Arrow scorecards vs baseline"
          >
            Arrow Scorecards
          </Btn>
        </div>

        <div className="spacer" />

        <MarketNarrator />
      </div>
    </section>
  );
}
