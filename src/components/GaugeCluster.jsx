// src/components/GaugeCluster.jsx
// Renders the Ferrari dashboard from /api/dashboard with:
// - Freshness badge from meta.ts (green/yellow/red)
// - Manual Refresh button (calls refresh() from useDashboardPoll)
// - Gauges (rpm/speed/fuel/water/oil), odometers, engine lights, sector cards

import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

// ---------- helpers ----------
function timeAgo(ts) {
  try {
    const t = new Date(ts).getTime();
    const d = Date.now() - t;
    const s = Math.floor(d / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  } catch {
    return "—";
  }
}
function freshnessColor(ts) {
  try {
    const t = new Date(ts).getTime();
    const mins = (Date.now() - t) / 60000;
    if (mins < 15) return "#22c55e"; // green
    if (mins < 60) return "#f59e0b"; // yellow
    return "#ef4444";                // red
  } catch {
    return "#6b7280";
  }
}

const Panel = ({ title, children }) => (
  <div className="panel">
    {title && <div className="panel-title">{title}</div>}
    <div>{children}</div>
  </div>
);

// Pills for engine lights
const Pill = ({ label, tone="info" }) => {
  const map = {
    info:   { bg:"#0b1220", bd:"#334155", fg:"#93c5fd" },
    warn:   { bg:"#2a1f05", bd:"#7c5806", fg:"#fbbf24" },
    danger: { bg:"#2a0b0b", bd:"#7f1d1d", fg:"#ef4444" },
    ok:     { bg:"#052e1b", bd:"#14532d", fg:"#34d399" },
  }[tone] || { bg:"#0b1220", bd:"#334155", fg:"#e5e7eb" };
  return (
    <span style={{
      padding:"4px 8px", borderRadius:8, border:`1px solid ${map.bd}`,
      background:map.bg, color:map.fg, fontSize:12, marginRight:6, display:"inline-flex", alignItems:"center", gap:6
    }}>
      <span style={{ width:8, height:8, borderRadius:999, background:map.fg, boxShadow:`0 0 8px ${map.fg}` }}/>
      {label}
    </span>
  );
};

// ---------- MAIN ----------
export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);

  // header UI (freshness + refresh)
  const ts = data?.meta?.ts;
  const color = freshnessColor(ts);

  return (
    <div className="cluster-wrap">
      {/* Header row */}
      <div className="cluster-header">
        <div className="cluster-title">
          <div className="title-main">Ferrari Trading Cluster</div>
          <div className="title-sub">Live dashboard • SVG needles</div>
        </div>

        <div className="cluster-actions">
          <div className="freshness-pill" title={ts || ""} style={{ borderColor: color }}>
            <span className="dot" style={{ background: color, boxShadow: `0 0 10px ${color}` }}/>
            <span className="fresh-text">{ts ? `Updated ${timeAgo(ts)}` : "—"}</span>
          </div>
          <button className="btn" onClick={refresh} disabled={loading} title="Manual refresh">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Loading / error */}
      {loading && !data && <div className="hint">Loading dashboard…</div>}
      {error && <div className="error">Failed to load: {String(error)}</div>}
      {!data && !loading && !error && <div className="hint">No data</div>}

      {data && (
        <div className="grid">
          {/* Gauges */}
          <Panel title="Gauges">
            <div className="gauges-row">
              <Gauge label="RPM"       value={data.gauges?.rpm}   min={-1000} max={1000} theme="tach" />
              <Gauge label="SPEED"     value={data.gauges?.speed} min={-1000} max={1000} theme="speed" />
              <MiniGauge label="FUEL"       value={data.gauges?.fuelPct}   unit="%"   />
              <MiniGauge label="WATER"      value={data.gauges?.waterTemp} unit="°F"  />
              <MiniGauge label="OIL"        value={data.gauges?.oilPsi}    unit="psi" />
            </div>
          </Panel>

          {/* Odometers */}
          <Panel title="Odometers">
            <div className="odom-row">
              <Odometer label="Breadth"  value={data.odometers?.breadthOdometer}  />
              <Odometer label="Momentum" value={data.odometers?.momentumOdometer} />
              <Badge label={`Squeeze: ${data.odometers?.squeeze ?? "—"}`} />
            </div>
          </Panel>

          {/* Engine Lights — only show active */}
          <Panel title="Engine Lights">
            <div className="lights-row">
              {renderSignal("Breakout",     data.signals?.sigBreakout)}
              {renderSignal("Distribution", data.signals?.sigDistribution)}
              {renderSignal("Turbo",        data.signals?.sigTurbo)}
              {renderSignal("Compression",  data.signals?.sigCompression)}
              {renderSignal("Expansion",    data.signals?.sigExpansion)}
              {renderSignal("Divergence",   data.signals?.sigDivergence)}
              {renderSignal("Overheat",     data.signals?.sigOverheat)}
              {renderSignal("Low Liquidity",data.signals?.sigLowLiquidity)}
              {/* if none active */}
              {(!anyActive(data.signals)) && <span className="hint">No active signals</span>}
            </div>
          </Panel>

          {/* Sectors */}
          <Panel title="Sectors">
            <div className="sectors">
              {(data.outlook?.sectorCards || []).map((s, i) => (
                <div key={i} className="sector-card">
                  <div className="sector-head">
                    <div className="sector-name">{s.sector}</div>
                    <Badge label={s.outlook} />
                  </div>
                  <Spark values={s.spark || []} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

// ---------- simple components ----------
function Gauge({ label, value=0, min=-1000, max=1000, theme="tach" }) {
  // Map [-1000..1000] → [-130..130] deg
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const t = (clamp(value, min, max) - min) / (max - min || 1);
  const angle = -130 + t * 260;

  const faceColor = theme === "tach" ? "#facc15" : "#dc2626"; // yellow/red
  const labelColor = "#0b1220";

  return (
    <div className="gauge">
      <div className="gauge-face" style={{ background: faceColor }}>
        {/* red perimeter ring under ticks */}
        <div className="ring" />
        {/* ticks */}
        <div className="ticks">
          {Array.from({ length: 9 }, (_, i) => {
            const a = -130 + i * (260 / 8);
            return <Tick key={i} angle={a} major={i % 2 === 0} />;
          })}
        </div>
        {/* needle */}
        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub" />
      </div>
      <div className="gauge-label" style={{ color: labelColor }}>{label}</div>
    </div>
  );
}
function Tick({ angle, major }) {
  return (
    <div
      className={`tick ${major ? "major" : "minor"}`}
      style={{ transform: `rotate(${angle}deg)` }}
    />
  );
}
function MiniGauge({ label, value, unit }) {
  return (
    <div className="mini">
      <div className="mini-face">
        <div className="mini-needle" />
        <div className="mini-hub" />
      </div>
      <div className="mini-row">
        <div className="mini-label">{label}</div>
        <div className="mini-value">{value ?? "—"}{unit || ""}</div>
      </div>
    </div>
  );
}
function Odometer({ label, value }) {
  return (
    <div className="odom">
      <div className="odom-label">{label}</div>
      <div className="odom-value">{value ?? "—"}</div>
    </div>
  );
}
function Badge({ label }) {
  return <span className="badge">{label}</span>;
}
function anyActive(signals) {
  if (!signals) return false;
  return Object.values(signals).some(v => v && (v.active === true));
}
function renderSignal(label, sig) {
  if (!sig || !sig.active) return null;
  return <Pill key={label} label={label} tone={sig.severity || "info"} />;
}
function Spark({ values=[] }) {
  if (values.length < 2) return <div className="spark">(no data)</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const H = 28, W = 120;
  const norm = v => (max - min ? (v - min) / (max - min) : 0.5);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - 8) + 4;
    const y = (1 - norm(v)) * (H - 8) + 4;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={pts} />
    </svg>
  );
}
