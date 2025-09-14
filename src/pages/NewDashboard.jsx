// src/pages/NewDashboard.jsx
import React from "react";
import { ModeProvider } from "../context/ModeContext";   // ✅ view-mode context
import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies";
import RowChart from "./rows/RowChart";                  // resolves to ./rows/RowChart/index.jsx
import RowJournal from "./rows/RowJournal";

export default function NewDashboard() {
  return (
    <ModeProvider>
      <div style={{ padding: 12, display: "grid", gap: 12 }}>
        <RowModeToggle />       {/* Row 1 */}
        <RowMarketOverview />   {/* Row 2 (reacts to view mode) */}
        <RowEngineLights />     {/* Row 3 */}
        <RowIndexSectors />     {/* Row 4 */}
        <RowStrategies />       {/* Row 5 */}

        {/* Row 6 — Chart (modular RowChart) */}
        <RowChart
          apiBase="https://frye-market-backend-1.onrender.com"
          defaultSymbol="SPY"
          defaultTimeframe="1h"
          height={520}
          showDebug={true}
        />

        <RowJournal />          {/* Row 7 */}
      </div>
    </ModeProvider>
  );
}
