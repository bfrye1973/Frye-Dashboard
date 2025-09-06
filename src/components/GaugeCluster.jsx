// GaugeCluster.jsx — Top row split into 3 regions: Left InfoStack, Center Big Pair, Right Reserved
import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* --- Big Gauge (face is colored by prop) --- */
function BigGauge({ title, faceColor, angle = 0, kind = "tach" }) {
  return (
    <div className={`fg-wrap gauge--${kind} state-neutral`}>
      <div className="gauge-face" style={{ background: faceColor }}>
        <div className="ring"></div>
        <svg className="dial-numerals" viewBox="0 0 100 100" aria-hidden />
        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub"></div>
        <div className="glass"></div>
      </div>
      <div className="fg-title">{title}</div>
    </div>
  );
}

export default function GaugeCluster() {
  const { data } = useDashboardPoll(5000);
  const summary = data?.summary || {};

  // Map 0–100 indices to ~0–180° sweep (adjust if you have helpers)
  const rpmAngle   = (summary.breadthIdx  ?? 0) * 1.8;
  const speedAngle = (summary.momentumIdx ?? 0) * 1.8;

  return (
    <section className="cluster panel" data-cluster-host>
      {/* === TOP COCKPIT ROW (3 REGIONS) === */}
      <div className="cockpit-row">
        {/* LEFT: InfoStack */}
        <div className="cockpit-left">
          <div className="summary-card">
            <div className="summary-title">Ferrari Trading Cluster</div>
            <div className="summary-sub">Live from /api/dashboard</div>
            <div className="verdict">{summary.verdict ?? "—"}</div>
            <div className="score-bar">
              <div className="score-fill" style={{ width: `${summary.score ?? 0}%` }} />
            </div>
            <ul className="bullets">
              <li>Breadth: {summary.breadthIdx ?? "—"}</li>
              <li>Momentum: {summary.momentumIdx ?? "—"}</li>
            </ul>
          </div>
        </div>

        {/* CENTER: Big Pair (yellow RPM + red SPEED) */}
        <div className="cockpit-center">
          <div className="big-pair">
            <BigGauge title="RPM (Breadth)"  faceColor="rgb(255,221,0)" angle={rpmAngle}   kind="tach"  />
            <BigGauge title="SPEED (Momentum)" faceColor="rgb(220,40,40)" angle={speedAngle} kind="speed" />
          </div>
        </div>

        {/* RIGHT: Reserved (kept for spacing; hidden content) */}
        <div className="cockpit-right" aria-hidden="true">
          <div className="reserved-placeholder">Reserved</div>
        </div>
      </div>
      {/* === /TOP ROW === */}
    </section>
  );
}
