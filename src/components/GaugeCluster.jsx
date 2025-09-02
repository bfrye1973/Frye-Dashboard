// src/components/GaugeCluster.jsx
// Ferrari Dashboard — R8: Ferrari tach/speedo numerals + redline arc + centered cockpit

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
    {title ? (
      <div className="panel-head">
        <div className="panel-title">{title}</div>
      </div>
    ) : null}
    {children}
  </div>
);

/* ---------- engine-light pill (kept as-is) ---------- */
const Pill = ({ label, state = "off", icon = "" }) => (
  <span className={`light ${state}`} aria-label={`${label}: ${state}`}>
    <span className="light-icon" role="img" aria-hidden>
      {icon}
    </span>
    <span className="light-text">{label}</span>
  </span>
);

/* ---------- main ---------- */
export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);
  const ts = data?.meta?.ts || null;
  const color = freshnessColor(ts);

  // Signal → light mapping (unchanged)
  const s = data?.signals || {};
  const squeeze = String(data?.odometers?.squeeze || "none");
  const mapSig = (sig) => (!sig || !sig.active) ? "off" : (String(sig.severity || "info").toLowerCase() === "danger" ? "danger" : String(sig.severity).toLowerCase() === "warn" ? "warn" : "ok");
  const squeezeState = squeeze === "firingDown" ? "danger" : squeeze === "firingUp" ? "ok" : squeeze === "on" ? "warn" : "off";
  const lights = [
    { label: "Breakout",       state: mapSig(s.sigBreakout),      icon: "📈" },
    { label: "Squeeze",        state: squeezeState,               icon: "⏳" },
    { label: "Overextended",   state: mapSig(s.sigOverheat),      icon: "🚀" },
    { label: "Distribution",   state: mapSig(s.sigDistribution),  icon: "📉" },
    { label: "Divergence",     state: mapSig(s.sigDivergence),    icon: "↔️" },
    { label: "Risk Alert",     state: mapSig(s.sigOverheat),      icon: "⚡" },
    { label: "Liquidity Weak", state: mapSig(s.sigLowLiquidity),  icon: "💧" },
    { label: "Turbo",          state: mapSig(s.sigTurbo),         icon: "⚡" },
    { label: "News",           state: "off",                      icon: "📰" },
    { label: "Earnings",       state: "off",                      icon: "📊" },
    { label: "Halt",           state: "off",                      icon: "⛔" },
    { label: "Circuit",        state: "off",                      icon: "🛑" },
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
          <div className="tag" style={{border:`1px solid ${color}`,display:"flex",gap:8,alignItems:"center",borderRadius:8,padding:"4px 8px"}}>
            <span style={{width:8,height:8,borderRadius:999,background:color,boxShadow:`0 0 8px ${color}`}}/>
            <span className="small">{ts ? `Updated ${timeAgo(ts)}` : "—"}</span>
          </div>
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && !data ? <div className="panel">Loading…</div> : null}
      {error ? <div className="panel">Error: {String(error)}</div> : null}
      {!data && !loading && !error ? <div className="panel">No data</div> : null}

      {data ? (
        <>
          {/* Cockpit */}
          <Panel title="Gauges" className="carbon-fiber">
            <div className="cockpit-center">
              <div className="cockpit">
                {/* Left minis */}
                <div className="left-stack">
                  <MiniGauge label="WATER" value={data.gauges?.waterTemp} unit="°F" />
                  <MiniGauge label="OIL"   value={data.gauges?.oilPsi}    unit="psi" />
                  <MiniGauge label="FUEL"  value={data.gauges?.fuelPct}   unit="%" />
                  <MiniGauge label="ALT"   value="—" />
                </div>

                {/* Center tach with branding arcs */}
                <div className="center-tach">
                  <BigGauge theme="tach"  label="RPM"   value={data.gauges?.rpm}   withLogo />
                </div>

                {/* Right speedo */}
                <div className="right-speed">
                  <BigGauge theme="speed" label="SPEED" value={data.gauges?.speed} />
                </div>
              </div>
            </div>
          </Panel>

          {/* Engine lights strip (unchanged behavior) */}
          <Panel title="Engine Lights">
            <div className="lights">
              {lights.map((L, i) => (
                <Pill key={`${L.label}-${i}`} label={L.label} state={L.state} icon={L.icon} />
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
      ) : null}
    </div>
  );
}

/* ---------- components ---------- */

function BigGauge({ theme = "tach", label, value = 0, withLogo = false }) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const t = (clamp(value, -1000, 1000) + 1000) / 2000; // 0..1
  const angle = -130 + t * 260; // -130..+130
  const isTach = theme === "tach";
  const face = isTach ? "#ffdd00" : "#c21a1a";

  // Numerals layout
  // Tach: 1..10 across -120..+120 (skip 0)
  const tachNums = Array.from({ length: 10 }, (_, i) => i + 1);
  // Speedo: 20..220 step 20 across -120..+120
  const speedNums = Array.from({ length: 11 }, (_, i) => (i + 1) * 20);

  // Helper for polar text positions within SVG (center 100,100; radius ~74–78)
  const numeralRadius = 78;
  const angleForIndex = (idx, total) => -120 + (idx / (total - 1)) * 240; // degrees
  const toXY = (deg) => {
    const rad = (deg - 90) * Math.PI / 180; // SVG 0° is at 12 o'clock
    const x = 100 + numeralRadius * Math.cos(rad);
    const y = 100 + numeralRadius * Math.sin(rad);
    return { x, y };
  };

  return (
    <div className={`fg-wrap ${isTach ? "gauge--tach" : "gauge--speed"}`}>
      <div className="gauge-face" style={{ background: face }}>
        {/* 18px ring */}
        <div className="ring" />

        {/* White ticks */}
        <div className="ticks">
          {Array.from({ length: 41 }, (_, i) => {
            const a = -120 + (i / 40) * 240;
            const major = i % 5 === 0;
            return <Tick key={i} angle={a} major={major} />;
          })}
        </div>

        {/* Tach redline arc (rightmost ~20% of sweep) */}
        {isTach ? <div className="redline-arc" aria-hidden /> : null}

        {/* Numerals (SVG overlay inside the face) */}
        <svg className="dial-numerals" viewBox="0 0 200 200" aria-hidden>
          {(isTach ? tachNums : speedNums).map((num, idx, arr) => {
            const a = angleForIndex(idx, arr.length);
            const { x, y } = toXY(a);
            return (
              <text key={idx} x={x} y={y} className={`numeral ${isTach ? "tach" : "speed"}`} textAnchor="middle" dominantBaseline="central">
                {num}
              </text>
            );
          })}
        </svg>

        {/* Needle & hub */}
        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub" />

        {/* Glass */}
        <div className="glass" />

        {/* Branding arcs outside bezel (tach only) */}
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
              <textPath href="#ringPathBottom" startOffset="50%" textAnchor="middle">POWERED BY AI</textPath>
            </text>
          </svg>
        ) : null}
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

function Spark({ values = [] }) {
  if (!values || values.length < 2) return <div className="sector-spark">(no data)</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const W = 180, H = 36;
  const norm = (v) => (max - min ? (v - min) / (max - min) : 0.5);
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
