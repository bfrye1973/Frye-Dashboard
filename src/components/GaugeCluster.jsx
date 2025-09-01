// src/components/GaugeCluster.jsx
import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toDeg = (v, inMin, inMax, degMin = -130, degMax = 130) => {
  const t = (clamp(v, inMin, inMax) - inMin) / (inMax - inMin || 1);
  return degMin + t * (degMax - degMin);
};

function Card({ className = "", children }) {
  return <div className={`card ${className}`}>{children}</div>;
}

/* ---------- big gauges (tach / speed) ---------- */
function BigGauge({ label, value, vmin, vmax, accent = "var(--accent)" }) {
  const deg = toDeg(value ?? 0, vmin, vmax, -130, 130);
  return (
    <Card className="big-gauge">
      <div className="gauge-label">{label}</div>
      <div className="gauge-wrap">
        <svg viewBox="0 0 200 200" className="gauge-svg">
          <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="12" />
          {Array.from({ length: 13 }).map((_, i) => {
            const a = (-130 + i * (260 / 12)) * (Math.PI / 180);
            const x1 = 100 + 78 * Math.cos(a), y1 = 100 + 78 * Math.sin(a);
            const x2 = 100 + 92 * Math.cos(a), y2 = 100 + 92 * Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,.5)" strokeWidth="3" />;
          })}
        </svg>
        <div className="needle" style={{ transform: `translate(-50%,-100%) rotate(${deg}deg)`, background: accent }} />
        <div className="hub" />
      </div>
      <div className="gauge-value">{value ?? "—"}</div>
    </Card>
  );
}

/* ---------- mini gauges ---------- */
function MiniGauge({ label, value = 0, min = 0, max = 100, unit = "" }) {
  const pct = clamp((value - min) / (max - min || 1), 0, 1);
  const deg = -130 + pct * 260;
  return (
    <Card className="mini-gauge">
      <div className="gauge-label">{label}</div>
      <div className="gauge-wrap small">
        <svg viewBox="0 0 200 200" className="gauge-svg">
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="12" />
        </svg>
        <div className="needle" style={{ transform: `translate(-50%,-100%) rotate(${deg}deg)` }} />
        <div className="hub small" />
      </div>
      <div className="mini-value">{Math.round(value)}{unit}</div>
    </Card>
  );
}

/* ---------- stat / pill ---------- */
function StatBox({ label, value }) {
  return (
    <Card className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? "—"}</div>
    </Card>
  );
}
function SignalPill({ label, active, severity = "info" }) {
  const cls = !active
    ? "pill off"
    : severity === "danger" ? "pill danger"
    : severity === "warn"   ? "pill warn"
    : "pill ok";
  return <span className={cls}>{label} {active ? "●" : "○"}</span>;
}

/* ---------- main ---------- */
export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);

  if (loading) return <Card className="loading">Loading dashboard…</Card>;
  if (error || !data) {
    return (
      <Card className="error">
        <div className="err-title">Error</div>
        <div className="err-msg">{error || "No data"}</div>
        <button className="btn" onClick={refresh}>Retry</button>
      </Card>
    );
  }

  const { gauges = {}, odometers = {}, signals = {}, outlook = {}, meta = {} } = data;

  const rpmVal = clamp(Number(gauges.rpm ?? 0), -1000, 1000);
  const spdVal = clamp(Number(gauges.speed ?? 0), -1000, 1000);
  const fuel   = clamp(Number(gauges.fuelPct ?? 50), 0, 100);
  const water  = clamp(Number(gauges.waterTemp ?? 200), 160, 260);
  const oil    = clamp(Number(gauges.oilPsi ?? 70), 0, 120);

  return (
    <div className="cluster">
      <div className="cluster-head">
        <div className="title">Ferrari Cluster — Live</div>
        <div className="ts">ts: {meta.ts || "—"}</div>
      </div>

      {/* Big gauges */}
      <div className="grid two">
        <BigGauge label="RPM"   value={rpmVal} vmin={-1000} vmax={1000} accent="#ffd43b" />
        <BigGauge label="Speed" value={spdVal} vmin={-1000} vmax={1000} accent="#ff4d4f" />
      </div>

      {/* Mini gauges */}
      <div className="grid three">
        <MiniGauge label="Fuel %"   value={fuel}  min={0}   max={100} unit="%" />
        <MiniGauge label="Water °F" value={water} min={160} max={260} unit="°F" />
        <MiniGauge label="Oil PSI"  value={oil}   min={0}   max={120} unit="" />
      </div>

      {/* Odometers */}
      <div className="grid three">
        <StatBox label="Breadth Odometer"  value={odometers.breadthOdometer} />
        <StatBox label="Momentum Odometer" value={odometers.momentumOdometer} />
        <StatBox label="Squeeze"           value={String(odometers.squeeze || "none")} />
      </div>

      {/* Signals */}
      <div className="signals">
        <div className="section-label">Engine Lights</div>
        <div className="pill-row">
          {[
            ["sigBreakout", "Breakout"],
            ["sigDistribution", "Distribution"],
            ["sigTurbo", "Turbo"],
            ["sigCompression", "Compression"],
            ["sigExpansion", "Expansion"],
            ["sigDivergence", "Divergence"],
            ["sigOverheat", "Overheat"],
            ["sigLowLiquidity", "Low Liquidity"]
          ].map(([k, label]) => {
            const s = signals[k] || {};
            return <SignalPill key={k} label={label} active={!!s.active} severity={s.severity || "info"} />;
          })}
        </div>
      </div>

      {/* Sectors */}
      <div className="sectors">
        <div className="section-label">Sectors</div>
        <div className="grid three">
          {(outlook.sectorCards || []).map((c, i) => (
            <Card key={i}>
              <div className="card-row">
                <div className="sector">{c.sector}</div>
                <div className="outlook">{c.outlook}</div>
              </div>
              <div className="spark">spark: {Array.isArray(c.spark) ? c.spark.join(", ") : "—"}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
