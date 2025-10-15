// src/components/StrategiesPanel.jsx
import React from "react";
import { useDashboardPoll } from "../lib/dashboardApiSafe";

const card = { border:"1px solid #1f2a44", borderRadius:12, padding:12, background:"#0e1526" };
const header = { fontWeight:700, marginBottom:8, display:"flex", alignItems:"center", gap:8 };
const kpiRow = { display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8, marginTop:8 };
const kpiBox = { background:"#0b1220", border:"1px solid #334155", borderRadius:8, padding:"6px 8px" };
const statusPill = (on) => ({ padding:"2px 8px", borderRadius:999, fontSize:12, border:"1px solid "+(on?"#14532d":"#334155"), background:on?"#052e1b":"#0b1220", color:on?"#22c55e":"#93a3b8" });

export default function StrategiesPanel() {
  const { data } = useDashboardPoll(5000);
  const working = data || null;
  if (!working) return <section className="panel" style={card}><div className="panel-head"><div className="panel-title">Strategies</div></div><div className="small muted">(Waiting for data…)</div></section>;

  const summary   = working.summary   || {};
  const gauges    = working.gauges    || {};
  const signals   = working.signals   || {};

  const breadthIdx  = Number.isFinite(summary.breadthIdx)  ? summary.breadthIdx  : 50;
  const momentumIdx = Number.isFinite(summary.momentumIdx) ? summary.momentumIdx : 50;
  const squeezePct  =
    Number.isFinite(gauges?.squeezeDaily?.pct) ? gauges.squeezeDaily.pct :
    Number.isFinite(gauges?.squeeze?.pct)      ? gauges.squeeze.pct :
    Number.isFinite(gauges?.fuelPct)           ? gauges.fuelPct :
    null;

  const isActive = (sig) => !!(sig && sig.active);

  const strat = [
    {
      key: "breakout", title: "Breakout", icon: "📈",
      active: isActive(signals?.sigBreakout) || isActive(signals?.sigOverextended),
      hint: "Triggers on momentum thrust & price expansion.",
      kpis: [
        { label:"Bias", value: momentumIdx, fmt:v=>Number.isFinite(v)?v:"—" },
        { label:"Squeeze", value: squeezePct, fmt:v=>Number.isFinite(v)?`${v}%`:"—" },
        { label:"Status", value: isActive(signals?.sigBreakout) ? "Active" : "Flat", fmt:v=>v }
      ]
    },
    {
      key: "meanrev", title: "Mean Reversion", icon: "🔄",
      active: isActive(signals?.sigDistribution) || isActive(signals?.sigDivergence),
      hint: "Engages on exhaustion & reversion signals.",
      kpis: [
        { label:"Breadth", value: breadthIdx, fmt:v=>Number.isFinite(v)?v:"—" },
        { label:"Diverg.", value: isActive(signals?.sigDivergence) ? "Yes" : "No", fmt:v=>v },
        { label:"Status", value: isActive(signals?.sigDistribution) ? "Active" : "Flat", fmt:v=>v }
      ]
    },
    {
      key: "trend", title: "Trend Following", icon: "📊",
      active: isActive(signals?.sigRiskAlert) ? false : (momentumIdx >= 60 && breadthIdx >= 60),
      hint: "Runs in aligned breadth & momentum regimes.",
      kpis: [
        { label:"Breadth", value: breadthIdx, fmt:v=>Number.isFinite(v)?v:"—" },
        { label:"Momentum", value: momentumIdx, fmt:v=>Number.isFinite(v)?v:"—" },
        { label:"Status", value: (momentumIdx >= 60 && breadthIdx >= 60) ? "Ready" : "Caution", fmt:v=>v }
      ]
    },
  ];

  return (
    <section className="panel" style={{ border:"1px solid #1f2a44", borderRadius:12, padding:10, background:"#0e1526" }}>
      <div className="panel-head"><div className="panel-title">Strategies</div></div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 12 }}>
        {strat.map(s => (
          <div key={s.key} style={card}>
            <div style={header}>
              <div style={{ fontSize:18 }}>{s.icon}</div>
              <div>{s.title}</div>
              <div style={{ flex:1 }} />
              <span style={statusPill(s.active)}>{s.active ? "Active" : "Flat"}</span>
            </div>
            <div className="small muted">{s.hint}</div>
            <div style={kpiRow}>
              {s.kpis.map((k, i) => (
                <div key={i} style={kpiBox}>
                  <div className="small muted" style={{ marginBottom:2 }}>{k.label}</div>
                  <div style={{ fontWeight:700 }}>{k.fmt(k.value)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
