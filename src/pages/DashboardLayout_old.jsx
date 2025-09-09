// src/pages/DashboardLayout.jsx
import React from "react";
import LiveLWChart from "../components/LiveLWChart/LiveLWChart";

/* ---------- Row 1: Mode Toggle ---------- */
function ModeToggle() {
  return (
    <div id="row-1" className="panel">
      <div className="panel-head">
        <div className="panel-title">View Modes</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
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
    <div id="row-2" className="panel">
      <div className="panel-head">
        <div className="panel-title">Market Meter</div>
        <div className="spacer" />
        <span className="small muted">Bearish ← 0 … 100 → Bullish</span>
      </div>

      <div className="kpi-bar ok" style={{ marginBottom: 10 }}>
        <div className="kpi-fill" style={{ width: "78%" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="panel">
          <div className="panel-title small">Breadth</div>
          <div className="kpi-bar warn" style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: "55%" }} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-title small">Momentum</div>
          <div className="kpi-bar warn" style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: "56%" }} />
          </div>
        </div>
        <div className="panel">
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
    <div id="row-3" className="panel">
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
    <div id="row-4" className="panel index-sectors">
      <div className="panel-head">
        <div className="panel-title">Index Sectors</div>
      </div>
      <div className="muted small">Sectors table / cards will render here.</div>
    </div>
  );
}

/* ---------- Row 5: Strategies ---------- */
function StrategiesRow() {
  return (
    <div id="row-5" className="panel strategies">
      <div className="panel-head">
        <div className="panel-title">Strategies</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="panel"><div className="panel-title small">Strategy A</div></div>
        <div className="panel"><div className="panel-title small">Strategy B</div></div>
        <div className="panel"><div className="panel-title small">Strategy C</div></div>
      </div>
    </div>
  );
}

/* ---------- Row 6: Chart Section ---------- */
function ChartSection() {
  return (
    <div id="row-6" className="panel chart-card">
      <LiveLWChart symbol="SPY" timeframe="1D" height={520} />
    </div>
  );
}

/* ---------- Row 7: Journal ---------- */
function JournalPanel() {
  return (
    <div id="row-7" className="panel journal">
      <div className="panel-head">
        <div className="panel-title">Journal</div>
      </div>
      <div className="muted small">Notes / entries will appear here.</div>
    </div>
  );
}

/* ---------- Page Wrapper ---------- */
export default function DashboardLayout() {
  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <ModeToggle />
      <MarketOverview />
      <EngineLights />
      <IndexSectors />
      <StrategiesRow />
      <ChartSection />
      <JournalPanel />
    </div>
  );
}
