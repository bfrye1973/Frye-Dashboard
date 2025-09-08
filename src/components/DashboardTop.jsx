// src/components/DashboardTop.jsx
// Market Meter + KPI tiles (Breadth, Momentum, Squeeze) with lastGood fallback
import React, { useEffect, useState } from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(n) || 0));

function tone(v) {
  const n = clamp(v);
  if (n >= 60) return "ok";       // green
  if (n >= 40) return "warn";     // yellow
  return "danger";                // red
}

function fmt(n, d = 0) {
  const x = Number(n);
  if (Number.isNaN(x)) return "—";
  return x.toFixed(d);
}

/* ---------- components ---------- */
function MarketMeter({ value = 50, delta = 0, label = "Market Meter" }) {
  const n = clamp(value);
  const t = tone(n);
  return (
    <div className="panel" style={{padding:12, border:"1px solid #1f2a44", borderRadius:12, background:"#0e1526"}}>
      <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
        <div style={{fontWeight:700}}>{label}</div>
        <div className="small muted">0 = Bearish · 100 = Bullish</div>
      </div>
      <div style={{position:"relative", height:16, border:"1px solid #334155", borderRadius:8, background:"#0b1220", overflow:"hidden"}}>
        <div
          className={`meter-fill ${t}`}
          style={{width:`${n}%`, height:"100%"}}
        />
        <div style={{
          position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)",
          fontWeight:800
        }}>
          {fmt(n)}
        </div>
      </div>
      <div className="small muted" style={{marginTop:6}}>
        Δ day: <b style={{color: delta > 0 ? "#22c55e" : delta < 0 ? "#ef4444" : "#93a3b8"}}>
          {delta > 0 ? "+" : ""}{fmt(delta, 1)}
        </b>
      </div>
    </div>
  );
}

function KpiTile({ title, value = 0, spark = [], unit = "", hint = "" }) {
  const n = clamp(value);
  const t = tone(n);
  return (
    <div className="panel" style={{padding:12, border:"1px solid #1f2a44", borderRadius:12, background:"#0e1526"}}>
      <div style={{fontSize:12, opacity:.9, marginBottom:6}}>{title}</div>
      <div style={{display:"flex", alignItems:"baseline", gap:8}}>
        <div style={{fontSize:28, fontWeight:800}}>{fmt(n)}</div>
        <div style={{opacity:.75}}>{unit}</div>
      </div>
      <div className={`kpi-bar ${t}`} style={{marginTop:8}}>
        <div className="kpi-fill" style={{width:`${n}%`}} />
      </div>
      {hint ? <div className="small muted" style={{marginTop:6}}>{hint}</div> : null}
      {/* optional sparkline placeholder */}
      {Array.isArray(spark) && spark.length > 1 ? (
        <div className="sparkline small muted" style={{marginTop:6}}>(spark)</div>
      ) : null}
    </div>
  );
}

/* ---------- DEFAULT EXPORT ---------- */
export default function DashboardTop() {
  const { data, error } = useDashboardPoll(5000);

  // keep last good to avoid flicker on temporary 500s
  const [lastGood, setLastGood] = useState(null);
  useEffect(() => { if (data) setLastGood(data); }, [data]);

  const working = data || lastGood || null;

  if (!working) {
    return (
      <div className="panel" style={{padding:12, border:"1px solid #1f2a44", borderRadius:12, background:"#0e1526"}}>
        <div className="small muted">(Waiting for data…)</div>
      </div>
    );
  }

  const summary    = working.summary || {};
  const odometers  = working.odometers || {};
  const gauges     = working.gauges || {};

  // Composite suggestion: use your own composite if you already have one
  // Example: (breadth + momentum + (100 - squeeze%)) / 3
  const squeezePct = clamp(gauges.fuelPct);
  const comp       = (Number(odometers.breadthOdometer || 0) +
                      Number(odometers.momentumOdometer || 0) +
                      clamp(100 - squeezePct)) / 3;

  // Deltas (placeholder 0 unless you calculate day-over-day)
  const compDelta = 0;

  return (
    <div style={{display:"grid", gap:12}}>
      <MarketMeter value={comp} delta={compDelta} label="Market Meter" />
      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12}}>
        <KpiTile title="Breadth"  value={odometers.breadthOdometer}  hint={summary.breadthState} />
        <KpiTile title="Momentum" value={odometers.momentumOdometer} hint={summary.momentumState} />
        <KpiTile title="Squeeze"  value={squeezePct} unit="%" hint="Lower is tighter" />
      </div>
      {error ? <div className="small text-danger">Error: {String(error?.message || error)}</div> : null}
    </div>
  );
}
