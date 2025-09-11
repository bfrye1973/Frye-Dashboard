// src/pages/rows/RowModeToggle.jsx
import React from "react";
import MarketNarrator from "../../components/MarketNarrator";

/**
 * View Modes row:
 * - Left: your existing mode buttons (placeholders here)
 * - Right: Market Narrator (scope + summary + 🔊 Explain)
 *
 * NOTE: All import statements must stay at the very TOP of the file.
 */
export default function RowModeToggle() {
  return (
    <section id="view-modes" className="panel" style={{ padding: 8 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">View Modes</div>

        {/* LEFT — your mode buttons (wire real handlers if you have them) */}
        <div className="small" style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">Meter + Tiles</button>
          <button className="btn" type="button">Traffic Lights</button>
          <button className="btn" type="button">Arrow Scorecards</button>
        </div>

        <div className="spacer" />

        {/* RIGHT — voice narrator */}
        <MarketNarrator />
      </div>
    </section>
  );
}
