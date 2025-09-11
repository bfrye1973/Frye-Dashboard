// src/pages/rows/RowModeToggle.jsx
import React from "react";
import MarketNarrator from "../../components/MarketNarrator";

/**
 * Simple header row with your existing view-mode buttons on the left
 * and the Market Narrator (scope + summary + 🔊 Explain) on the right.
 * If you have custom handlers for the buttons, wire them where marked.
 */
export default function RowModeToggle() {
  return (
    <section id="view-modes" className="panel" style={{ padding: 8 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">View Modes</div>

        {/* LEFT — your existing buttons (keep / customize as needed) */}
        <div className="small" style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => {/* TODO: set mode 'meter' */}}>
            Meter + Tiles
          </button>
          <button className="btn" onClick={() => {/* TODO: set mode 'traffic' */}}>
            Traffic Lights
          </button>
          <button className="btn" onClick={() => {/* TODO: set mode 'arrows' */}}>
            Arrow Scorecards
          </button>
        </div>

        <div className="spacer" />

        {/* RIGHT — voice narrator */}
        <MarketNarrator />
      </div>
    </section>
  );
}
