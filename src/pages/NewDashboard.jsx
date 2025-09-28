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

// single, crash-proof helper (no 'process' access in the browser)
function getApiBase() {
  // If you later set REACT_APP_API_BASE, the bundler will inline a literal here
  // and this function still won’t crash because we never reference `process`.
  const INLINE = "__REACT_APP_API_BASE__";
  // The bundler will not replace this string; keep the backend default:
  const DEFAULT_BACKEND = "https://frye-market-backend-1.onrender.com";
  // If you do want to wire env later, change INLINE at build time; otherwise we use default.
  return DEFAULT_BACKEND;
}

export default function NewDashboard() {
  const { selection } = useSelection(); // { symbol, timeframe }

  const symbol = selection?.symbol || "SPY";
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

      {/* Row 6 — remount on selection change */}
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
