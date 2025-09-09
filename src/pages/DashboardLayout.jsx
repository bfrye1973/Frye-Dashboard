// src/pages/DashboardLayout.jsx
// Frye Dashboard — 7-row layout skeleton + TEMP DEBUG block (safe placeholders)

import React from "react";
import LiveLWChart from "../components/LiveLWChart/LiveLWChart"; // Row 6 chart

/* ---------- Row 1: Mode Toggle ---------- */
function ModeToggle() {
  return (
    <div id="row-1" className="panel" style={{ padding: 10 }}>
      <div className="panel-head">
        <div className="panel-title">View Modes</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button>Meter + Tiles</button>
        <button>Traffic Lights</button>
        <button>Arrow Scorecards</button>
      </div>
    </div>
  );
}

/* ---------- Row 2: Market Overview ---------- */
function MarketOverview() {
  return (
    <div id="row-2" className="panel" style={{ padding: 10 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter</div>
        <div className="spacer" />
        <span className="small muted">Bearish ← 0 … 100 → Bullish</span>
      </div>

      {/* Simple meter bar as a placeholder */}
      <div className="kpi-bar ok" style={{ marginBottom: 10 }}>
        <div className="kpi-fill" style={{ width: "78%" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="panel" style={{ padding: 10 }}>
          <div className="panel-title small">Breadth</div>
          <div className="kpi-bar warn" style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: "55%" }} />
          </div>
        </div>
        <div className="panel" style={{ padding: 10 }}>
          <div className="panel-title small">Momentum</div>
          <div className="kpi-bar warn" style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: "56%" }} />
          </div>
        </div>
        <div className="panel" style={{ padding: 10 }}>
          <div className="panel-title small">Squeeze (Compression)</div>
          <div className="kpi-bar ok" style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: "73%" }} />
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Higher = tighter (direction unknown)
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Row 3: Engine Lights ---------- */
function EngineLights() {
  return (
    <div id="row-3" className="panel" style={{ padding: 10 }}>
      <div className="panel-head">
        <div className="panel-title">Engine Lights</div>
      </div>
      <div className="muted small">No active signals</div>
    </div>
  );
}

/* ---------- Row 4: Index Sectors ---------- */
function IndexSectors() {
  return (
    <div id="row-4" className="panel index-sectors" style={{ padding: 10 }}>
      <div className="panel-head">
        <div className="panel-title">Index Sectors</div>
      </div>
      <div className="muted small">Sectors table / cards will render here.</div>
    </div>
  );
}

/* ---------- Row 5: Strategies (3-up) ---------- */
function StrategiesRow() {
  return (
    <div id="row-5" className="panel strategies" style={{ padding: 10 }}>
      <div className="panel-head">
        <div className="panel-title">Strategies</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="panel" style={{ padding: 10, minHeight: 120 }}>
          <div className="panel-title small">Strategy A</div>
          <div className="muted small" style={{ marginTop: 6 }}>Placeholder tile.</div>
        </div>
        <div className="panel" style={{ padding: 10, minHeight: 120 }}>
          <div className="panel-title small">Strategy B</div>
          <div className="muted small" style={{ marginTop: 6 }}>Placeholder tile.</div>
        </div>
        <div className="panel" style={{ padding: 10, minHeight: 120 }}>
          <div className="panel-title small">Strategy C</div>
          <div className="muted small" style={{ marginTop: 6 }}>Placeholder tile.</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Row 6: Chart Section (full width) ---------- */
function ChartSection() {
  return (
    <div id="row-6" className="panel chart-card" style={{ marginTop: 12 }}>
      {/* The chart mounts here and stays inside this card */}
      <LiveLWChart symbol="SPY" timeframe="1D" height={520} />
    </div>
  );
}

/* ---------- Row 7: Journal ---------- */
function JournalPanel() {
  return (
    <div id="row-7" className="panel journal" style={{ padding: 10, minHeight: 200 }}>
      <div className="panel-head">
        <div className="panel-title">Journal</div>
      </div>
      <div className="muted small">Notes / entries will appear here.</div>
    </div>
  );
}

/* ---------- Page wrapper (with TEMP DEBUG block) ---------- */
export default function DashboardLayout() {
  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <ModeToggle />
      <MarketOverview />
      <EngineLights />
      <IndexSectors />

      {/* TEMP DEBUG: should render a tall red bar between Row 4 and Row 5 */}
      <div
        id="debug-block"
        style={{
          height: 600,
          background: "rgba(255,0,0,0.25)",
          outline: "2px solid #ff4d4d",
          color: "#ffcccc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
        }}
      >
        DEBUG BLOCK — if you can see this, the bottom rows are fine (overlay not present)
      </div>

      <StrategiesRow />   {/* Row 5 */}
      <ChartSection />    {/* Row 6 */}
      <JournalPanel />    {/* Row 7 */}
    </div>
  );
}
