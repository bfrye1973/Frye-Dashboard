// src/components/GaugeCluster.jsx
import React, { useMemo } from "react";
import { useDashboardPoll } from "../lib/dashboardApi";
import "./GaugeCluster.css"; // optional: only if you want to split some styles

/* ---------- helpers ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const map1000ToAngle = (x) => {
  // maps [-1000..1000] -> [-130..+130] degrees
  const t = clamp((x + 1000) / 2000, 0, 1);
  return -130 + t * 260;
};
const fmt = (n) => (n ?? n === 0 ? n.toLocaleString() : "—");

/* Traffic-light freshness for last updated pill */
function freshness(tsISO) {
  try {
    const ts = new Date(tsISO).getTime();
    const ageSec = (Date.now() - ts) / 1000;
    if (ageSec < 15 * 60) return { text: "Fresh", tone: "ok" };         // <15m
    if (ageSec < 60 * 60) return { text: "Warming", tone: "warn" };     // 15–60m
    return { text: "Stale", tone: "danger" };                           // >60m
  } catch {
    return { text: "Unknown", tone: "warn" };
  }
}

/* Small sparkline from an array of numbers */
function Sparkline({ data = [], width = 120, height = 28 }) {
  if (!data || data.length < 2) {
    return <div className="muted">no data</div>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const d = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/* Capsule tag */
function Tag({ tone = "info", children }) {
  const cls = {
    info: "tag tag-info",
    ok: "tag tag-ok",
    warn: "tag tag-warn",
    danger: "tag tag-danger",
  }[tone] || "tag tag-info";
  return <span className={cls}>{children}</span>;
}

/* Engine light pill */
function Light({ label, active, severity = "info" }) {
  if (!active) return null;
  const cls =
    severity === "danger"
      ? "light light-danger"
      : severity === "warn"
      ? "light light-warn"
      : "light light-ok";
  return <div className={cls}>{label}</div>;
}

/* Big Gauge (needle over a circular face) - simple SVG */
function BigGauge({ title, value1000 = 0, face = "yellow" }) {
  const angle = map1000ToAngle(value1000);
  const w = 280;
  const h = 280;
  const cx = w / 2,
    cy = h / 2,
    r = 110;

  const faceFill =
    face === "red"
      ? "radial-gradient(circle at 45% 40%, #ff6b6b, #b91c1c 65%, #1f2937 100%)"
      : "radial-gradient(circle at 45% 40%, #ffe685, #f59e0b 65%, #1f2937 100%)";

  return (
    <div className="gauge-wrap">
      <div className="gauge-face" style={{ background: faceFill }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* outer ring */}
          <circle cx={cx} cy={cy} r={r + 26} fill="url(#cf)" />
          <circle cx={cx} cy={cy} r={r + 22} fill="url(#bezel)" />
          {/* perimeter ring under ticks */}
          <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#ef4444" strokeWidth="8" />
          {/* ticks (every 10°, heavy every 30°) */}
          {Array.from({ length: 27 }).map((_, i) => {
            const a = -130 + i * 10;
            const rad = ((a - 90) * Math.PI) / 180;
            const inner = r - (a % 30 === 0 ? 18 : 10);
            const x1 = cx + (r + 2) * Math.cos(rad);
            const y1 = cy + (r + 2) * Math.sin(rad);
            const x2 = cx + inner * Math.cos(rad);
            const y2 = cy + inner * Math.sin(rad);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#111"
                strokeWidth={a % 30 === 0 ? 4 : 2}
                opacity={0.9}
              />
            );
          })}
          {/* needle */}
          <g transform={`rotate(${angle} ${cx} ${cy})`}>
            <rect
              x={cx - 6}
              y={cy - 2}
              width={r + 18}
              height={4}
              fill="#fff"
              rx="2"
              ry="2"
              style={{ filter: "drop-shadow(0 0 4px #000)" }}
            />
          </g>
          {/* hub */}
          <circle cx={cx} cy={cy} r={10} fill="#111" stroke="#aaa" strokeWidth="3" />
        </svg>
      </div>
      <div className="gauge-title">{title}</div>
    </div>
  );
}

/* Mini round gauge with text value */
function MiniGauge({ title, value, unit }) {
  return (
    <div className="mini">
      <div className="mini-face">
        <div className="mini-value">
          {fmt(value)} {unit}
        </div>
      </div>
      <div className="mini-title">{title}</div>
    </div>
  );
}

/* ---------- Main component ---------- */
export default function GaugeCluster() {
  const { data, loading, error, refresh, lastFetchAt } = useDashboardPoll(5000);

  const metaTs = data?.meta?.ts;
  const fresh = freshness(metaTs);

  const sigs = data?.signals || {};
  const listSignals = useMemo(() => {
    const order = [
      ["sigBreakout", "Breakout"],
      ["sigExpansion", "Expansion"],
      ["sigCompression", "Compression"],
      ["sigTurbo", "Turbo"],
      ["sigDistribution", "Distribution"],
      ["sigDivergence", "Divergence"],
      ["sigOverheat", "Overheat"],
      ["sigLowLiquidity", "Low Liquidity"],
    ];
    return order
      .map(([key, label]) => {
        const s = sigs[key];
        return s ? { label, active: !!s.active, severity: s.severity || "info" } : null;
      })
      .filter(Boolean);
  }, [sigs]);

  if (error) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Ferrari Cluster</div>
          <div className="spacer" />
          <Tag tone="danger">Load failed</Tag>
          <button className="btn" onClick={refresh}>Retry</button>
        </div>
        <div className="pad">Error: {String(error)}</div>
      </div>
    );
  }

  return (
    <div className="cluster">
      {/* Header */}
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Ferrari Trading Cluster</div>
          <div className="spacer" />
          <Tag tone={fresh.tone}>{fresh.text}</Tag>
          <div className="muted small" style={{ marginLeft: 8 }}>
            {metaTs ? new Date(metaTs).toLocaleString() : "—"}
          </div>
          <button className="btn" onClick={refresh} disabled={loading} style={{ marginLeft: 8 }}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Gauges row */}
        <div className="row">
          <div className="col col-left">
            <MiniGauge title="Fuel" value={data?.gauges?.fuelPct} unit="%" />
            <MiniGauge title="Water" value={data?.gauges?.waterTemp} unit="°F" />
            <MiniGauge title="Oil" value={data?.gauges?.oilPsi} unit="PSI" />
          </div>

          <div className="col col-center">
            <BigGauge
              title="RPM"
              face="yellow"
              value1000={data?.gauges?.rpm ?? 0}
            />
          </div>

          <div className="col col-right">
            <BigGauge
              title="Speed"
              face="red"
              value1000={data?.gauges?.speed ?? 0}
            />
          </div>
        </div>

        {/* Odometers */}
        <div className="row odos">
          <div className="odo">
            <div className="odo-label">Breadth</div>
            <div className="odo-value">{fmt(data?.odometers?.breadthOdometer)}</div>
          </div>
          <div className="odo">
            <div className="odo-label">Momentum</div>
            <div className="odo-value">{fmt(data?.odometers?.momentumOdometer)}</div>
          </div>
          <div className="odo">
            <div className="odo-label">Squeeze</div>
            <div className="odo-value">{data?.odometers?.squeeze ?? "—"}</div>
          </div>
        </div>

        {/* Engine Lights */}
        <div className="row lights">
          {listSignals.length === 0 && <div className="muted">No active signals</div>}
          {listSignals.map((s, i) => (
            <Light key={i} label={s.label} active={s.active} severity={s.severity} />
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Sectors</div>
        </div>
        <div className="sectors-grid">
          {(data?.outlook?.sectorCards ?? []).map((c, i) => (
            <div key={i} className="sector-card">
              <div className="sector-head">
                <div className="sector-name">{c.sector}</div>
                <Tag
                  tone={
                    c.outlook === "Bullish"
                      ? "ok"
                      : c.outlook === "Bearish"
                      ? "danger"
                      : "info"
                  }
                >
                  {c.outlook}
                </Tag>
              </div>
              <div className="sector-spark">
                <Sparkline data={c.spark} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="muted small" style={{ textAlign: "right" }}>
        Last fetch: {lastFetchAt ? new Date(lastFetchAt).toLocaleTimeString() : "—"}
      </div>
    </div>
  );
}
