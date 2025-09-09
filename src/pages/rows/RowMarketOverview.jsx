// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

// simple tone helper
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

// compute composite (0..100) using your fields
function computeMeter(odometers, gauges) {
  const breadth = Number(odometers?.breadthOdometer ?? 50);
  const momentum = Number(odometers?.momentumOdometer ?? 50);
  // compression % (higher = tighter)
  const compression = Number(odometers?.squeezeCompressionPct ?? gauges?.fuelPct ?? 50);
  const expansionPotential = 100 - Math.max(0, Math.min(100, compression));
  // weights: 40/40/20
  const base = 0.4 * breadth + 0.4 * momentum + 0.2 * expansionPotential;
  // “major squeeze” soft clamp (optional)
  const meter =
    compression >= 90 ? 45 + (base - 50) * 0.30 : base;
  return Math.round(Math.max(0, Math.min(100, meter)));
}

export default function RowMarketOverview() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};

  const meter = computeMeter(od, gg);
  const tone  = toneFor(meter);

  const breadth  = Number(od?.breadthOdometer ?? 50);
  const momentum = Number(od?.momentumOdometer ?? 50);
  const squeezePct = Number(od?.squeezeCompressionPct ?? gg?.fuelPct ?? 50);

  return (
    <section id="row-2" className="panel" style={{ padding: 0 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter</div>
        <div className="spacer" />
        <span className="small muted">Bearish ← 0 … 100 → Bullish</span>
      </div>

      {/* main meter bar */}
      <div className={`kpi-bar ${tone}`} style={{ marginBottom: 10 }}>
        <div className="kpi-fill" style={{ width: `${meter}%` }} />
      </div>

      {/* tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="panel">
          <div className="panel-title small">Breadth</div>
          <div className={`kpi-bar ${toneFor(breadth)}`} style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: `${breadth}%` }} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title small">Momentum</div>
          <div className={`kpi-bar ${toneFor(momentum)}`} style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: `${momentum}%` }} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title small">Squeeze (Compression)</div>
          <div className={`kpi-bar ${toneFor(100 - squeezePct)}`} style={{ marginTop: 8 }}>
            <div className="kpi-fill" style={{ width: `${100 - squeezePct}%` }} />
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Higher = tighter (direction unknown) — {Math.round(squeezePct)}%
          </div>
        </div>
      </div>

      {loading && <div className="small muted" style={{ marginTop: 8 }}>Loading…</div>}
      {error   && <div className="small muted" style={{ marginTop: 8 }}>Failed to load.</div>}
    </section>
  );
}
