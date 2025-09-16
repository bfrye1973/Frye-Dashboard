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
      <RowModeToggle />       {/* Row 1 */}
      <RowMarketOverview />   {/* Row 2 */}
      <RowEngineLights />     {/* Row 3 */}
      <RowIndexSectors />     {/* Row 4 */}
      <RowStrategies />       {/* Row 5 */}

    {/* Row 6 — Chart */}
<section id="row-6" className="panel">
  <div className="row6-shell">
    <RowChart
      apiBase="https://frye-market-backend-1.onrender.com"
      defaultSymbol="SPY"
      defaultTimeframe="1h"
      height={560}
      showDebug={false}
    />
  </div>
</section>

      <RowJournal />          {/* Row 7 */}
    </div>
  );
}
