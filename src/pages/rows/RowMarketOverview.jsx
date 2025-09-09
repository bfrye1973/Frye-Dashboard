// src/pages/rows/RowMarketOverview.jsx
import React from "react";

function MeterBar({ value = 50, label = "Market Meter" }) {
  // clamp 0..100
  const v = Math.max(0, Math.min(100, Number(value)));
  const tone = v >= 60 ? "ok" : v >= 40 ? "warn" : "danger";

  return (
    <div className="panel" aria-label="Market Meter">
      <div className="panel-head">
        <div className="panel-title">{label}</div>
        <div className="spacer" />
        <span className="small muted">Bearish ← 0 … 100 → Bullish</span>
      </div>

      {/* Main meter */}
      <div className={`kpi-bar ${tone}`} style={{ marginBottom: 10 }}>
        <div className="kpi-fill" style={{ width: `${v}%` }} />
      </div>

      {/* Two sub tiles (Breadth + Momentum) + Squeeze text */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="panel">
          <div className="panel-title small">Breadth</div>
          <div className="kpi-bar warn" style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: "50%" }} />
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

export default function RowMarketOverview() {
  // For now, we pass a static value (78). Later you’ll replace with live composite.
  return (
    <section id="row-2" className="panel" style={{ padding: 0 }}>
      <MeterBar value={78} />
    </section>
  );
}
