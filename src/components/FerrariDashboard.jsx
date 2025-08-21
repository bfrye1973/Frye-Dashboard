// src/components/FerrariDashboard.jsx
import React from "react";

// Map raw values to dial angles
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function map(val, inMin, inMax, outMin, outMax) {
  const t = (val - inMin) / (inMax - inMin || 1);
  return outMin + clamp(t, 0, 1) * (outMax - outMin);
}

// a single circular gauge (SVG)
function Dial({ label, value = 0, vmin = -1000, vmax = 1000, color = "#f59e0b", units = "" }) {
  // Ferrari tach arc: -120deg → +120deg
  const start = -120, end = 120;
  const angle = map(value, vmin, vmax, start, end);

  const cx = 80, cy = 80, r = 62;
  const rad = (deg) => (deg - 90) * Math.PI / 180;
  const handX = cx + r * Math.cos(rad(angle));
  const handY = cy + r * Math.sin(rad(angle));

  // backdrop arc
  const arc = (a1, a2, stroke) => {
    const large = (a2 - a1) > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos(rad(a1));
    const y1 = cy + r * Math.sin(rad(a1));
    const x2 = cx + r * Math.cos(rad(a2));
    const y2 = cy + r * Math.sin(rad(a2));
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        stroke={stroke} strokeWidth="10" fill="none" strokeLinecap="round"
      />
    );
  };

  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ display:"block" }}>
      {/* dial ring */}
      {arc(start, end, "#1f2a44")}
      {/* zones */}
      {arc(start, (start+end)/2, "#0ea5e9")}
      {arc((start+end)/2, end, "#22c55e")}
      {/* hand */}
      <line x1={cx} y1={cy} x2={handX} y2={handY} stroke={color} strokeWidth="6" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="#e5e7eb" />
      {/* label & value */}
      <text x={cx} y={cy+36} textAnchor="middle" fill="#cbd5e1" fontSize="12">{label}</text>
      <text x={cx} y={cy+54} textAnchor="middle" fill={color} fontSize="14" fontWeight="600">
        {Math.round(value)}{units}
      </text>
    </svg>
  );
}

export default function FerrariDashboard({
  logoUrl = "/ferrari.png",                // put your logo in /public/ferrari.png
  momentum = 0,                            // -1000..+1000 (you can tune)
  breadth  = 0,                            // -1000..+1000 or +only
  psi      = 0,                            // 0..100
  lights   = {},                           // from your computeEngineLights()
  onLightClick,
}) {
  // Speed = Momentum; RPM = Breadth; Fuel = 100-PSI (compression -> low fuel)
  const speedVal = clamp(momentum, -1000, 1000);
  const rpmVal   = clamp(breadth,  -1000, 1000);
  const fuelVal  = 100 - clamp(psi ?? 0, 0, 100);

  return (
    <div style={wrap}>
      {/* left: logo */}
      <div style={left}>
        <img src={logoUrl} alt="Ferrari" style={{ height: 40, objectFit:"contain", opacity:0.95 }} />
      </div>

      {/* center: three dials */}
      <div style={center}>
        <Dial label="Speed" value={speedVal} vmin={-1000} vmax={1000} color="#ef4444" />
        <Dial label="RPM"   value={rpmVal}   vmin={-1000} vmax={1000} color="#f59e0b" />
        <Dial label="Fuel"  value={fuelVal}  vmin={0}     vmax={100}  color="#22c55e" units="%" />
      </div>

      {/* engine lights */}
      <div style={lightsWrap}>
        {Object.entries(lights).map(([id, obj]) => {
          const state = obj?.state || "off";
          const color = stateColors[state] || stateColors.off;
          const label = labels[id]?.label || id;
          const icon  = labels[id]?.icon  || "•";
          return (
            <div key={id} title={label} onClick={()=>onLightClick?.(id)}
                 style={{...pill, borderColor: color}}>
              <span style={{ color, marginRight:6 }}>{icon}</span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// engine light metadata
const labels = {
  overheat: { label: "Overheat",  icon:"🔥" },
  turbo:    { label: "Turbo",     icon:"🟢" },
  lowoil:   { label: "Low Oil",   icon:"🟡" },
  squeeze:  { label: "Compression", icon:"🟡" },
  expansion:{ label: "Expansion", icon:"🟢" },
  dist:     { label: "Distribution", icon:"⛔" },
  div:      { label: "Divergence", icon:"⚠️" },
  srwall:   { label: "Break Wall",  icon:"🧱" },
  breakout: { label: "Breakout",    icon:"🚀" },
};

const stateColors = {
  off:   "#334155",
  info:  "#38bdf8",
  warn:  "#f59e0b",
  alert: "#ef4444",
  good:  "#22c55e",
};

// styles
const wrap = {
  display:"grid",
  gridTemplateColumns:"160px 1fr",
  alignItems:"center",
  gap: 12,
  padding:"8px 12px",
  border:"1px solid #1f2a44",
  borderRadius:12,
  background:"#0e1526",
  margin:"8px 0 12px 0"
};
const left = { display:"flex", alignItems:"center" };
const center = { display:"flex", justifyContent:"center", alignItems:"center", gap:24 };
const lightsWrap = { display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end" };
const pill = {
  display:"flex", alignItems:"center", gap:4,
  padding:"4px 8px", border:"1px solid", borderRadius:999, fontSize:12, cursor:"default"
};
