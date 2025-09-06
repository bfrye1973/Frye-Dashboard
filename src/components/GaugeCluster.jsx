// src/components/GaugeCluster.jsx
// Ferrari Dashboard — R9.1 (labels clarified, no movement)
// - Big dials: RPM (Breadth), SPEED (Momentum)
// - Minis: WATER (Volatility °F), OIL (Liquidity PSI), FUEL (Squeeze Pressure % + PSI), ALT (Breadth Trend)
// - Gauges panel ~380px tall; global soft-cap (max-height:520) via public/index.html

import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mapToDeg = (v, lo, hi) =>
  -130 + 260 * ((clamp(Number(v ?? NaN), lo, hi) - lo) / (hi - lo || 1));

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

// minis: thresholds -> status class
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
  if (s >= 65) return "#22c55e";
  if (s >= 50) return "#84cc16";
  if (s > 35)  return "#f59e0b";
  return "#ef4444";
}

/* ---------- chrome ---------- */
const Panel = ({ title, children, className = "", style }) => (
  <div className={`panel ${className}`} style={style}>
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
  const summary = data?.summary || null;

  // Big gauge angles (prefer summary; fallback to raw)
  const breadthIdx  = summary?.breadthIdx;
  const momentumIdx = summary?.momentumIdx;
  const rpmAngle   = Number.isFinite(breadthIdx)  ? mapToDeg(breadthIdx,  0, 100) : mapToDeg(data?.gauges?.rpm,   -1000, 1000);
  const speedAngle = Number.isFinite(momentumIdx) ? mapToDeg(momentumIdx, 0, 100) : mapToDeg(data?.gauges?.speed, -1000, 1000);

  // Ring token colors
  const stateB = data?.lights?.breadth  || "neutral";
  const stateM = data?.lights?.momentum || "neutral";

  // signals row
  const s = data?.signals || {};
  const mapSig = sig =>
    !sig || !sig.active ? "off" :
    String(sig.severity || "info").toLowerCase() === "danger" ? "danger" :
    String(sig.severity || "").toLowerCase() === "warn" ? "warn" : "ok";

  const lightsRow = [
    { label: "Breakout",       state: mapSig(s.sigBreakout),     icon: "📈" },
    { label: "Squeeze",        state: mapSig(s.sigOverheat),     icon: "⏳" },
    { label: "Overextended",   state: mapSig(s.sigOverextended), icon: "🚀" },
    { label: "Distribution",   state: mapSig(s.sigDistribution), icon: "📉" },
    { label: "Divergence",     state: mapSig(s.sigDivergence),   icon: "↔️" },
    { label: "Risk Alert",     state: mapSig(s.sigOverheat),     icon: "⚡"  },
    { label: "Liquidity Weak", state: mapSig(s.sigLowLiquidity), icon: "💧" },
    { label: "Turbo",          state: mapSig(s.sigTurbo),        icon: "⚡"  },
  ];

  return (
    <div className="cluster">
      {/* Header */}
      <div className="panel" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ferrari Trading Cluster</div>
          <div className="small muted">Live from /api/dashboard</div>
        </div>

        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span className="build-chip">BUILD R9.1</span>
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
          {/* Gauges (labels clarified, layout unchanged) */}
          <Panel
            title="Gauges"
            className="carbon-fiber"
            style={{ height: 380, maxHeight: 520, overflow: "hidden" }}
          >
            {/* Legend (plain-English mapping) */}
            <div className="small muted" style={{ display:"flex", gap:16, padding:"0 8px 8px 8px", flexWrap:"wrap" }}>
              <span><b>RPM</b> → <b>Breadth</b> (yellow dial)</span>
              <span><b>SPEED</b> → <b>Momentum</b> (red dial)</span>
              <span><b>WATER</b> → <b>Volatility</b> (°F)</span>
              <span><b>OIL</b> → <b>Liquidity</b> (PSI)</span>
              <span><b>FUEL</b> → <b>Squeeze Pressure</b> (% + PSI)</span>
              <span><b>ALT</b> → <b>Breadth Trend</b></span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "300px 1fr 300px", // left minis / center tach / right speed
                gap: 18,
                alignItems: "center",
                height: "calc(100% - 20px)",  // leave room for legend
              }}
            >
              {/* LEFT minis (single column as you have now; we can 2×2 later if you want) */}
              <div className="left-stack" style={{ display:"grid", rowGap:10, alignContent:"start", justifyItems:"start" }}>
                <MiniGauge label="WATER" caption="Volatility (°F)" value={data.gauges?.waterTemp} min={160} max={260} scale={1.0} />
                <MiniGauge label="OIL"   caption="Liquidity (PSI)" value={data.gauges?.oilPsi}    min={0}   max={120} scale={1.0} />
                <MiniGauge label="FUEL"  caption="Squeeze Pressure (% + PSI)" value={data.gauges?.fuelPct}   min={0} max={100} scale={1.0} extra={<div className="mini-psi">PSI {Number.isFinite(Number(data.gauges?.fuelPct)) ? Math.round(data.gauges.fuelPct) : "—"}</div>} />
                <MiniGauge label="ALT"   caption="Altimeter (Breadth Trend)"  value={0}                    min={-100} max={100} scale={1.0} />
              </div>

              {/* CENTER: Yellow tach (Breadth) */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                <BigGauge
                  theme="tach"
                  label="RPM (Breadth)"
                  title="Breadth Index (RPM)"
                  angle={rpmAngle}
                  withLogo
                  stateClass={`state-${stateB}`}
                  scale={0.98}
                />
              </div>

              {/* RIGHT: Red speedo (Momentum) */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                <BigGauge
                  theme="speed"
                  label="SPEED (Momentum)"
                  title="Momentum Index (SPEED)"
                  angle={speedAngle}
                  stateClass={`state-${stateM}`}
                  scale={0.98}
                />
              </div>
            </div>
          </Panel>

          {/* Engine Lights */}
          <Panel title="Engine Lights">
            <div className="lights">
              {[
                { label: "Breakout", icon: "📈" },
                { label: "Squeeze",  icon: "⏳" },
                { label: "Overextended", icon: "🚀" },
                { label: "Distribution", icon: "📉" },
                { label: "Divergence", icon: "↔️" },
                { label: "Risk Alert", icon: "⚡" },
                { label: "Liquidity Weak", icon: "💧" },
                { label: "Turbo", icon: "⚡" },
              ].map((L, i) => (
                <Pill key={`${L.label}-${i}`} label={L.label} state="off" icon={L.icon} />
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

          {/* Market Summary */}
          {summary && (
            <Panel title="Market Summary">
              <div className="summary-row">
                <span className={`verdict ${chipClass(summary.verdict)}`}>{summary.verdict}</span>
                <div className="strength">
                  <div className="strength-bar" style={{ width: `${Math.max(0, Math.min(100, summary.score))}%`, background: barColor(summary.score) }} />
                </div>
                <span className="small muted">{summary.score}/100</span>
              </div>
              <div className="summary-bullets small muted">
                <span>Breadth: <b>{summary.breadthState}</b> ({summary.breadthIdx})</span>
                <span>Momentum: <b>{summary.momentumState}</b> ({summary.momentumIdx})</span>
                <span>Up breadth: <b>{summary.sectors.upBreadth}</b> / {summary.sectors.total}</span>
                <span>Up momentum: <b>{summary.sectors.upMomentum}</b> / {summary.sectors.total}</span>
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
function BigGauge({ theme = "tach", label, title, angle = 0, withLogo = false, stateClass = "", scale = 0.98 }) {
  const isTach = theme === "tach";
  const face = isTach ? "#ffdd00" : "#c21a1a";

  return (
    <div
      className={`fg-wrap ${isTach ? "gauge--tach" : "gauge--speed"} ${stateClass}`}
      style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
      title={title || label}
      aria-label={title || label}
    >
      <div className="gauge-face" style={{ background: face }}>
        <div className="ring" />
        {/* numerals */}
        <svg className="dial-numerals" viewBox="0 0 200 200" aria-hidden>
          {(isTach ? Array.from({ length: 10 }, (_, i) => i + 1)
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
        <div className="needle" style={{ transform:`rotate(${angle}deg)`, transition:"transform .35s ease-out" }} />
        <div className="hub" />
        <div className="glass" />
      </div>
      <div className="fg-title">{label}</div>
    </div>
  );
}

function MiniGauge({ label, caption, value, min = 0, max = 100, scale = 1.0, extra = null }) {
  const hasVal = Number.isFinite(Number(value));
  const deg = hasVal ? mapToDeg(value, min, max) : 0;
  const readoutCls = statusFor(label, value);
  const faceCls = `mini-face ${readoutCls.replace("readout", "gauge")}`;
  const txt =
    label === "FUEL"  ? `${hasVal ? Math.round(value) : "—"} %`  :
    label === "OIL"   ? `${hasVal ? Math.round(value) : "—"} psi`:
    label === "WATER" ? `${hasVal ? Math.round(value) : "—"}°F`  :
                        (hasVal ? Math.round(value) : "—");
  return (
    <div className="mini" style={{ transform:`scale(${scale})`, transformOrigin:"left top" }} title={caption || label} aria-label={caption || label}>
      <div className={faceCls}>
        <div className="mini-needle" style={{ transform:`rotate(${deg}deg)` }} />
        <div className="mini-hub" />
      </div>
      <div className="readout-row" style={{ textAlign:"center" }}>
        <div className={readoutCls}>{txt}</div>
        {extra}
        <div className="mini-title" style={{ opacity:.85 }}>
          {label} {caption ? <span className="small muted" style={{ marginLeft:6 }}>({caption})</span> : null}
        </div>
      </div>
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
