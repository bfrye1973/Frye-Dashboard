// src/pages/NewDashboard.jsx — full rewrite (v1)
// 7‑row Ferrari Dashboard layout using folder-based Row components
// Rows: 1 Mode Toggle, 2 Market Overview, 3 Engine Lights,
//       4 Index Sectors, 5 Strategies, 6 Chart, 7 Journal
//
// Notes:
// - Imports point to FOLDER versions (e.g., "./rows/RowStrategies")
// - RowChart receives safe defaults; adjust props if your RowChart signature differs
// - Keep existing CSS classes (dashboard-grid, panel, etc.) so styling remains intact

import React from "react";

// Row components (folder-based imports → resolve to index.jsx inside each folder)
import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies"; // NEW tabs (Alignment/Wave3/Flag)
import RowChart from "./rows/RowChart";            // Time & overlays react to selection store
import RowJournal from "./rows/RowJournal";

export default function NewDashboard() {
  return (
    <div className="dashboard-grid" style={{ padding: 12 }}>
      {/* Row 1 — Mode Toggle */}
      <section id="row-1" className="panel">
        <RowModeToggle />
      </section>

      {/* Row 2 — Market Overview (Stoplights / Arrows / Tiles) */}
      <section id="row-2" className="panel">
        <RowMarketOverview />
      </section>

      {/* Row 3 — Engine Lights */}
      <section id="row-3" className="panel">
        <RowEngineLights />
      </section>

      {/* Row 4 — Index Sectors */}
      <section id="row-4" className="panel">
        <RowIndexSectors />
      </section>

      {/* Row 5 — Strategies (Tabs: Alignment • Wave 3 • Flagpole) */}
      <section id="row-5" className="panel">
        <RowStrategies />
      </section>

      {/* Row 6 — Chart (flex-fill row) */}
      <section id="row-6" className="panel row6-shell">
        <RowChart
          // Safe defaults; your RowChart can ignore props it doesn't use
          dataSource={import.meta?.env?.VITE_API_BASE || "https://frye-market-backend-1.onrender.com"}
          defaultSymbol="SPY"
          defaultTimeframe="1h"
          onDebug={false}
        />
      </section>

      {/* Row 7 — Journal */}
      <section id="row-7" className="panel">
        <RowJournal />
      </section>
    </div>
  );
}
