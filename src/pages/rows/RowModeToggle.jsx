// src/pages/rows/RowModeToggle.jsx
import React from "react";
import MarketNarrator from "../../components/MarketNarrator";

export default function RowModeToggle() {
  return (
    <section id="view-modes" className="panel" style={{ padding: 8 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">View Modes</div>

        <div className="small" style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">Meter + Tiles</button>
          <button className="btn" type="button">Traffic Lights</button>
          <button className="btn" type="button">Arrow Scorecards</button>
        </div>

        <div className="spacer" />

        <MarketNarrator />
      </div>
    </section>
  );
}
