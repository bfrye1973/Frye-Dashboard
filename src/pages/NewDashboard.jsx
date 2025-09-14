// src/pages/NewDashboard.jsx
import React from "react";

/* Rows */
import RowModeToggle from "./rows/RowModeToggle";
import RowMarketOverview from "./rows/RowMarketOverview";
import RowEngineLights from "./rows/RowEngineLights";
import RowIndexSectors from "./rows/RowIndexSectors";
import RowStrategies from "./rows/RowStrategies";
import RowJournal from "./rows/RowJournal";

/* Row 6 — measured wrapper (make sure you added this file earlier) */
import Row6Chart from "./rows/RowChart/Row6Chart";

export default function NewDashboard() {
  return (
    <div
      style={{
        padding: 12,
        display: "grid",
        gap: 12,
      }}
    >
      {/* Row 1 — Mode Toggle */}
      <section id="row-1" className="panel" style={{ display: "flex", flexDirection: "column" }}>
        <RowModeToggle />
      </section>

      {/* Row 2 — Market Overview */}
      <section id="row-2" className="panel" style={{ display: "flex", flexDirection: "column" }}>
        <RowMarketOverview />
      </section>

      {/* Row 3 — Engine Lights */}
      <section id="row-3" className="panel" style={{ display: "flex", flexDirection: "column" }}>
        <RowEngineLights />
      </section>

      {/* Row 4 — Index Sectors */}
      <section id="row-4" className="panel" style={{ display: "flex", flexDirection: "column" }}>
        <RowIndexSectors />
      </section>

      {/* Row 5 — Strategies */}
      <section id="row-5" className="panel" style={{ display: "flex", flexDirection: "column" }}>
        <RowStrategies />
      </section>

      {/* Row 6 — Chart (measured; zero slack) */}
      <section id="row-6" className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
        {/* If you have a toolbar for the chart row, render it here so it sits above the chart */}
        {/* <Row6Toolbar ... /> */}

        {/* The measured chart fills the rest exactly */}
        <div className="row6-shell" style={{ flex: "1 1 auto", minHeight: 0 }}>
          <Row6Chart
            apiBase="https://frye-market-backend-1.onrender.com"
            symbol="SPY"
            timeframe="1h"
          />
        </div>
      </section>

      {/* Row 7 — Journal */}
      <section id="row-7" className="panel" style={{ display: "flex", flexDirection: "column" }}>
        <RowJournal />
      </section>
    </div>
  );
}
