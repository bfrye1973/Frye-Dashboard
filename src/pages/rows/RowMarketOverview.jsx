// src/pages/rows/RowMarketOverview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

// tone for a value (0..100)
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

// format to 1 decimal always
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");

// get YYYY-MM-DD
const dayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Keep a per-day baseline for a KPI in localStorage
 * keyName: "breadth" | "momentum" | "squeeze"
 * current: number (0..100)
 */
function useDailyBaseline(keyName, current) {
  const [baseline, setBaseline] = useState(null);

  useEffect(() => {
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    const saved = localStorage.getItem(k);
    if (saved === null && Number.isFinite(current)) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    } else if (saved !== null) {
      const n = Number(saved);
      setBaseline(Number.isFinite(n) ? n : null);
    }
  }, [keyName]);

  // if we mounted before polling delivered a value, backfill baseline
  useEffect(() => {
    if (!Number.isFinite(current)) return;
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    const saved = localStorage.getItem(k);
    if (saved === null) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    }
  }, [keyName, current]);

  return baseline;
}

function DeltaChip({ delta }) {
  // thresholds: |delta| < 0.5 → "flat/caution"
  const dir = !Number.isFinite(delta)
    ? "flat"
    : Math.abs(delta) < 0.5
    ? "flat"
    : delta > 0
    ? "up"
    : "down";
  const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  const cls =
    dir === "up" ? "delta delta-up" : dir === "down" ? "delta delta-down" : "delta delta-flat";
  return <span className={cls}>{arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}%</span>;
}

function KpiTile({ title, value, baseline }) {
  const width = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const tone = toneFor(width);
  const delta = Number.isFinite(value) && Number.isFinite(baseline) ? value - baseline : NaN;

  return (
    <div className="panel">
      <div className="panel-title small">{title}</div>
      <div className={`kpi-bar ${tone}`} style={{ marginTop: 8 }}>
        <div className="kpi-fill" style={{ width: `${width}%` }} />
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop: 6 }}>
        <div className="small muted">{pct(value)}%</div>
        <DeltaChip delta={delta} />
      </div>
    </div>
  );
}

export default function RowMarketOverview() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  // read odometers/gauges safely
  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};

  const breadth  = Number(od?.breadthOdometer ?? 50);
  const momentum = Number(od?.momentumOdometer ?? 50);
  // compression % (higher = tighter)
  const compression = Number.isFinite(od?.squeezeCompressionPct)
    ? od.squeezeCompressionPct
    : Number.isFinite(gg?.fuelPct) ? gg.fuelPct : 50;

  // daily baselines for each KPI
  const breadthBaseline  = useDailyBaseline("breadth",  breadth);
  const momentumBaseline = useDailyBaseline("momentum", momentum);
  const squeezeBaseline  = useDailyBaseline("squeeze",  compression);

  // composite meter (optional soft clamp when major squeeze)
  const expansion = 100 - Math.max(0, Math.min(100, compression));
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const meter = Math.round(compression >= 90 ? 45 + (baseMeter - 50) * 0.30 : baseMeter);

  const meterTone = toneFor(meter);

  return (
    <section id="row-2" className="panel" style={{ padding: 0 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter</div>
        <div className="spacer" />
        <span className="small muted">Bearish ← 0 … 100 → Bullish</span>
      </div>

      {/* main meter */}
      <div className={`kpi-bar ${meterTone}`} style={{ margin: "10px 10px 6px 10px" }}>
        <div className="kpi-fill" style={{ width: `${Math.max(0, Math.min(100, meter))}%` }} />
      </div>
      {/* numeric current value + optional note */}
      <div className="small muted" style={{ display:"flex", justifyContent:"space-between", padding: "0 10px 6px 10px" }}>
        <span>Meter: <strong>{pct(meter)}%</strong></span>
        {compression >= 90 && <span>Major squeeze — direction unknown</span>}
      </div>

      {/* three KPI tiles below */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "0 10px 10px 10px" }}>
        <KpiTile title="Breadth"  value={breadth}  baseline={breadthBaseline} />
        <KpiTile title="Momentum" value={momentum} baseline={momentumBaseline} />
        <KpiTile title="Squeeze (Compression)" value={compression} baseline={squeezeBaseline} />
      </div>

      {loading && <div className="small muted" style={{ padding: "0 10px 10px 10px" }}>Loading…</div>}
      {error   && <div className="small muted" style={{ padding: "0 10px 10px 10px" }}>Failed to load.</div>}
    </section>
  );
}
