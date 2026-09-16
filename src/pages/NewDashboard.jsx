// src/pages/NewDashboard.jsx — CRA-safe (no process/env at runtime)
import React from "react";
import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngine29 from "./rows/RowEngine29";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies";
import RowChart from "./rows/RowChart/index.jsx";
import RowJournal from "./rows/RowJournal";
import { useSelection } from "../context/ModeContext";

function getApiBase() {
  return "https://frye-market-backend-1.onrender.com";
}

export default function NewDashboard() {
  const { selection } = useSelection();
  const symbol = (selection?.symbol || "SPY").toUpperCase();
  const timeframe = selection?.timeframe || "1h";
  const apiBase = getApiBase();

  return (
    <div className="dashboard-grid" style={{ padding: 12 }}>
      <section id="row-1" className="panel"><RowModeToggle /></section>
      <section id="row-2" className="panel"><RowMarketOverview /></section>

      {/* Engine 29 compact cross-market stress card */}
      <section id="row-engine29" className="panel"><RowEngine29 /></section>

      <section id="row-3" className="panel"><RowIndexSectors /></section>
      <section id="row-4" className="panel"><RowStrategies /></section>
      <section id="row-5" className="panel row6-shell">
        <RowChart key={`${symbol}-${timeframe}`} apiBase={apiBase} defaultSymbol={symbol} defaultTimeframe={timeframe} showDebug={false} />
      </section>
      <section id="row-6" className="panel"><RowJournal /></section>
      <section id="row-7" className="panel"><RowEngineLights /></section>
    </div>
  );
}
