// src/components/GaugeCluster.jsx
// Ferrari Dashboard cluster — FULL FILE (R4 cockpit geometry)

import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* ----------- helpers ----------- */
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
  } catch { return "—"; }
}
function freshnessColor(ts) {
  try {
    const t = new Date(ts).getTime();
    const mins = (Date.now() - t) / 60000;
    if (mins < 15) return "#22c55e"; // green
    if (mins < 60) return "#f59e0b"; // yellow
    return "#ef4444";                // red
  } catch { return "#6b7280"; }
}

const Panel = ({ title, children, className = "" }) => (
  <div className={`panel ${className}`}>
    {title && (
      <div className="panel-head">
        <div className="panel-title">{title}</div>
      </div>
    )}
    {children}
  </div>
);

/* Engine-light pill (info -> ok/green) */
const Pill = ({ label, severity = "ok" }) => {
  const tone = (severity === "danger") ? "danger" :
               (severity === "warn")   ? "warn"   : "ok";
  const map = {
    ok:     { bg:"#052e1b", bd:"#14532d", fg:"#34d399" },
    warn:   { bg:"#2a1f05", bd:"#7c5806", fg:"#fbbf24" },
    danger: { bg:"#2a0b0b", bd:"#7f1d1d", fg:"#ef4444" },
  }[tone];
  return (
    <span style={{
      padding:"6px 10px",
      borderRadius:999,
      border:`1px solid ${map.bd}`,
      background:map.bg,
      color:map.fg,
      fontSize:12,
      fontWeight:800,
      boxShadow:`0 0 10px ${map.fg}66, inset 0 0 0 1px #ffffff08`,
      display:"inline-flex",
      alignItems:"center",
      gap:6
    }}>
      <span style={{ width:8, height:8, borderRadius:999, background:map.fg, boxShadow:`0 0 8px ${map.fg}` }}/>
      {label}
    </span>
  );
};

/* ----------- MAIN ----------- */
export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);
  const ts = data?.meta?.ts;
  const color = freshnessColor(ts);

  return (
    <div className="cluster">
      {/* Header */}
      <div className="panel" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:700}}>Ferrari Trading Cluster</div>
          <div className="small muted">Live from /api/dashboard</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div className="tag" style={{borderColor:color,display:"flex",gap:8,alignItems:"center"}}>
            <span style={{width:8,height:8,borderRadius:999,background:color,boxShadow:`0 0 8px ${color}`}}/>
            <span className="small">{ts ? `Updated ${timeAgo(ts)}` : "—"}</span>
          </div>
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && !data && <div className="panel">Loading…</div>}
      {error && <div className="panel">Error: {String(error)}</div>}
      {!data && !loading && !error && <div className="panel">No data</div>}

      {/* Content */}
      {data && (
        <>
          {/* Gauges — Ferrari cockpit geometry (left minis | BIG tach | speedo) */}
          <Panel title="Gauges" className="carbon-fiber">
            <div className="cockpit">
              {/* Left: 2×2 mini stack */}
              <div className="left-stack">
                <MiniGauge label="WATER" value={data.gauges?.waterTemp} unit="°F" />
                <MiniGauge label="OIL"   value={data.gauges?.oilPsi}    unit="psi" />
                <MiniGauge label="FUEL"  value={data.gauges?.fuelPct}   unit="%" />
                <MiniGauge label="ALT"   value="—" />
              </div>

              {/* Center: big yellow tach */}
              <BigGauge theme="tach"  label="RPM"   value={data.gauges?.rpm} />

              {/* Right: slightly smaller red speedo */}
              <div className="right-speed">
                <BigGauge theme="speed" label="SPEED" value={data.gauges?.speed} />
              </div>
            </div>
          </Panel>

          {/* Odometers */}
          <Panel title="Odometers">
            <div className="odos">
              <Odometer label="Breadth"  value={data.odometers?.breadthOdometer} />
              <Odometer label="Momentum" value={data.odometers?.momentumOdometer} />
              <Odometer label="Squeeze"  value={String(data.odometers?.squeeze ?? "—")} />
            </div>
          </Panel>

          {/* Engine lights (bottom row) */}
          <Panel title="Engine Lights">
            <div className="lights">
              {renderSignal("Breakout",      data.signals?.sigBreakout)}
              {renderSignal("Compression",   data.signals?.sigCompression)}
              {renderSignal("Expansion",     data.signals?.sigExpansion)}
              {renderSignal("Turbo",         data.signals?.sigTurbo)}
              {renderSignal("Distribution",  data.signals?.sigDistribution)}
              {renderSignal("Divergence",    data.signals?.sigDivergence)}
              {renderSignal("Overheat",      data.signals?.sigOverheat)}
              {renderSignal("Low Liquidity", data.signals?.sigLowLiquidity)}
              {(!anyActive(data.signals)) && <span className="small muted">No active signals</span>}
            </div>
          </Panel>

          {/* Sectors */}
          <Panel title="Sectors">
            <div className="sectors-grid">
              {(data.outlook?.sectorCards || []).map((s, i) => (
                <div key={i} className="sector-card">
                  <div className="sector-head">
                    <div className="sector-name">{s.sector}</div>
                    <span className={`tag ${toneFromOutlook(s.outlook)}`}>{s.outlook}</span>
                  </div>
                  <Spark values={s.spark || []} />
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/* ----------- Components ----------- */
function BigGauge({ theme="tach", label, value=0 }) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // Map [-1000..1000] → [-130..130] sweep
  const t = (clamp(value, -1000, 1000) + 1000) / 2000;
  const angle = -130 + t * 260;

  const face = theme === "tach" ? "#facc15" : "#dc2626"; // yellow / red

  return (
    <div className={`fg-wrap ${theme === "tach" ? "gauge--tach" : "gauge--speed"}`}>
      <div className="gauge-face" style={{ background: face }}>
        {/* 18px red perimeter ring under ticks */}
        <div className="ring" />
        {/* White ticks */}
        <div className="ticks">
          {Array.from({ length: 9 }, (_, i) => {
            const a = -130 + i * (260 / 8);
            return <Tick key={i} angle={a} major={i % 2 === 0} />;
          })}
        </div>
        {/* Needle & hub */}
        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub" />
        {/* Bezel branding (optional, commented to keep clean numbers) */}
        {/* <div className="arc-top">REDLINE TRADING</div>
        <div className="arc-bottom">POWERED BY AI</div> */}
        <div className="glass" />
      </div>
      <div className="fg-title">{label}</div>
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
      <div className="mini-value">{value ?? "—"}{unit || ""}</div>
      <div className="mini-title">{label}</div>
    </div>
  );
}

function Odometer({ label, value }) {
  return (
    <div className="odo">
      <div className="odo-label">{label}</div>
      <div className="odo-value">{value ?? "—"}</div>
    </div>
  );
}

function toneFromOutlook(o) {
  const k = String(o || "").toLowerCase();
  if (k.includes("bull")) return "tag-ok";
  if (k.includes("bear")) return "tag-danger";
  return "tag-info";
}

function Spark({ values=[] }) {
  if (values.length < 2) return <div className="sector-spark">(no data)</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const W=180, H=36;
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

function anyActive(signals) {
  if (!signals) return false;
  return Object.values(signals).some(v => v && v.active === true);
}

function renderSignal(label, sig) {
  if (!sig || !sig.active) return null;
  const sev = (sig.severity || "info").toLowerCase();
  const severity = sev === "danger" ? "danger" : (sev === "warn" ? "warn" : "ok"); // info → ok
  return <Pill key={label} label={label} severity={severity} />;
}
