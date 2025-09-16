// src/pages/NewDashboard.jsx
import React from "react";

import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies";
import RowChart from "./rows/RowChart";    // resolves to ./rows/RowChart/index.jsx
import RowJournal from "./rows/RowJournal";

export default function NewDashboard() {
  return (
    <div className="dashboard-grid" style={{ padding: 12, display: "grid", gap: 12 }}>
      {/* Row 1 */}
      <RowModeToggle />

      {/* Row 2 */}
      <RowMarketOverview />

      {/* Row 3 */}
      <RowEngineLights />

      {/* Row 4 */}
      <RowIndexSectors />

      {/* Row 5 */}
      <RowStrategies />

      {/* Row 6 — Chart (flex-fill, no fixed height) */}
      <section id="row-6" className="panel">
        <div className="row6-shell">
          <RowChart
            apiBase="https://frye-market-backend-1.onrender.com"
            defaultSymbol="SPY"
            defaultTimeframe="1h"
            showDebug={false}
          />
        </div>
      </section>

      {/* Row 7 */}
      <RowJournal />
    </div>
  );
}
