// src/pages/NewDashboard.jsx — v1.1 (Row 5 renders RowStrategies)
import React from "react";

// Row components (folder-based imports → resolve to index.jsx inside each folder)
import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies"; // now actually rendered
import RowChart from "./rows/RowChart";
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

      {/* Row 5 — Strategies (now the component, not the test banner) */}
      <section id="row-5" className="panel">
        <RowStrategies />
      </section>

      {/* Row 6 — Chart (flex-fill row) */}
      <section id="row-6" className="panel row6-shell">
        <RowChart
          apiBase={
            import.meta?.env?.VITE_API_BASE ||
            "https://frye-market-backend-1.onrender.com"
          }
          defaultSymbol="SPY"
          defaultTimeframe="1h"
          showDebug={false}
        />
      </section>

      {/* Row 7 — Journal */}
      <section id="row-7" className="panel">
        <RowJournal />
      </section>
    </div>
  );
}
