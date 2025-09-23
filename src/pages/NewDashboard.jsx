// src/pages/NewDashboard.jsx — CRA-safe, Row 6 remounts when selection changes
import React from "react";
import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies";
import RowChart from "./rows/RowChart";
import RowJournal from "./rows/RowJournal";

// NEW: read global selection
import { useSelection } from "../context/ModeContext";

export default function NewDashboard() {
  const { selection } = useSelection(); // { symbol, strategy, timeframe }

  return (
    <div className="dashboard-grid" style={{ padding: 12 }}>
      {/* Row 1 */}
      <section id="row-1" className="panel">
        <RowModeToggle />
      </section>

      {/* Row 2 */}
      <section id="row-2" className="panel">
        <RowMarketOverview />
      </section>

      {/* Row 3 */}
      <section id="row-3" className="panel">
        <RowEngineLights />
      </section>

      {/* Row 4 */}
      <section id="row-4" className="panel">
        <RowIndexSectors />
      </section>

      {/* Row 5 */}
      <section id="row-5" className="panel">
        <RowStrategies />
      </section>

      {/* Row 6 — key forces a safe remount when selection changes */}
      <section id="row-6" className="panel row6-shell">
        <RowChart
          key={`${selection?.symbol || "SPY"}-${selection?.timeframe || "1h"}`}
          apiBase={
            (process && process.env && process.env.REACT_APP_API_BASE) ||
            "https://frye-market-backend-1.onrender.com"
          }
          defaultSymbol={selection?.symbol || "SPY"}
          defaultTimeframe={selection?.timeframe || "1h"}
          showDebug={false}
        />
      </section>

      {/* Row 7 */}
      <section id="row-7" className="panel">
        <RowJournal />
      </section>
    </div>
  );
}
