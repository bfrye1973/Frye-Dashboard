// src/pages/NewDashboard.jsx — CRA-safe (no process/env at runtime)
import React from "react";
import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies";
import RowChart from "./rows/RowChart";
import RowJournal from "./rows/RowJournal";
import { useSelection } from "../context/ModeContext";

// Minimal backend base (literal; no process.env at runtime)
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

      {/* Row 6 — link-only to full chart (no embedded chart here) */}
      <section id="row-6" className="panel row6-shell">
        <RowChart
          linkOnly                         /* <- makes Row 6 a slim link */
          key={`${symbol}-${timeframe}`}   /* remount on selection change */
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
