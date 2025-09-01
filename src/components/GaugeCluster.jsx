// src/components/GaugeCluster.jsx
import React, { useMemo } from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const map1000ToAngle = (x) => -130 + clamp((x + 1000) / 2000, 0, 1) * 260;
const fmt = (n) => (n ?? n === 0 ? n.toLocaleString() : "—");
const freshness = (tsISO) => {
  try {
    const ts = new Date(tsISO).getTime();
    const age = (Date.now() - ts) / 1000;
    if (age < 900) return { text: "Fresh", tone: "ok" };
    if (age < 3600) return { text: "Warming", tone: "warn" };
    return { text: "Stale", tone: "danger" };
  } catch { return { text: "Unknown", tone: "warn" }; }
};

function Tag({ tone = "info", children }) {
  const c = tone === "ok" ? "tag tag-ok" : tone === "warn" ? "tag tag-warn" : tone === "danger" ? "tag tag-danger" : "tag tag-info";
  return <span className={c}>{children}</span>;
}

/* ---------- Ferrari Big Gauge (SVG) ---------- */
function FerrariGauge({
  title = "RPM",
  face = "yellow",              // "yellow"|"red"
  value1000 = 0,                // -1000..+1000
  redlineStartDeg = 85,         // inner red band start (deg)
  redlineEndDeg = 130,          // inner red band end   (deg)
  showBezelTextTop,             // optional top arc text
  showBezelTextBottom,          // optional bottom arc text
  size = 320,
}) {
  const angle = map1000ToAngle(value1000);
  const W = size, H = size, cx = W / 2, cy = H / 2;
  const rFace = size * 0.40;
  const rBezel = rFace * 1.35;

  const faceFill = face === "red"
    ? "url(#faceRed)"
    : "url(#faceYellow)";

  const ticks = useMemo(() => {
    const arr = [];
    for (let a = -130; a <= 130; a += 10) {
      const heavy = a % 30 === 0;
      const rad = ((a - 90) * Math.PI) / 180;
      const r1 = rFace * 0.98;
      const r2 = rFace * (heavy ? 0.78 : 0.86);
      arr.push({
        x1: cx + r1 * Math.cos(rad),
        y1: cy + r1 * Math.sin(rad),
        x2: cx + r2 * Math.cos(rad),
        y2: cy + r2 * Math.sin(rad),
        heavy,
      });
    }
    return arr;
  }, [cx, cy, rFace]);

  const redlineArc = (() => {
    const a1 = redlineStartDeg, a2 = redlineEndDeg;
    const large = a2 - a1 > 180 ? 1 : 0;
    const toXY = (deg, r) => {
      const R = ((deg - 90) * Math.PI) / 180;
      return [cx + r * Math.cos(R), cy + r * Math.sin(R)];
    };
    const [x1, y1] = toXY(a1, rFace * 0.88);
    const [x2, y2] = toXY(a2, rFace * 0.88);
    return `M ${x1} ${y1} A ${rFace * 0.88} ${rFace * 0.88} 0 ${large} 1 ${x2} ${y2}`;
  })();

  return (
    <div className="fg-wrap" style={{ width: size }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <defs>
          {/* carbon fiber */}
          <pattern id="cf" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#0b1220" />
            <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#101826" strokeWidth="2" />
          </pattern>
          {/* bezel gradient */}
          <linearGradient id="bezelGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a4757" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          {/* faces */}
          <radialGradient id="faceYellow" cx="50%" cy="45%">
            <stop offset="0%" stopColor="#ffe261" />
            <stop offset="80%" stopColor="#f5b500" />
            <stop offset="100%" stopColor="#1f2937" />
          </radialGradient>
          <radialGradient id="faceRed" cx="50%" cy="45%">
            <stop offset="0%" stopColor="#ff6b6b" />
            <stop offset="80%" stopColor="#cf2a2a" />
            <stop offset="100%" stopColor="#1f2937" />
          </radialGradient>
          {/* glass highlight */}
          <radialGradient id="glass" cx="45%" cy="25%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="70%" stopColor="rgba(0,0,0,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.30)" />
          </radialGradient>
          {/* circular paths for bezel text */}
          <path id="arcTop" d={`M ${cx - rBezel} ${cy} A ${rBezel} ${rBezel} 0 0 1 ${cx + rBezel} ${cy}`} />
          <path id="arcBottom" d={`M ${cx + rBezel} ${cy + 1} A ${rBezel} ${rBezel} 0 0 1 ${cx - rBezel} ${cy + 1}`} />
        </defs>

        {/* carbon + bezel */}
        <circle cx={cx} cy={cy} r={rBezel + 10} fill="url(#cf)" />
        <circle cx={cx} cy={cy} r={rBezel} fill="url(#bezelGrad)" stroke="#0b1220" strokeWidth="2" />

        {/* face */}
        <circle cx={cx} cy={cy} r={rFace} fill={faceFill} stroke="#0b1220" strokeWidth="1" />

        {/* outer red perimeter ring under ticks */}
        <circle cx={cx} cy={cy} r={rFace * 0.98} fill="none" stroke="#ef4444" strokeWidth="10" />

        {/* ticks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="#111"
            strokeWidth={t.heavy ? 4 : 2}
            opacity="0.9"
          />
        ))}

        {/* redline inner band */}
        <path d={redlineArc} stroke="#b91c1c" strokeWidth="12" fill="none" strokeLinecap="round" />

        {/* needle */}
        <g transform={`rotate(${angle} ${cx} ${cy})`}>
          <rect x={cx - 6} y={cy - 2} width={rFace + 24} height="4" fill="#fff" rx="2" ry="2" />
        </g>
        {/* hub */}
        <circle cx={cx} cy={cy} r="11" fill="#111" stroke="#aaa" strokeWidth="3" />
        {/* glass */}
        <circle cx={cx} cy={cy} r={rFace} fill="url(#glass)" opacity="0.45" />

        {/* bezel text */}
        {showBezelTextTop && (
          <text fontSize="16" fontWeight="700" fill="#ff2d2d" letterSpacing="2">
            <textPath href="#arcTop" startOffset="50%" textAnchor="middle">
              REDLINE TRADING
            </textPath>
          </text>
        )}
        {showBezelTextBottom && (
          <text fontSize="14" fontWeight="700" fill="#ff2d2d" letterSpacing="1.5">
            <textPath href="#arcBottom" startOffset="50%" textAnchor="middle">
              POWERED BY AI
            </textPath>
          </text>
        )}
      </svg>
      <div className="fg-title">{title}</div>
    </div>
  );
}

/* ---------- Mini gauge ---------- */
function MiniGauge({ label, valueText }) {
  return (
    <div className="mini">
      <div className="mini-face">
        <div className="mini-value">{valueText}</div>
      </div>
      <div className="mini-title">{label}</div>
    </div>
  );
}

/* ---------- Sparkline for sectors ---------- */
function Sparkline({ data = [], width = 120, height = 28 }) {
  if (!data || data.length < 2) return <div className="muted">no data</div>;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const d = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * height;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/* ---------- Main ---------- */
export default function GaugeCluster() {
  const { data, loading, error, refresh, lastFetchAt } = useDashboardPoll(5000);
  const metaTs = data?.meta?.ts;
  const fresh = freshness(metaTs);

  const sigs = data?.signals || {};
  const signals = useMemo(() => {
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
    return order.map(([k, label]) => {
      const s = sigs[k]; if (!s?.active) return null;
      return { label, sev: s.severity || "info" };
    }).filter(Boolean);
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

        {/* Tight Ferrari layout */}
        <div className="cluster-row">
          {/* Left mini gauges */}
          <div className="left-stack">
            <MiniGauge label="Fuel"  valueText={`${fmt(data?.gauges?.fuelPct)} %`} />
            <MiniGauge label="Water" valueText={`${fmt(data?.gauges?.waterTemp)} °F`} />
            <MiniGauge label="Oil"   valueText={`${fmt(data?.gauges?.oilPsi)} PSI`} />
          </div>

          {/* Tach + Speedo tight center group */}
          <div className="center-pair">
            <FerrariGauge
              title="RPM"
              face="yellow"
              value1000={data?.gauges?.rpm ?? 0}
              showBezelTextTop
            />
            <FerrariGauge
              title="Speed"
              face="red"
              value1000={data?.gauges?.speed ?? 0}
              showBezelTextBottom
            />
          </div>
        </div>

        {/* Odometers */}
        <div className="row odos">
          <div className="odo"><div className="odo-label">Breadth</div><div className="odo-value">{fmt(data?.odometers?.breadthOdometer)}</div></div>
          <div className="odo"><div className="odo-label">Momentum</div><div className="odo-value">{fmt(data?.odometers?.momentumOdometer)}</div></div>
          <div className="odo"><div className="odo-label">Squeeze</div><div className="odo-value">{data?.odometers?.squeeze ?? "—"}</div></div>
        </div>

        {/* Engine lights row */}
        <div className="lights">
          {signals.length === 0 && <div className="muted">No active signals</div>}
          {signals.map((s, i) => (
            <div key={i} className={
              s.sev === "danger" ? "light light-danger" :
              s.sev === "warn"   ? "light light-warn"   :
                                   "light light-ok"
            }>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div className="panel">
        <div className="panel-head"><div className="panel-title">Sectors</div></div>
        <div className="sectors-grid">
          {(data?.outlook?.sectorCards ?? []).map((c, i) => (
            <div key={i} className="sector-card">
              <div className="sector-head">
                <div className="sector-name">{c.sector}</div>
                <Tag tone={c.outlook === "Bullish" ? "ok" : c.outlook === "Bearish" ? "danger" : "info"}>{c.outlook}</Tag>
              </div>
              <div className="sector-spark"><Sparkline data={c.spark} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="muted small" style={{ textAlign: "right" }}>
        Last fetch: {lastFetchAt ? new Date(lastFetchAt).toLocaleTimeString() : "—"}
      </div>
    </div>
  );
}
