// src/pages/DashboardLayout.jsx
import React from "react";
import LiveLWChart from "../components/LiveLWChart/LiveLWChart";

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

/* ---------- Row 5: Strategies (visible) ---------- */
function StrategiesRow() {
  return (
    <div id="row-5" className="panel strategies" style={{ padding: 10, minHeight: 220 }}>
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

/* ---------- Row 6: Chart Section (visible) ---------- */
function ChartSection() {
  return (
    <div id="row-6" className="panel chart-card" style={{ marginTop: 12 }}>
      <LiveLWChart symbol="SPY" timeframe="1D" height={520} />
    </div>
  );
}

/* ---------- Row 7: Journal (visible) ---------- */
function JournalPanel() {
  return (
    <div id="row-7" className="panel journal" style={{ padding: 10, minHeight: 220, marginTop: 12 }}>
      <div className="panel-head">
        <div className="panel-title">Journal</div>
      </div>
      <div className="muted small">Notes / entries will appear here.</div>
    </div>
  );
}

/* ---------- Page wrapper ---------- */
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
