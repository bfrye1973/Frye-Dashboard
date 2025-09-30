// src/pages/NewDashboard.jsx — CRA-safe (no process/env at runtime)
import React from "react";
import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies";
import RowChart from "./rows/RowChart/index.jsx";
import RowJournal from "./rows/RowJournal";
import { useSelection } from "../context/ModeContext";

// Literal backend base (no runtime process.env)
function getApiBase() {
  return "https://frye-market-backend-1.onrender.com";
}

export default function NewDashboard() {
  const { selection } = useSelection(); // { symbol, timeframe }
  const symbol = (selection?.symbol || "SPY").toUpperCase();
  const timeframe = selection?.timeframe || "1h";
  const apiBase = getApiBase();

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

      {/* Row 6 — embedded chart (remount on selection change) */}
      <section id="row-6" className="panel row6-shell">
        <RowChart
          key={`${symbol}-${timeframe}`}
          apiBase={apiBase}
          defaultSymbol={symbol}
          defaultTimeframe={timeframe}
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
