// src/components/GaugeCluster.jsx
// Ferrari Dashboard — R8.4 (stable)
// - Big gauges (tach/speed) with numerals; masked tach rim; ticks hidden
// - Mini gauges (Water/Oil/Fuel/Alt) with readout below + warn/danger + pulsing rim
// - Engine lights, odometers, sector cards (NH / NL / 3U / 3D)
// - Optional big-gauge ring coloring via data.lights.{breadth|momentum}

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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mapToDeg = (v, lo, hi) => {
  const t = (clamp(Number(v ?? NaN), lo, hi) - lo) / (hi - lo || 1);
  return -130 + 260 * t;
};

function chipClass(verdict = "Neutral") {
  const v = String(verdict).toLowerCase();
  if (v.startsWith("bullish")) return "chip-bullish";
  if (v.startsWith("bearish")) return "chip-bearish";
  if (v.includes("risk-on"))  return "chip-risk-on";
  if (v.includes("risk-off")) return "chip-risk-off";
  return "chip-neutral";
}
function barColor(score = 50) {
  const s = Number(score);
  if (s >= 65) return "#22c55e"; // green
  if (s >= 50) return "#84cc16"; // lime
  if (s >  35) return "#f59e0b"; // amber
  return "#ef4444";              // red
}

// thresholds for mini dials
// Water: warn >225°F, danger >235°F
// Oil:   warn <40 psi, danger <30 psi
// Fuel:  warn <35%,   danger <20%
function statusFor(label, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "readout";
  if (label === "WATER") {
    if (v > 235) return "readout danger";
    if (v > 225) return "readout warn";
    return "readout ok";
  }
  if (label === "OIL") {
    if (v < 30) return "readout danger";
    if (v < 40) return "readout warn";
    return "readout ok";
  }
  if (label === "FUEL") {
    if (v < 20) return "readout danger";
    if (v < 35) return "readout warn";
    return "readout ok";
  }
  return "readout";
}

const Panel = ({ title, children, className = "" }) => (
  <div className={`panel ${className}`}>
    {title ? (
      <div className="panel-head">
        <div className="panel-title">{title}</div>
      </div>
    ) : null}
    {children}
  </div>
);

const Pill = ({ label, state = "off", icon = "" }) => (
  <span className={`light ${state}`} aria-label={`${label}: ${state}`}>
    <span className="light-icon" role="img" aria-hidden>{icon}</span>
    <span className="light-text">{label}</span>
  </span>
);

export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);
  const ts = data?.meta?.ts || null;
  const color = freshnessColor(ts);

  // signals -> pills
  const s = data?.signals || {};
  const mapSig = (sig) =>
    !sig || !sig.active ? "off" :
    String(sig.severity || "info").toLowerCase() === "danger" ? "danger" :
    String(sig.severity || "").toLowerCase() === "warn" ? "warn" : "ok";

  // squeeze state -> pill color
  const squeeze = String(data?.odometers?.squeeze || "none");
  const squeezeState =
    squeeze === "firingDown" ? "danger" :
    squeeze === "firingUp"   ? "ok"     :
    squeeze === "on"         ? "warn"   : "off";

  const lights = [
    { label: "Breakout",       state: mapSig(s.sigBreakout),     icon: "📈" },
    { label: "Squeeze",        state: squeezeState,              icon: "⏳" },
    { label: "Overextended",   state: mapSig(s.sigOverheat),     icon: "🚀" },
    { label: "Distribution",   state: mapSig(s.sigDistribution), icon: "📉" },
    { label: "Divergence",     state: mapSig(s.sigDivergence),   icon: "↔️" },
    { label: "Risk Alert",     state: mapSig(s.sigOverheat),     icon: "⚡"  },
    { label: "Liquidity Weak", state: mapSig(s.sigLowLiquidity), icon: "💧" },
    { label: "Turbo",          state: mapSig(s.sigTurbo),        icon: "⚡"  },
  ];

  // Optional big-gauge state coloring from backend
  const stateB = data?.lights?.breadth  || "neutral";
  const stateM = data?.lights?.momentum || "neutral";

  return (
    <div className="cluster">
      {/* Header */}
      <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ferrari Trading Cluster</div>
          <div className="small muted">Live from /api/dashboard</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="build-chip">BUILD R8.4</span>

          <div className="tag" style={{ border:`1px solid ${color}`, display:"flex", gap:8, alignItems:"center", borderRadius:8, padding:"4px 8px" }}>
            <span style={{ width:8, height:8, borderRadius:999, background:color, boxShadow:`0 0 8px ${color}` }}/>
            <span className="small">{ts ? `Updated ${timeAgo(ts)}` : "—"}</span>
          </div>

          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading && !data ? <div className="panel">Loading…</div> : null}
      {error                 ? <div className="panel">Error: {String(error)}</div> : null}
      {!data && !loading && !error ? <div className="panel">No data</div> : null}

      {data ? (
        <>
          {/* Gauges */}
          <Panel title="Gauges" className="carbon-fiber">
            <div className="cockpit-center">
              <div className="cockpit">
                {/* Left minis */}
                <div className="left-stack">
                  <MiniGauge label="WATER" value={data.gauges?.waterTemp} min={160} max={260} />
                  <MiniGauge label="OIL"   value={data.gauges?.oilPsi}    min={0}   max={120} />
                  <MiniGauge label="FUEL"  value={data.gauges?.fuelPct}   min={0}   max={100} />
                  <MiniGauge label="ALT"   value={null} />
                </div>

                {/* Center tach */}
                <div className="center-tach">
                  <BigGauge theme="tach"  label="RPM"   value={data.gauges?.rpm}   withLogo stateClass={`state-${stateB}`} />
                </div>

                {/* Right speedo */}
                <div className="right-speed">
                  <BigGauge theme="speed" label="SPEED" value={data.gauges?.speed} stateClass={`state-${stateM}`} />
                </div>
              </div>
            </div>
          </Panel>

          {/* Engine Lights */}
          <Panel title="Engine Lights">
            <div className="lights">
              {lights.map((L, i) => <Pill key={`${L.label}-${i}`} label={L.label} state={L.state} icon={L.icon} />)}
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
          {/* Market Summary */}
{/* Market Summary */}
{data.summary && (
  <Panel title="Market Summary">
    <div className="summary-row">
      {/* verdict chip */}
      <span className={`verdict ${chipClass(data.summary.verdict)}`}>
        {data.summary.verdict}
      </span>

      {/* 0–100 strength bar */}
      <div className="strength">
        <div
          className="strength-bar"
          style={{
            width: `${Math.max(0, Math.min(100, data.summary.score))}%`,
            background: barColor(data.summary.score)
          }}
          title={`score = ${data.summary.score}/100`}
        />
      </div>
      <span className="small muted">{data.summary.score}/100</span>
    </div>

    <div className="summary-bullets small muted">
      <span>
        Breadth: <b>{data.summary.breadthState}</b> ({data.summary.breadthIdx})
      </span>
      <span>
        Momentum: <b>{data.summary.momentumState}</b> ({data.summary.momentumIdx})
      </span>
      <span>
        Up breadth: <b>{data.summary.sectors.upBreadth}</b> / {data.summary.sectors.total}
      </span>
      <span>
        Up momentum: <b>{data.summary.sectors.upMomentum}</b> / {data.summary.sectors.total}
      </span>
    </div>
  </Panel>
)}

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
                  <div className="small muted">
                    NH: {c.counts?.nh ?? "—"} · NL: {c.counts?.nl ?? "—"} · 3U: {c.counts?.u ?? "—"} · 3D: {c.counts?.d ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

/* ---------- components ---------- */
function BigGauge({ theme = "tach", label, value = 0, withLogo = false, stateClass = "" }) {
  const t = (clamp(value, -1000, 1000) + 1000) / 2000;
  const angle = -130 + t * 260;
  const isTach = theme === "tach";
  const face = isTach ? "#ffdd00" : "#c21a1a";
  const showTicks = false; // hide ticks per your preference

  // Dark bezel to mask outer yellow on tach
  const rimMask = isTach ? (
    <div style={{ position:"absolute", inset:0, borderRadius:"50%", boxShadow:"inset 0 0 0 10px #0f172a", zIndex:1 }} aria-hidden />
  ) : null;

  return (
    <div className={`fg-wrap ${isTach ? "gauge--tach" : "gauge--speed"} ${stateClass}`}>
      <div className="gauge-face" style={{ background: face }}>
        {rimMask}
        <div className="ring" />

        {/* Numerals */}
        <svg className="dial-numerals" viewBox="0 0 200 200" aria-hidden>
          {(isTach
            ? Array.from({ length: 10 }, (_, i) => i + 1)
            : Array.from({ length: 11 }, (_, i) => (i + 1) * 20)
          ).map((num, idx, arr) => {
            const a = -120 + (idx / (arr.length - 1)) * 240;
            const r = 77, rad = (a - 90) * Math.PI / 180;
            const x = 100 + r * Math.cos(rad), y = 100 + r * Math.sin(rad);
            return (
              <text key={idx} x={x} y={y} className={`numeral ${isTach ? "tach" : "speed"}`} textAnchor="middle" dominantBaseline="central">
                {num}
              </text>
            );
          })}
        </svg>

        {/* Tach redline wedge */}
        {isTach ? <div className="redline-arc" aria-hidden /> : null}

        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub" />
        <div className="glass" />

        {/* Branding arcs */}
        {withLogo ? (
          <svg className="logo-ring" viewBox="0 0 220 220" aria-hidden>
            <defs>
              <path id="ringPath" d="M110,10 a100,100 0 1,1 0,200 a100,100 0 1,1 0,-200" />
              <path id="ringPathBottom" d="M110,210 a100,100 0 1,1 0,-200 a100,100 0 1,1 0,200" />
            </defs>
            <text className="logo-top">
              <textPath href="#ringPath" startOffset="50%" textAnchor="middle">REDLINE TRADING</textPath>
            </text>
            <text className="logo-bottom">
              <textPath href="#ringPathBottom" startOffset="50%">POWERED BY AI</textPath>
            </text>
          </svg>
        ) : null}
      </div>
      <div className="fg-title">{label}</div>
    </div>
  );
}

/* Mini gauge: clean dial + colored rim + readout below (warn/danger + pulse on danger) */
function MiniGauge({ label, value, min = 0, max = 100 }) {
  const hasVal = Number.isFinite(Number(value));
  const deg = hasVal ? mapToDeg(value, min, max) : 0;
  const readoutCls = statusFor(label, value);            // readout, readout ok|warn|danger
  const faceCls    = `mini-face ${readoutCls.replace("readout", "gauge")}`;

  const txt =
    label === "FUEL"  ? `${hasVal ? Math.round(value) : "—"} %`  :
    label === "OIL"   ? `${hasVal ? Math.round(value) : "—"} psi`:
    label === "WATER" ? `${hasVal ? Math.round(value) : "—"}°F`  :
                        (hasVal ? Math.round(value) : "—");

  return (
    <div className="mini">
      <div className={faceCls}>
        <div className="mini-needle" style={{ transform: `rotate(${deg}deg)` }} />
        <div className="mini-hub" />
      </div>
      <div className={readoutCls}>{txt}</div>
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

/* Inline sparkline component */
function Spark({ values = [] }) {
  if (!values || values.length < 2) return <div className="sector-spark">(no data)</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const W = 180, H = 36;
  const norm = v => (max - min ? (v - min) / (max - min) : 0.5);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - 8) + 4;
    const y = (1 - norm(v)) * (H - 8) + 4;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <polyline className="spark-line" fill="none" strokeWidth="2" points={pts} />
    </svg>
  );
}
