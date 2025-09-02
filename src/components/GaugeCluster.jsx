// src/components/GaugeCluster.jsx
// Ferrari Dashboard cluster — FULL FILE (R7: centered cockpit + branding arcs + engine lights)

import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* ---------- helpers ---------- */
function timeAgo(ts) {
  try {
    const t = new Date(ts).getTime();
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  } catch { return "—"; }
}
function freshnessColor(ts) {
  try {
    const t = new Date(ts).getTime();
    const mins = (Date.now() - t) / 60000;
    if (mins < 15) return "#22c55e";
    if (mins < 60) return "#f59e0b";
    return "#ef4444";
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

/* ---------- engine-light pill ---------- */
/* states: off | ok | warn | danger */
const Pill = ({ label, state = "off", icon = "" }) => {
  return (
    <span className={`light ${state}`} aria-label={`${label}: ${state}`}>
      <span className="light-icon">{icon}</span>
      <span className="light-text">{label}</span>
    </span>
  );
};

/* ---------- main ---------- */
export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);
  const ts = data?.meta?.ts;
  const color = freshnessColor(ts);

  /* Build engine-light states */
  const s = data?.signals || {};
  const squeeze = String(data?.odometers?.squeeze || "none");

  const mapSig = (sig) => {
    if (!sig || !sig.active) return "off";
    const sev = String(sig.severity || "info").toLowerCase();
    return sev === "danger" ? "danger" : sev === "warn" ? "warn" : "ok";
  };

  const squeezeState =
    squeeze === "firingDown" ? "danger" :
    squeeze === "firingUp"   ? "ok"     :
    squeeze === "on"         ? "warn"   : "off";

  const lights = [
    { label: "Breakout",      state: mapSig(s.sigBreakout),      icon: "📈" },
    { label: "Squeeze",       state: squeezeState,               icon: "⏳" },
    { label: "Overextended",  state: mapSig(s.sigOverheat),      icon: "🚀" },
    { label: "Distribution",  state: mapSig(s.sigDistribution),  icon: "📉" },
    { label: "Divergence",    state: mapSig(s.sigDivergence),    icon: "↔️" },
    { label: "Risk Alert",    state: mapSig(s.sigOverheat),      icon: "⚡" },  // shares severity with overheat for now
    { label: "Liquidity Weak",state: mapSig(s.sigLowLiquidity),  icon: "💧" },
    { label: "Turbo",         state: mapSig(s.sigTurbo),         icon: "⚡" },
    // placeholders (OFF by default; wire later if you like)
    { label: "News",          state: "off",                      icon: "📰" },
    { label: "Earnings",      state: "off",                      icon: "📊" },
    { label: "Halt",          state: "off",                      icon: "⛔" },
    { label: "Circuit",       state: "off",                      icon: "🛑" },
  ];

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
          {/* Cockpit — centered block with tight pair */}
          <Panel title="Gauges" className="carbon-fiber">
            <div className="cockpit-center">
              <div className="cockpit">
                {/* Minis left (2×2) */}
                <div className="left-stack">
                  <MiniGauge label="WATER" value={data.gauges?.waterTemp} unit="°F" />
                  <MiniGauge label="OIL"   value={data.gauges?.oilPsi}    unit="psi" />
                  <MiniGauge label="FUEL"  value={data.gauges?.fuelPct}   unit="%" />
                  <MiniGauge label="ALT"   value="—" />
                </div>

                {/* Center tach (yellow) with outside branding arcs */}
                <div className="center-tach">
                  <BigGauge theme="tach"  label="RPM"   value={data.gauges?.rpm} withLogo />
                </div>

                {/* Right speedo (red) */}
                <div className="right-speed">
                  <BigGauge theme="speed" label="SPEED" value={data.gauges?.speed} />
                </div>
              </div>
            </div>
          </Panel>

          {/* Engine lights row (always visible) */}
          <Panel title="Engine Lights">
            <div className="lights">
              {lights.map((L, i) => (
                <Pill key={i} label={L.label} state={L.state} icon={L.icon} />
              ))}
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

          {/* Sectors */}
          <Panel title="Sectors">
            <div className="sectors-grid">
              {(data.outlook?.sectorCards || []).map((c, i) => (
                <div key={i} className="sector-card">
                  <div className="sector-head">
                    <div className="sector-name">{c.sector}</div>
                    <span className="tag">{c.outlook}</span>
                  </div>
                  <Spark values={c.spark || []} />
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/* ---------- components ---------- */
function BigGauge({ theme="tach", label, value=0, withLogo=false }) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const t = (clamp(value, -1000, 1000) + 1000) / 2000;
  const angle = -130 + t * 260;

  const isTach = theme === "tach";
  const face = isTach ? "#ffdd00" : "#c21a1a";

  return (
    <div className={`fg-wrap ${isTach ? "gauge--tach" : "gauge--speed"}`}>
      <div className="gauge-face" style={{ background: face }}>
        {/* 18px red perimeter ring under ticks */}
        <div className="ring" />
        {/* Ferrari ticks */}
        <div className="ticks">
          {Array.from({ length: 9 }, (_, i) => {
            const a = -130 + i * (260 / 8);
            return <Tick key={i} angle={a} major={i % 2 === 0} />;
          })}
        </div>

        {/* Optional tach redline arc (rightmost 20% sweep) */}
        {isTach && <div className="redline-arc" aria-hidden />}

        {/* Needle & hub */}
        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub" />

        {/* Glass highlight */}
        <div className="glass" />

        {/* Outside bezel branding arcs (tach only, outside ring) */}
        {withLogo && (
          <svg className="logo-ring" viewBox="0 0 220 220" aria-hidden>
            {/* Circle path a bit larger than face so text sits outside bezel */}
            <defs>
              <path id="ringPath" d="M110,10 a100,100 0 1,1 0,200 a100,100 0 1,1 0,-200" />
              <path id="ringPathBottom" d="M110,210 a100,100 0 1,1 0,-200 a100,100 0 1,1 0,200" />
            </defs>
            <text className="logo-top">
              <textPath href="#ringPath" startOffset="50%" textAnchor="middle">REDLINE TRADING</textPath>
            </text>
            <text className="logo-bottom">
              <textPath href="#ringPathBottom" startOffset="50%" textAnchor="middle">POWERED BY AI</textPath>
            </text>
          </svg>
        )}
      </div>
      <div className="fg-title">{label}</div>
    </div>
  );
}

function Tick({ angle, major }) {
  return <div className={`tick ${major ? "major" : "minor"}`} style={{ transform: `rotate(${angle}deg)` }} />;
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
