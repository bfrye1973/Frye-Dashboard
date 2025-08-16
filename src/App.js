// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";

/** ---------- Config ---------- */
const API_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

/** Map backend metrics to the 4 gauges.
 *  Feel free to re-map as you like once data is flowing.
 *  value must be 0..100
 */
function mapMetricsToGauges(m) {
  // Example: compute simple scores from payload. Replace with your real logic.
  // Fallbacks keep the UI alive even if fields are missing.
  const sectors = m?.sectors ?? [];
  const highs = sectors.reduce((a, s) => a + (s?.newHighs ?? 0), 0);
  const lows = sectors.reduce((a, s) => a + (s?.newLows ?? 0), 0);
  const adrAvg =
    sectors.length > 0
      ? sectors.reduce((a, s) => a + (s?.adrAvg ?? 1), 0) / sectors.length
      : 1;

  // Momentum: crude high-minus-low ratio scaled to 0..100
  const momentum = clamp01((highs - lows + 50) / 100) * 100;

  // Breadth: % advancers (highs vs highs+lows)
  const breadth = clamp01(highs / Math.max(highs + lows, 1)) * 100;

  // Volatility: scale ADR average (1.0 ~ normal). >1 hot, <1 calm
  const volatility = clamp01((adrAvg - 0.8) / (2.2 - 0.8)) * 100;

  // Liquidity proxy: weight highs + lows (activity). You can replace with money-flow.
  const liquidity = clamp01((highs + lows) / 60) * 100;

  return {
    momentum: Math.round(momentum),
    breadth: Math.round(breadth),
    volatility: Math.round(volatility),
    liquidity: Math.round(liquidity),
  };
}

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** ---------- Reusable SVG Gauge ---------- */
function Gauge({
  value = 0, // 0..100
  label = "Gauge",
  size = 220,
  redlineStart = 75, // % where red arc begins
  theme = "dark", // "dark" | "yellow" (logo gauge)
  showTicks = true,
  centerBrand = null, // optional node in center
  sublabel = null, // optional secondary label inside
}) {
  const radius = size / 2;
  const thickness = Math.max(12, size * 0.075);

  // Gauge arc angles (Ferrari-ish sweep)
  const startDeg = -135;
  const endDeg = 135;

  // Needle angle
  const angle = useMemo(() => {
    const t = clamp01(value / 100);
    return startDeg + t * (endDeg - startDeg);
  }, [value]);

  // Build ticks
  const ticks = useMemo(() => {
    if (!showTicks) return [];
    const arr = [];
    const majorEvery = 10;
    for (let v = 0; v <= 100; v += 5) {
      const a = ((startDeg + (v / 100) * (endDeg - startDeg)) * Math.PI) / 180;
      const isMajor = v % majorEvery === 0;
      const r1 = radius - thickness * (isMajor ? 1.2 : 1.05);
      const r2 = radius - thickness * 0.55;
      arr.push({
        x1: radius + r1 * Math.cos(a),
        y1: radius + r1 * Math.sin(a),
        x2: radius + r2 * Math.cos(a),
        y2: radius + r2 * Math.sin(a),
        v,
        isMajor,
      });
    }
    return arr;
  }, [radius, thickness]);

  // Colors
  const yellowFace = theme === "yellow";
  const faceColor = yellowFace ? "#F7D21B" : "url(#carbonWeave)";
  const tickColor = yellowFace ? "#1a1a1a" : "#e8e8e8";
  const textColor = yellowFace ? "#1a1a1a" : "#eaeaea";
  const ringColor = yellowFace ? "#c5ab15" : "#888";

  // Redline arc geometry
  const redStart = startDeg + clamp01(redlineStart / 100) * (endDeg - startDeg);

  return (
    <div className="gaugeWrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* defs: carbon weave */}
        <defs>
          <pattern id="carbonWeave" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#0e0f13" />
            <path d="M0,8 L8,0 M-2,6 L2,10 M6,-2 L10,2" stroke="#14161d" strokeWidth="2" />
            <path d="M0,0 L8,8 M-2,2 L2,-2 M6,10 L10,6" stroke="#1a1d26" strokeWidth="2" />
          </pattern>
        </defs>

        {/* outer ring */}
        <circle
          cx={radius}
          cy={radius}
          r={radius - thickness * 0.25}
          fill={faceColor}
          stroke={ringColor}
          strokeWidth={Math.max(2, thickness * 0.14)}
        />

        {/* redline arc */}
        <Arc
          cx={radius}
          cy={radius}
          r={radius - thickness * 0.35}
          startDeg={redStart}
          endDeg={endDeg}
          stroke="#e01e37"
          strokeWidth={thickness * 0.35}
          rounded
        />

        {/* ticks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={tickColor}
            strokeWidth={t.isMajor ? 2 : 1}
            opacity={0.9}
          />
        ))}

        {/* '0' marker in black when yellow face */}
        {yellowFace && (
          <text
            x={radius + (radius - thickness * 0.9) * Math.cos((startDeg * Math.PI) / 180)}
            y={radius + (radius - thickness * 0.9) * Math.sin((startDeg * Math.PI) / 180)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#101010"
            fontWeight="700"
            fontSize={size * 0.1}
          >
            0
          </text>
        )}

        {/* Label */}
        <text
          x={radius}
          y={radius + size * 0.33}
          textAnchor="middle"
          fill={textColor}
          fontWeight="600"
          fontSize={Math.max(12, size * 0.09)}
          style={{ letterSpacing: 0.5 }}
        >
          {label}
        </text>

        {/* Sub-label (optional) */}
        {sublabel && (
          <text
            x={radius}
            y={radius + size * 0.42}
            textAnchor="middle"
            fill={textColor}
            fontSize={Math.max(10, size * 0.06)}
            opacity={0.8}
          >
            {sublabel}
          </text>
        )}

        {/* value text */}
        <text
          x={radius}
          y={radius + size * 0.08}
          textAnchor="middle"
          fill={textColor}
          fontWeight="800"
          fontSize={Math.max(14, size * 0.18)}
        >
          {Math.round(value)}%
        </text>

        {/* needle */}
        <Needle
          cx={radius}
          cy={radius}
          r={radius - thickness * 0.6}
          angleDeg={angle}
          hubColor={yellowFace ? "#1a1a1a" : "#e6e6e6"}
        />

        {/* center brand node */}
        {centerBrand}
      </svg>
    </div>
  );
}

function Arc({
  cx,
  cy,
  r,
  startDeg,
  endDeg,
  stroke = "#e01e37",
  strokeWidth = 12,
  rounded = false,
}) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={rounded ? "round" : "butt"}
    />
  );
}
function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function Needle({ cx, cy, r, angleDeg, hubColor = "#ddd" }) {
  const a = (angleDeg * Math.PI) / 180;
  const x = cx + r * Math.cos(a);
  const y = cy + r * Math.sin(a);
  return (
    <>
      <line
        x1={cx}
        y1={cy}
        x2={x}
        y2={y}
        stroke="#ff2d2d"
        strokeWidth="5"
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          transition: "transform 450ms cubic-bezier(.2,.9,.2,1)",
        }}
      />
      <circle cx={cx} cy={cy} r={10} fill={hubColor} stroke="#555" />
    </>
  );
}

/** ---------- Logo Gauge (Yellow, Branded) ---------- */
function LogoGauge({ value }) {
  return (
    <Gauge
      value={value}
      label="Momentum"
      size={260}
      theme="yellow"
      redlineStart={78}
      showTicks
      centerBrand={
        <g>
          {/* REDLINE (top) */}
          <text
            x="50%"
            y="22%"
            textAnchor="middle"
            fill="#E01E37"
            fontWeight="900"
            style={{ fontSize: "24px", letterSpacing: "1px" }}
          >
            REDLINE
          </text>

          {/* TRADING (bottom center) */}
          <text
            x="50%"
            y="60%"
            textAnchor="middle"
            fill="#E01E37"
            fontWeight="900"
            style={{ fontSize: "20px", letterSpacing: "1px" }}
          >
            TRADING
          </text>

          {/* Powered By AI (curved-ish baseline) */}
          <text
            x="50%"
            y="72%"
            textAnchor="middle"
            fill="#ffffff"
            fontWeight="700"
            style={{ fontSize: "12px", letterSpacing: ".6px" }}
          >
            Powered By AI
          </text>
        </g>
      }
    />
  );
}

/** ---------- Check Lights (bottom LEDs) ---------- */
function CheckLights({ lights }) {
  // lights: [{id, label, on, color}]
  return (
    <div className="lightsRow">
      {lights.map((l) => (
        <div
          key={l.id}
          className={`light ${l.on ? "on" : ""}`}
          style={{ background: l.on ? l.color : "#1d2029" }}
          title={l.label}
        >
          <span>{l.icon ?? "●"}</span>
        </div>
      ))}
    </div>
  );
}

/** ---------- Panels ---------- */
function Panel({ title, children, right }) {
  return (
    <div className="panel">
      <div className="panelHead">
        <span className="panelTitle">{title}</span>
        {right ? <span className="panelRight">{right}</span> : null}
      </div>
      <div className="panelBody">{children}</div>
    </div>
  );
}

/** ---------- Main App ---------- */
export default function App() {
  const [online, setOnline] = useState(false);
  const [g, setG] = useState({
    momentum: 78,
    breadth: 42,
    volatility: 63,
    liquidity: 55,
  });

  async function load() {
    try {
      const r = await fetch(`${API_BASE}/api/market-metrics`);
      setOnline(r.ok);
      const data = r.ok ? await r.json() : null;
      if (data) setG(mapMetricsToGauges(data));
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const lights = [
    { id: "breakout", label: "Breakout Confirmed", on: g.momentum > 70, color: "#18c964", icon: "⤴" },
    { id: "overxtd", label: "Overextended", on: g.volatility > 80, color: "#ff5d5d", icon: "⚠" },
    { id: "squeeze", label: "Squeeze On", on: g.volatility < 25, color: "#ffd166", icon: "◉" },
    { id: "fup", label: "Follow-Through", on: g.breadth > 60, color: "#29c2ff", icon: "↗" },
    { id: "riskoff", label: "Risk-Off", on: g.liquidity < 30, color: "#b18fff", icon: "⛔" },
  ];

  return (
    <div className="app">
      <style>{styles}</style>

      {/* Online badge */}
      <div className={`badge ${online ? "ok" : "bad"}`}>
        Backend: {online ? "online" : "offline"}
      </div>

      {/* Header */}
      <header className="header">
        <div className="logoLine">
          <div className="logoAccent" />
          <div className="logoText">FRYE DASHBOARD</div>
        </div>
      </header>

      {/* Top Ferrari cluster */}
      <section className="cluster">
        <div className="clusterInner">
          <div className="gCol left">
            <Gauge label="Breadth" value={g.breadth} size={200} redlineStart={70} />
          </div>

          <div className="gCol center">
            <LogoGauge value={g.momentum} />
          </div>

          <div className="gCol right">
            <Gauge label="Volatility" value={g.volatility} size={200} redlineStart={65} />
            <Gauge label="Liquidity / Fuel" value={g.liquidity} size={160} redlineStart={30} />
          </div>
        </div>

        <CheckLights lights={lights} />
      </section>

      {/* Bottom panels */}
      <section className="grid">
        <Panel title="Wave 3 Scanner">
          <PlaceholderRows rows={6} />
        </Panel>

        <Panel title="Flagpole Breakouts">
          <PlaceholderRows rows={6} />
        </Panel>

        <Panel title="EMA Run (D/W)">
          <PlaceholderRows rows={6} />
        </Panel>

        <Panel
          title="Live Chart"
          right={<span className="chip">AAPL • 1m</span>}
        >
          <div className="chartStub">Chart goes here (Lightweight Charts)</div>
        </Panel>
      </section>
    </div>
  );
}

function PlaceholderRows({ rows = 5 }) {
  return (
    <div className="rows">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="row" key={i}>
          <div className="dot" />
          <div className="bar" />
          <div className="pill" />
        </div>
      ))}
    </div>
  );
}

/** ---------- CSS (injected) ---------- */
const styles = `
:root{
  --bg:#0b0f16;
  --panel:#0f1420;
  --panel2:#121827;
  --card:#121626;
  --text:#e8edf7;
  --muted:#aab3c5;
  --accent:#E01E37;
  --accent2:#F7D21B;
  --ok:#0f8a41;
  --bad:#8a1d1d;
}

*{box-sizing:border-box}
html,body,#root{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;}

/* online badge */
.badge{
  position:fixed;top:12px;left:12px;padding:6px 10px;border-radius:10px;
  font-weight:700;font-size:12px;background:#1b2232;border:1px solid #23314b;color:#fff;opacity:.95;z-index:9
}
.badge.ok{background:var(--ok)}
.badge.bad{background:var(--bad)}

/* header */
.header{padding:12px 20px 0}
.logoLine{display:flex;align-items:center;gap:14px}
.logoAccent{height:6px;flex:1;background:linear-gradient(90deg,var(--accent),#c71a2f 60%, #7a1424)}
.logoText{font-weight:900;font-size:26px;letter-spacing:2px;opacity:.92}

/* cluster (gauges) */
.cluster{padding:10px 18px 0}
.clusterInner{
  display:grid;grid-template-columns:1fr auto 1fr;gap:18px;
  background:radial-gradient(1200px 300px at 50% -20%, rgba(255,255,255,.04), transparent 60%),
            repeating-linear-gradient(45deg, #0e0f13, #0e0f13 12px, #10131a 12px, #10131a 24px);
  border:1px solid #222a3d;border-radius:18px;padding:16px 16px 6px;
}
.gCol.left, .gCol.center, .gCol.right{display:flex;align-items:center;justify-content:center;gap:16px}
.gCol.right{flex-direction:column}

.gaugeWrap{filter:drop-shadow(0 2px 10px rgba(0,0,0,.25))}
.lightsRow{
  display:flex;gap:8px;justify-content:center;margin:10px auto 6px;flex-wrap:wrap
}
.light{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:#fff;font-weight:900;border:1px solid #2c3144}
.light.on{box-shadow:0 0 12px rgba(255,255,255,.25)}

/* panels grid */
.grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:16px 18px 24px;
}
.grid>.panel:last-child{grid-column:1/-1}

.panel{
  background:linear-gradient(180deg,var(--panel),var(--panel2));
  border:1px solid #1f2637;border-radius:14px;overflow:hidden;min-height:220px;
}
.panelHead{
  display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px;
  border-bottom:1px solid #1f2637;background:linear-gradient(180deg,#0d1220,#0b101a)
}
.panelTitle{font-weight:800;letter-spacing:.4px}
.panelRight{opacity:.85}
.chip{background:#1b2232;border:1px solid #2b3650;border-radius:10px;padding:2px 8px;font-size:12px}

.panelBody{padding:10px 12px}

/* placeholders */
.rows{display:flex;flex-direction:column;gap:8px}
.row{display:grid;grid-template-columns:16px 1fr 54px;gap:10px;align-items:center}
.dot{width:10px;height:10px;border-radius:50%;background:#2b3246}
.bar{height:8px;background:linear-gradient(90deg,#243050,#2a3a61);border-radius:8px}
.pill{justify-self:end;background:#243050;border:1px solid #33416a;border-radius:10px;padding:2px 8px;font-size:12px;color:#c8d2ea}

.chartStub{
  height:250px;border:1px dashed #2a3653;border-radius:10px;
  display:grid;place-items:center;color:#9fb2df;background:repeating-linear-gradient(90deg,#0f1422,#0f1422 8px,#11182a 8px,#11182a 16px)
}

/* responsive */
@media (max-width: 1100px){
  .grid{grid-template-columns:1fr}
  .gCol.center{order:-1}
}
`;
