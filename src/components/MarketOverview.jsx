// src/components/MarketOverview.jsx
import React, { useMemo, useRef } from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

const clamp = (v, lo=0, hi=100) => Math.max(lo, Math.min(hi, Number(v) || 0));
const fmt = (n, d=0) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d) : "—");
const tone = v => (clamp(v) >= 60 ? "ok" : clamp(v) >= 40 ? "warn" : "danger");
const toneLabel = v => (clamp(v) >= 60 ? "Bullish" : clamp(v) >= 40 ? "Neutral" : "Bearish");

function useDelta(value) {
  const prevRef = useRef(value);
  return useMemo(() => {
    const prev = prevRef.current;
    const d = (Number.isFinite(value) && Number.isFinite(prev)) ? value - prev : 0;
    prevRef.current = value;
    return d;
  }, [value]);
}

function MarketMeter({ value = 50, note }) {
  const d = useDelta(value);
  const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  const t = tone(value);
  return (
    <div className="panel" style={panel}>
      <div className="panel-head">
        <div className="panel-title">Market Meter</div>
        <div className="spacer" />
        <span className={`tag tag-${t}`} style={{ minWidth:72, textAlign:"center" }}>
          {t === "ok" ? "Bullish" : t === "warn" ? "Neutral" : "Bearish"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: "100%", height: 10, background:"#0b1220", border:"1px solid #1f2a44", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ width: `${clamp(value)}%`, height: "100%", background: t === "ok" ? "#16a34a" : t === "warn" ? "#f59e0b" : "#ef4444" }} />
        </div>
        <div style={{ width: 60, textAlign: "right", fontWeight: 800 }}>{Math.round(value)}</div>
        <div className={`delta ${d>0 ? "delta-up" : d<0 ? "delta-down" : "delta-flat"}`}>{arrow} {fmt(d,1)}</div>
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        Bearish &larr; 0 … 100 &rarr; Bullish
        {note ? <span style={{ marginLeft:12 }} className="tag tag-warn">{note}</span> : null}
      </div>
    </div>
  );
}

function Tile({ title, value, unit="", hint="" }) {
  const t = tone(value);
  const d = useDelta(value);
  const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  return (
    <div className="panel" style={panel}>
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        <div className="spacer" />
        <span className={`tag tag-${t}`} style={{ minWidth:72, textAlign:"center" }}>
          {t === "ok" ? "Bullish" : t === "warn" ? "Neutral" : "Bearish"}
        </span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontSize:28, fontWeight:800 }}>
          {fmt(value)} <span style={{ opacity:.7, fontSize:14 }}>{unit}</span>
        </div>
        <div className={`delta ${d>0 ? "delta-up" : d<0 ? "delta-down" : "delta-flat"}`}>{arrow} {fmt(d,1)}</div>
      </div>
      <div className="kpi-bar" style={{ marginTop:8 }}>
        <div className="kpi-fill" style={{ width:`${clamp(value)}%`, background: t === "ok" ? "#22c55e" : t === "warn" ? "#f59e0b" : "#ef4444" }} />
      </div>
      <div className="small muted" style={{ marginTop:6 }}>{hint || toneLabel(value)}</div>
    </div>
  );
}

function Lights({ breadth, momentum, squeeze }) {
  const chip = (label, v) => {
    const t = tone(v);
    const bg = t === "ok" ? "#16a34a" : t === "warn" ? "#f59e0b" : "#ef4444";
    return (
      <div className="panel" style={panelGrid}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: bg, boxShadow:`0 0 18px ${bg}` }} />
        <div style={{ fontWeight:700, marginTop:6 }}>{label}</div>
        <div className="small muted">{fmt(v)}</div>
      </div>
    );
  };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
      {chip("Breadth", breadth)}
      {chip("Momentum", momentum)}
      {chip("Squeeze", squeeze)}
    </div>
  );
}

function Arrows({ breadth, momentum, squeeze }) {
  const ArrowCard = ({ title, value }) => {
    const d = useDelta(value);
    const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
    const color = d > 0 ? "#22c55e" : d < 0 ? "#ef4444" : "#eab308";
    const t = tone(value);
    return (
      <div className="panel" style={panel}>
        <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
          <div style={{ fontSize:28, fontWeight:800 }}>{fmt(value)}</div>
          <div style={{ fontSize:22, color }}>{arrow}</div>
        </div>
        <div className="kpi-bar" style={{ marginTop:8 }}>
          <div className="kpi-fill" style={{ width:`${clamp(value)}%`, background: t === "ok" ? "#22c55e" : t === "warn" ? "#f59e0b" : "#ef4444" }} />
        </div>
        <div className="small muted" style={{ marginTop:6 }}>{title}</div>
      </div>
    );
  };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
      <ArrowCard title="Breadth" value={breadth} />
      <ArrowCard title="Momentum" value={momentum} />
      <ArrowCard title="Squeeze" value={squeeze} />
    </div>
  );
}

export default function MarketOverview({ mode }) {
  const { data, error } = useDashboardPoll(5000);
  const [lastGood] = React.useState(null); // not used directly; use data fallback below

  const working = data || lastGood || null;
  if (!working) {
    return (
      <section className="panel" style={panel}>
        <div className="small muted">(Waiting for data…)</div>
      </section>
    );
  }

  const summary   = working.summary   || {};
  const odometers = working.odometers || {};
  const gauges    = working.gauges    || {};

  const breadthIdx  = Number.isFinite(summary.breadthIdx)  ? summary.breadthIdx  : odometers.breadthOdometer  ?? 50;
  const momentumIdx = Number.isFinite(summary.momentumIdx) ? summary.momentumIdx : odometers.momentumOdometer ?? 50;

  const squeezePct =
    Number.isFinite(gauges?.squeezeDaily?.pct) ? gauges.squeezeDaily.pct :
    Number.isFinite(gauges?.squeeze?.pct)      ? gauges.squeeze.pct :
    Number.isFinite(gauges?.fuelPct)           ? gauges.fuelPct :
    0;

  const expansion = 100 - clamp(squeezePct);
  const baseMeter = (0.40*breadthIdx) + (0.40*momentumIdx) + (0.20*expansion);
  const marketMeter = clamp(
    squeezePct >= 90 ? (45 + (baseMeter - 50) * 0.30) : baseMeter
  );
  const meterNote = squeezePct >= 90 ? `Major Squeeze (${fmt(squeezePct,1)}%) — direction unknown` : null;

  if (mode === "lights") {
    return <Lights breadth={breadthIdx} momentum={momentumIdx} squeeze={squeezePct} />;
  }
  if (mode === "arrows") {
    return <Arrows breadth={breadthIdx} momentum={momentumIdx} squeeze={squeezePct} />;
  }
  // default: meter + tiles
  return (
    <div style={{ display:"grid", gap:12 }}>
      <MarketMeter value={marketMeter} note={meterNote} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        <Tile title="Breadth"  value={breadthIdx}               hint={toneLabel(breadthIdx)} />
        <Tile title="Momentum" value={momentumIdx}              hint={toneLabel(momentumIdx)} />
        <Tile title="Squeeze (Compression)" value={squeezePct} unit="%" hint="Lower is tighter" />
      </div>
    </div>
  );
}

const panel = { border:"1px solid #1f2a44", borderRadius:12, padding:10, background:"#0e1526" };
const panelGrid = { ...panel, display:"grid", placeItems:"center", gap:8 };
