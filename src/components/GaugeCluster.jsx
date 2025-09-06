// GaugeCluster.jsx — center big dials, minis on the sides
import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

// --- dumb mini gauge (uses your CSS .mini*, numeric readout underneath)
function MiniGauge({ title, readout, unit, angle = 0 }) {
  return (
    <div className="mini">
      <div className="mini-face">
        <div className="mini-needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="mini-hub" />
      </div>
      <div className="readout">
        {readout}{unit ? unit : ""}
      </div>
      <div className="mini-title">{title}</div>
    </div>
  );
}

// --- big gauge (yellow/red)
function BigGauge({ kind="tach", title, faceColor, angle=0 }) {
  return (
    <div className={`fg-wrap gauge--${kind} state-neutral`}>
      <div className="gauge-face" style={{ background: faceColor }}>
        <div className="ring" />
        <svg className="dial-numerals" viewBox="0 0 100 100" aria-hidden>
          {/* keep your numerals implementation here (or leave blank) */}
        </svg>
        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub" />
        <div className="glass" />
      </div>
      <div className="fg-title">{title}</div>
    </div>
  );
}

export default function GaugeCluster() {
  const { data } = useDashboardPoll(5000);
  const g = data?.gauges || {};
  const summary = data?.summary || {};

  // angles are examples; keep your existing mapping fns
  const rpmAngle    = (summary.breadthIdx ?? 0) * 1.8;   // 0..100 -> 0..180°
  const speedAngle  = (summary.momentumIdx ?? 0) * 1.8;

  const waterAngle  = Math.min(220, Math.max(-40, (g.waterTemp ?? 190) - 200)); // fake map
  const oilAngle    = Math.min(220, Math.max(-40, (g.oilPsi ?? 60) - 60));
  const fuelAngle   = Math.min(220, Math.max(-40, (g.fuelPct ?? 50) - 50));
  const altAngle    = 0; // placeholder for trend

  return (
    <section className="cluster panel" data-cluster-host>
      {/* Top bar: compact summary (left) */}
      <div className="cockpit-header">
        <div className="summary-compact">
          <div className="verdict">{summary.verdict ?? "—"}</div>
          <div className="score-bar">
            <div className="score-fill" style={{ width: `${summary.score ?? 0}%` }} />
          </div>
          <div className="bullets">
            <span>Breadth: {summary.breadthIdx ?? "—"}</span>
            <span>Momentum: {summary.momentumIdx ?? "—"}</span>
          </div>
        </div>
      </div>

      {/* NEW: 4-column grid → [mini stack] [big yellow] [big red] [mini stack] */}
      <div className="cockpit-center four-col-center">
        {/* LEFT mini stack */}
        <div className="mini-stack">
          <MiniGauge title="WATER (Volatility °F)" readout={g.waterTemp ?? "—"} unit="°F" angle={waterAngle} />
          <MiniGauge title="FUEL (Squeeze % / PSI)" readout={`${g.fuelPct ?? "—"}%`} angle={fuelAngle} />
        </div>

        {/* BIG — Yellow RPM/Breadth */}
        <div className="big-wrap">
          <BigGauge kind="tach" title="RPM (Breadth)" faceColor="rgb(255,221,0)" angle={rpmAngle} />
        </div>

        {/* BIG — Red SPEED/Momentum */}
        <div className="big-wrap">
          <BigGauge kind="speed" title="SPEED (Momentum)" faceColor="rgb(220,40,40)" angle={speedAngle} />
        </div>

        {/* RIGHT mini stack */}
        <div className="mini-stack">
          <MiniGauge title="OIL (Liquidity PSI)" readout={g.oilPsi ?? "—"} unit=" PSI" angle={oilAngle} />
          <MiniGauge title="ALT (Breadth Trend)" readout="" angle={altAngle} />
        </div>
      </div>
    </section>
  );
}
