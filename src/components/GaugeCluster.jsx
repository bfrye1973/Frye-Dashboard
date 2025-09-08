// src/components/GaugeCluster.jsx
// Ferrari Dashboard — R9.1 (3-region cockpit, lastGood fallback, default export)
// Left: compact Market Summary (InfoStack)
// Middle: ALL GAUGES (2×2 minis + yellow RPM (Breadth) + red SPEED (Momentum) side-by-side, centered tight)
// Right: reserved (hidden for now)
// Engine Lights: pills restored (state by severity)
// Gauges panel ~380px; soft-cap (≤520px) handled in public/index.html

import React, { useEffect, useState } from "react";
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

/* Basic pill for engine lights */
const Pill = ({ label, state = "off", icon = "" }) => (
  <span className={`light ${state}`} aria-label={`${label}: ${state}`} style={{display:"inline-flex", gap:6, alignItems:"center", marginRight:10}}>
    <span role="img" aria-hidden>{icon}</span>
    <span>{label}</span>
  </span>
);

/* ---------- compact card (left InfoStack) ---------- */
function MarketSummaryCard({ summary }) {
  if (!summary) return <div className="small muted">(no summary)</div>;
  return (
    <div style={cardBox}>
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
        <span className={`verdict ${chipClass(summary.verdict)}`} style={{fontWeight:700}}>
          {summary.verdict}
        </span>
        <span className="small muted">score {summary.score}/100</span>
      </div>
      <div style={barWrap}>
        <div style={{...barFill, width: `${Math.max(0, Math.min(100, summary.score))}%`, background: barColor(summary.score)}} />
      </div>
      <div className="small muted" style={{display:"grid", gap:4, marginTop:8}}>
        <span>Breadth: <b>{summary.breadthState}</b> ({summary.breadthIdx})</span>
        <span>Momentum: <b>{summary.momentumState}</b> ({summary.momentumIdx})</span>
      </div>
    </div>
  );
}

/* ---------- DEFAULT EXPORT ---------- */
export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);

  // Keep last good payload so gauges don't vanish on temporary 500s
  const [lastGood, setLastGood] = useState(null);
  useEffect(() => { if (data) setLastGood(data); }, [data]);

  const working = data || lastGood || null;

  // Header freshness timestamp
  const ts = working?.meta?.ts || null;
  const freshness = freshnessColor(ts);

  // Summary & odometers/lights/gauges
  const summary    = working?.summary || {};
  const odometers  = working?.odometers || {};
  const gauges     = working?.gauges || {};
  const lights     = working?.signals || {};

  // Big gauges — prefer summary; fallback to raw
  const breadthIdx  = summary?.breadthIdx;
  const momentumIdx = summary?.momentumIdx;
  const rpmAngle   = Number.isFinite(breadthIdx)
    ? mapToDeg(breadthIdx, 0, 100)
    : mapToDeg(gauges?.rpm,   -1000, 1000);
  const speedAngle = Number.isFinite(momentumIdx)
    ? mapToDeg(momentumIdx, 0, 100)
    : mapToDeg(gauges?.speed, -1000, 1000);

  // Engine-lights mapping
  const mapSig = (sig) => {
    if (!sig || !sig.active) return "off";
    const sev = String(sig.severity || "").toLowerCase();
    if (sev === "danger") return "danger";
    if (sev === "warn")   return "warn";
    return "ok";
  };

  return (
    <div className="cluster">
      {/* Header */}
      <div className="panel" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ferrari Trading Cluster</div>
          <div className="small muted">Live from /api/dashboard</div>
          {error ? <div className="small text-danger" style={{marginTop:6}}>Error: {String(error?.message || error)}</div> : null}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span className="build-chip">BUILD R9.1</span>
          <div className="tag" style={{ border:`1px solid ${freshness}`, display:"flex", gap:8, alignItems:"center", borderRadius:8, padding:"4px 8px" }}>
            <span style={{ width:8, height:8, borderRadius:999, background:freshness, boxShadow:`0 0 8px ${freshness}` }}/>
            <span className="small">{ts ? `Updated ${timeAgo(ts)}` : "—"}</span>
          </div>
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* If never received a good payload yet, show a small placeholder */}
      {!working ? (
        <Panel title="Gauges" className="carbon-fiber" style={{ height: 280, maxHeight: 520 }}>
          <div style={{display:"grid", placeItems:"center", height:"100%", color:"#93a3b8"}}>
            (Waiting for data…)
          </div>
        </Panel>
      ) : (
        <>
          {/* COCKPIT ROW: Left InfoStack / Middle GaugesCenter / Right Reserved */}
          <Panel
            title="Gauges — RPM = Breadth (yellow), SPEED = Momentum (red), WATER = Volatility (°F), OIL = Liquidity (PSI), FUEL = Squeeze Pressure (% + PSI), ALT = Breadth Trend"
            className="carbon-fiber"
            style={{ height: 380, maxHeight: 520, overflow: "hidden" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "380px 1fr 340px",
                gap: 18,
                alignItems: "center",
                justifyItems: "center",
                justifyContent: "center",  // centers the entire row
                height: "100%",
              }}
            >
              {/* LEFT: InfoStack (compact Market Summary) */}
              <div style={{ width: "100%", alignSelf: "stretch" }}>
                <MarketSummaryCard summary={summary} />
              </div>

              {/* MIDDLE: ALL Gauges (2×2 minis + RPM/SPEED pair) */}
              <div style={{ width: "100%", height: "100%", display:"grid", gridTemplateRows: "1fr 1fr", alignItems:"center" }}>
                {/* Row 1 : 2×2 minis */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    justifyItems: "center",
                    alignItems: "center",
                  }}
                >
                  <MiniGauge label="WATER" caption="Volatility (°F)"      value={gauges?.waterTemp} min={160} max={260} />
                  <MiniGauge label="OIL"   caption="Liquidity (PSI)"      value={gauges?.oilPsi}    min={0}   max={120} />
                  <MiniGauge label="FUEL"  caption="Squeeze Pressure"     value={gauges?.fuelPct}   min={0}   max={100}
                    extra={<div className="mini-psi">PSI {Number.isFinite(Number(gauges?.fuelPct)) ? Math.round(gauges?.fuelPct) : "—"}</div>} />
                  <MiniGauge label="ALT"   caption="Breadth Trend (ALT)"  value={0}                   min={-100} max={100} />
                </div>

                {/* Row 2 : RPM + SPEED pair (tight & centered) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 28,
                    alignItems: "center",
                    justifyItems: "center",
                    maxWidth: 560,     // keeps the pair tight
                    margin: "0 auto",  // centers as a block
                    width: "100%",
                  }}
                >
                  <BigGauge
                    theme="tach"
                    label="RPM (Breadth)"
                    title="Breadth Index (RPM)"
                    angle={rpmAngle}
                    withLogo
                    stateClass={`state-${(working?.lights?.breadth || "neutral")}`}
                    scale={0.96}
                  />
                  <BigGauge
                    theme="speed"
                    label="SPEED (Momentum)"
                    title="Momentum Index (SPEED)"
                    angle={speedAngle}
                    stateClass={`state-${(working?.lights?.momentum || "neutral")}`}
                    scale={0.96}
                  />
                </div>
              </div>

              {/* RIGHT: Reserved (hidden for now) */}
              <div style={{ display:"none" }} />
            </div>
          </Panel>

          {/* ===== Engine Lights (restored) ===== */}
          <Panel title="Engine Lights">
            <div style={{display:"flex", flexWrap:"wrap", gap:10}}>
              {[
                { key: "sigBreakout",      label: "Breakout",       icon: "📈" },
                { key: "sigOverheat",      label: "Squeeze",        icon: "⏳" },
                { key: "sigOverextended",  label: "Overextended",   icon: "🚀" },
                { key: "sigDistribution",  label: "Distribution",   icon: "📉" },
                { key: "sigDivergence",    label: "Divergence",     icon: "↔️" },
                { key: "sigRiskAlert",     label: "Risk Alert",     icon: "⚡" },
                { key: "sigLowLiquidity",  label: "Liquidity Weak", icon: "💧" },
                { key: "sigTurbo",         label: "Turbo",          icon: "⚡" },
              ].map((it) => (
                <Pill
                  key={it.key}
                  label={it.label}
                  icon={it.icon}
                  state={mapSig(lights?.[it.key])}
                />
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/* ---------- gauge components ---------- */
function BigGauge({ theme = "tach", label, title, angle = 0, withLogo = false, stateClass = "", scale = 0.96 }) {
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
  const txt =
    label === "FUEL"  ? `${hasVal ? Math.round(value) : "—"} %`  :
    label === "OIL"   ? `${hasVal ? Math.round(value) : "—"} psi`:
    label === "WATER" ? `${hasVal ? Math.round(value) : "—"}°F`  :
                        (hasVal ? Math.round(value) : "—");
  return (
    <div className="mini" style={{ transform:`scale(${scale})`, transformOrigin:"center" }} title={caption || label} aria-label={caption || label}>
      <div className="mini-face">
        <div className="mini-needle" style={{ transform:`rotate(${deg}deg)` }} />
        <div className="mini-hub" />
      </div>
      <div className="readout-row" style={{ textAlign:"center" }}>
        <div className="readout">{txt}</div>
        {extra}
        <div className="mini-title" style={{ opacity:.85 }}>
          {label} {caption ? <span className="small muted" style={{ marginLeft:6 }}>({caption})</span> : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- small widgets ---------- */
const cardBox = {
  border: "1px solid #1f2a44",
  borderRadius: 12,
  padding: 12,
  background: "#0e1526",
};
const barWrap = {
  position: "relative",
  height: 10,
  background: "#0b1220",
  border: "1px solid #334155",
  borderRadius: 6,
  overflow: "hidden",
};
const barFill = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  borderRadius: 6,
};
