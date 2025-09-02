// src/components/GaugeCluster.jsx
// Ferrari Dashboard — R8.4: EXACT TICKS (10 majors aligned to numerals, 4 minors between)
// Centered cockpit + engine lights preserved

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

const Pill = ({ label, state = "off", icon = "" }) => (
  <span className={`light ${state}`} aria-label={`${label}: ${state}`}>
    <span className="light-icon" role="img" aria-hidden>{icon}</span>
    <span className="light-text">{label}</span>
  </span>
);

/* ---------- main ---------- */
export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);
  const ts = data?.meta?.ts || null;
  const color = freshnessColor(ts);

  const s = data?.signals || {};
  const mapSig = (sig) =>
    !sig || !sig.active ? "off" :
    String(sig.severity || "info").toLowerCase() === "danger" ? "danger" :
    String(sig.severity).toLowerCase() === "warn" ? "warn" : "ok";

  const squeeze = String(data?.odometers?.squeeze || "none");
  const squeezeState =
    squeeze === "firingDown" ? "danger" :
    squeeze === "firingUp"   ? "ok"     :
    squeeze === "on"         ? "warn"   : "off";

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
      {/* Header with build chip to prove deploy */}
      <div className="panel" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:700}}>Ferrari Trading Cluster</div>
          <div className="small muted">Live from /api/dashboard</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span className="build-chip">BUILD R8.4</span>
          <div className="tag" style={{border:`1px solid ${color}`,display:"flex",gap:8,alignItems:"center",borderRadius:8,padding:"4px 8px"}}>
            <span style={{width:8,height:8,borderRadius:999,background:color,boxShadow:`0 0 8px ${color}`}}/>
            <span className="small">{ts ? `Updated ${timeAgo(ts)}` : "—"}</span>
          </div>
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading && !data ? <div className="panel">Loading…</div> : null}
      {error ? <div className="panel">Error: {String(error)}</div> : null}
      {!data && !loading && !error ? <div className="panel">No data</div> : null}

      {data ? (
        <>
          <Panel title="Gauges" className="carbon-fiber">
            <div className="cockpit-center">
              <div className="cockpit">
                {/* Left 2×2 minis */}
                <div className="left-stack">
                  <MiniGauge label="WATER" value={data.gauges?.waterTemp} unit="°F" />
                  <MiniGauge label="OIL"   value={data.gauges?.oilPsi}    unit="psi" />
                  <MiniGauge label="FUEL"  value={data.gauges?.fuelPct}   unit="%" />
                  <MiniGauge label="ALT"   value="—" />
                </div>

                {/* Center tach (yellow) with branding arcs */}
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

          <Panel title="Engine Lights">
            <div className="lights">
              {lights.map((L, i) => (
                <Pill key={`${L.label}-${i}`} label={L.label} state={L.state} icon={L.icon} />
              ))}
            </div>
          </Panel>

          <Panel title="Odometers">
            <div className="odos">
              <Odometer label="Breadth"  value={data.odometers?.breadthOdometer} />
              <Odometer label="Momentum" value={data.odometers?.momentumOdometer} />
              <Odometer label="Squeeze"  value={String(data.odometers?.squeeze ?? "—")} />
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
  const t = (clamp(value, -1000, 1000) + 1000) / 2000;     // 0..1
  const angle = -130 + t * 260;                            // -130..+130

  const isTach = theme === "tach";
  const face = isTach ? "#ffdd00" : "#c21a1a";

  // ===== TICK GEOMETRY (shared by all gauges) =====
  // Sweep = -120..+120 (240°). 10 majors aligned to numerals (k=0..9).
  const MAJOR_COUNT = 10;
  const SWEEP_START = -120;
  const SWEEP_END = 120;
  const SWEEP = SWEEP_END - SWEEP_START;                   // 240
  const MAJOR_STEP = SWEEP / (MAJOR_COUNT - 1);            // 240/9
  // Build major angles
  const majorAngles = Array.from({ length: MAJOR_COUNT }, (_, k) => SWEEP_START + k * MAJOR_STEP);
  // Insert 4 minors between each adjacent pair of majors (no minors on the majors)
  const allTicks = [];
  for (let k = 0; k < MAJOR_COUNT; k++) {
    allTicks.push({ angle: majorAngles[k], major: true });
    if (k < MAJOR_COUNT - 1) {
      const start = majorAngles[k];
      const step = MAJOR_STEP / 5;                         // 5 equal segments -> 4 minors in-between
      for (let j = 1; j <= 4; j++) {
        allTicks.push({ angle: start + j * step, major: false });
      }
    }
  }
  // ==> total ticks = 10 majors + (9 gaps * 4 minors) = 46

  // ===== Numerals =====
  const tachNums = Array.from({ length: 10 }, (_, i) => i + 1);         // 1..10
  const speedNums = Array.from({ length: 10 }, (_, i) => (i + 1) * 20); // 20..200 (10 numerals to match 10 majors)
  // Polar positions (SVG 200x200)
  const numeralRadius = 77;
  const numeralAngle = (idx, total) => SWEEP_START + (idx / (total - 1)) * SWEEP; // align with majors
  const toXY = (deg) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: 100 + numeralRadius * Math.cos(rad), y: 100 + numeralRadius * Math.sin(rad) };
  };

  return (
    <div className={`fg-wrap ${isTach ? "gauge--tach" : "gauge--speed"}`}>
      <div className="gauge-face" style={{ background: face }}>
        {/* 18px perimeter ring */}
        <div className="ring" />

        {/* Ticks: 46 total (10 majors + 36 minors) */}
        <div className="ticks">
          {allTicks.map((tk, i) => (
            <Tick key={i} angle={tk.angle} major={tk.major} />
          ))}
        </div>

        {/* Tach redline wedge on right side */}
        {isTach ? <div className="redline-arc" aria-hidden /> : null}

        {/* Numerals (aligned to majors) */}
        <svg className="dial-numerals" viewBox="0 0 200 200" aria-hidden>
          {(isTach ? tachNums : speedNums).map((num, idx, arr) => {
            const a = numeralAngle(idx, arr.length);
            const { x, y } = toXY(a);
            return (
              <text key={idx} x={x} y={y}
                className={`numeral ${isTach ? "tach" : "speed"}`}
                textAnchor="middle" dominantBaseline="central">
                {num}
              </text>
            );
          })}
        </svg>

        {/* Needle & hub & glass */}
        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub" />
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
      className={`tick ${major ? "major" : ""}`}
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
