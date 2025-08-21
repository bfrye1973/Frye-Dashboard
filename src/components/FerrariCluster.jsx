// src/components/FerrariCluster.jsx
// A carbon‑fiber Ferrari‑style cluster: Speed (Momentum), RPM (Breadth), Fuel (100-PSI)
// Usage:
//   <FerrariCluster momentum={m} breadth={b} psi={psi} lights={lights} logoUrl="/ferrari.png" />

import React from "react";

// ---------- helpers ----------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp  = (t, a, b) => a + t * (b - a);
const map   = (val, inMin, inMax, outMin, outMax) => {
  const t = (val - inMin) / (inMax - inMin || 1);
  return lerp(clamp(t, 0, 1), outMin, outMax);
};

// ---------- dial ----------
function Dial({
  label = "RPM",
  sub = "",
  value = 0, vmin = -1000, vmax = 1000,
  ringColor = "#f59e0b",  // strokes / highlights
  faceColor = "#fed12f",  // tach face color (Ferrari yellow)
  glassTint = "rgba(0,0,0,0.08)",
  centerText,
}) {
  // Gauge geometry
  const start = -120; // degrees
  const end   =  120;
  const angle = map(value, vmin, vmax, start, end);
  const cx = 100, cy = 100, r = 78;

  const rad = d => (d - 90) * Math.PI / 180;
  const p   = (a, rr) => [cx + rr * Math.cos(rad(a)), cy + rr * Math.sin(rad(a))];

  const handR  = 66;
  const [hx, hy] = p(angle, handR);

  // major ticks
  const ticks = [];
  const majorEvery = 30; // deg
  for (let a = start; a <= end; a += majorEvery) {
    const [x1,y1] = p(a, r-6);
    const [x2,y2] = p(a, r-16);
    ticks.push(<line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="2" opacity="0.8" />)
  }
  // minor ticks
  const minorEvery = 10;
  for (let a = start; a <= end; a += minorEvery) {
    if (a % majorEvery === 0) continue;
    const [x1,y1] = p(a, r-6);
    const [x2,y2] = p(a, r-12);
    ticks.push(<line key={"m"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="1" opacity="0.7" />)
  }

  // arc (inner ring)
  const arc = (a1, a2, color, width=8) => {
    const large = (a2 - a1) > 180 ? 1 : 0;
    const [x1,y1] = p(a1, r-2);
    const [x2,y2] = p(a2, r-2);
    return <path d={`M ${x1} ${y1} A ${r-2} ${r-2} 0 ${large} 1 ${x2} ${y2}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />
  };

  // digital readout
  const valStr = Math.round(value);

  return (
    <svg viewBox="0 0 200 200" style={{ width:"220px", height:"220px" }}>
      {/* carbon‑fiber weave */}
      <defs>
        <pattern id="cfiber" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2"/>
        </pattern>
        <radialGradient id="faceGradient" cx="50%" cy="45%">
          <stop offset="0%"  stopColor={faceColor} />
          <stop offset="85%" stopColor="#f5b500" />
          <stop offset="100%" stopColor="#0b1220" />
        </radialGradient>
        <linearGradient id="ringGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155"/>
          <stop offset="100%" stopColor="#0f172a"/>
        </linearGradient>
        <radialGradient id="glass" cx="40%" cy="25%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="70%" stopColor={glassTint} />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
      </defs>

      {/* outer ring */}
      <circle cx={cx} cy={cy} r={90} fill="url(#cfiber)" />
      <circle cx={cx} cy={cy} r={88} fill="url(#ringGradient)" stroke="#111827" strokeWidth="2" />

      {/* gauge face (tach style) */}
      <circle cx={cx} cy={cy} r={76} fill="url(#faceGradient)" stroke="#0b1220" strokeWidth="1" />

      {/* tick marks */}
      <g>{ticks}</g>

      {/* colored arc segments (blue then green) */}
      {arc(start, (start+end)/2, "#38bdf8", 8)}
      {arc((start+end)/2, end, "#22c55e", 8)}

      {/* needle */}
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke={ringColor} strokeWidth="5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6.5" fill="#e5e7eb" stroke="#111827" strokeWidth="1"/>

      {/* glossy glass */}
      <ellipse cx={cx} cy={cy-20} rx="70" ry="28" fill="url(#glass)" opacity="0.5" />

      {/* labels */}
      <text x={cx} y={cy+36} textAnchor="middle" fill="#cbd5e1" fontSize="12">{label}</text>
      <text x={cx} y={cy+54} textAnchor="middle" fill={ringColor} fontSize="14" fontWeight="600">
        {valStr}{sub}
      </text>
      {centerText ? <text x={cx} y={cy-6} textAnchor="middle" fill="#111827" fontSize="20" fontWeight="700">{centerText}</text> : null}
    </svg>
  );
}

// ---------- engine lights row ----------
const stateColors = { off:"#334155", info:"#38bdf8", warn:"#f59e0b", alert:"#ef4444", good:"#22c55e" };
const lightsMeta = {
  overheat:{label:"Overheat",icon:"🔥"}, turbo:{label:"Turbo",icon:"🟢"},
  lowoil:{label:"Low Oil",icon:"🟡"}, squeeze:{label:"Compression",icon:"🟡"},
  expansion:{label:"Expansion",icon:"🟢"}, dist:{label:"Distribution",icon:"⛔"},
  div:{label:"Divergence",icon:"⚠️"}, srwall:{label:"Break Wall",icon:"🧱"},
  breakout:{label:"Breakout",icon:"🚀"}
};

export default function FerrariCluster({
  logoUrl = "/ferrari.png",
  momentum = 0,               // -1000..+1000
  breadth  = 0,               // -1000..+1000 (or 0..1000 if you normalize)
  psi,                         // 0..100
  lights = {},                // from your computeEngineLights()
  onLightClick,
}) {
  const speedVal = clamp(momentum, -1000, 1000);
  const rpmVal   = clamp(breadth,  -1000, 1000);
  const fuelVal  = 100 - clamp(psi ?? 100, 0, 100); // empty when PSI high (compression)

  return (
    <div style={wrap}>
      {/* logo + badge */}
      <div style={left}>
        <img src={logoUrl} alt="Ferrari" style={{ height: 46, objectFit:"contain", filter:"drop-shadow(0 2px 2px rgba(0,0,0,0.5))" }} />
      </div>

      {/* three dials */}
      <div style={center}>
        <Dial label="Speed" value={speedVal} vmin={-1000} vmax={1000} ringColor="#ef4444" faceColor="#1f2937" />
        <Dial label="RPM"   value={rpmVal}   vmin={-1000} vmax={1000} ringColor="#f59e0b" faceColor="#fed12f" centerText="rpm×1000" />
        <Dial label="Fuel"  value={fuelVal}  vmin={0}     vmax={100}  ringColor="#22c55e" faceColor="#1f2937" sub="%" />
      </div>

      {/* engine lights */}
      <div style={lightsWrap}>
        {Object.entries(lightsMeta).map(([id, meta]) => {
          const s = lights[id]?.state || "off";
          const color = stateColors[s] || stateColors.off;
          return (
            <div key={id} style={{...pill, borderColor: color}} title={meta.label} onClick={()=>onLightClick?.(id)}>
              <span style={{ color, marginRight:6 }}>{meta.icon}</span>
              <span>{meta.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- styles ----------
const wrap = {
  display:"grid",
  gridTemplateColumns:"160px 1fr",
  gap: 12,
  alignItems:"center",
  padding:"10px 14px",
  border:"1px solid #1f2a44",
  borderRadius:12,
  background:"#0b1220",
  boxShadow:"inset 0 0 40px rgba(0,0,0,0.35)",
  margin:"8px 0 12px",
};
const left   = { display:"flex", alignItems:"center", justifyContent:"flex-start" };
const center = { display:"flex", alignItems:"center", justifyContent:"center", gap:28 };
const lightsWrap = { display:"flex", justifyContent:"flex-end", gap:8, flexWrap:"wrap" };
const pill = {
  display:"flex", alignItems:"center", gap:4,
  padding:"4px 8px", border:"1px solid", borderRadius:999,
  fontSize:12, cursor:"default", background:"rgba(2,6,23,0.6)"
};
