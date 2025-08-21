// src/components/FerrariReplica.jsx
// Ferrari replica gauge cluster (OEM look) with carbon fiber + glossy glass.
// Dials: Speed (Momentum), RPM (Breadth), Fuel (100 - PSI)
// Props: logoUrl, momentum (-1000..1000), breadth (-1000..1000), psi (0..100), lights (engine lights object)

import React from "react";

// --- helpers ---
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp  = (t, a, b) => a + t * (b - a);
const map   = (val, inMin, inMax, outMin, outMax) => {
  const t = (val - inMin) / (inMax - inMin || 1);
  return lerp(Math.max(0, Math.min(1, t)), outMin, outMax);
};

// --- engine lights palette ---
const stateColors = { off:"#334155", info:"#38bdf8", warn:"#f59e0b", alert:"#ef4444", good:"#22c55e" };
const lightsMeta  = {
  overheat:{label:"Overheat",icon:"🔥"}, turbo:{label:"Turbo",icon:"🟢"},
  lowoil:{label:"Low Oil",icon:"🟡"}, squeeze:{label:"Compression",icon:"🟡"},
  expansion:{label:"Expansion",icon:"🟢"}, dist:{label:"Distribution",icon:"⛔"},
  div:{label:"Divergence",icon:"⚠️"}, srwall:{label:"Break Wall",icon:"🧱"},
  breakout:{label:"Breakout",icon:"🚀"}
};

// --- one dial (OEM tach style) ---
function Dial({
  label = "RPM", sub = "",
  value = 0, vmin = -1000, vmax = 1000,
  face = "yellow",        // "yellow" (Ferrari tach) or "black"
  accent = "#f59e0b",     // needle/accent color
  showRedline = false,    // for the tach
  minDeg = -120, maxDeg = 120, // arc
  centerText,
}) {
  const angle = map(value, vmin, vmax, minDeg, maxDeg);
  const cx=100, cy=100, r=78;
  const rad = d => (d - 90) * Math.PI / 180;
  const P   = (a, rr) => [cx + rr*Math.cos(rad(a)), cy + rr*Math.sin(rad(a))];
  const handR = 66;
  const [hx,hy] = P(angle, handR);

  const arc = (a1, a2, color, width=10, rr=r-2) => {
    const large = (a2 - a1) > 180 ? 1 : 0;
    const [x1,y1] = P(a1, rr);
    const [x2,y2] = P(a2, rr);
    return <path d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />;
  };

  // tick marks
  const ticks = [];
  const majorEvery = 30;
  for (let a=minDeg; a<=maxDeg; a+=majorEvery) {
    const [x1,y1] = P(a, r-6); const [x2,y2] = P(a, r-18);
    ticks.push(<line key={`maj-${a}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="2" opacity="0.9" />);
  }
  const minorEvery = 10;
  for (let a=minDeg; a<=maxDeg; a+=minorEvery) {
    if (a % majorEvery === 0) continue;
    const [x1,y1] = P(a, r-6); const [x2,y2] = P(a, r-12);
    ticks.push(<line key={`min-${a}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="1" opacity="0.8" />);
  }

  // value string
  const valStr = Math.round(value);

  return (
    <svg viewBox="0 0 200 200" style={{ width:"230px", height:"230px" }}>
      <defs>
        {/* carbon fiber weave */}
        <pattern id="cf" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2" />
        </pattern>
        {/* glossy glass */}
        <radialGradient id="glass" cx="45%" cy="25%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.25)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
        {/* dial faces */}
        <radialGradient id="faceYellow" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ffe261" />
          <stop offset="82%" stopColor="#f5b500" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="faceBlack" cx="50%" cy="55%">
          <stop offset="0%"  stopColor="#0f172a" />
          <stop offset="85%" stopColor="#0b1220" />
          <stop offset="100%" stopColor="#111827" />
        </radialGradient>
        {/* dark steel ring */}
        <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* outer ring + CF */}
      <circle cx={cx} cy={cy} r={92} fill="url(#cf)" />
      <circle cx={cx} cy={cy} r={90} fill="url(#ring)" stroke="#0b1220" strokeWidth="2" />

      {/* dial face */}
      <circle cx={cx} cy={cy} r={78} fill={face === "yellow" ? "url(#faceYellow)" : "url(#faceBlack)"} stroke="#0b1220" strokeWidth="1" />

      {/* tick marks */}
      <g>{ticks}</g>

      {/* arc segments (blue→green) */}
      {arc(minDeg, (minDeg+maxDeg)/2, "#38bdf8", 8)}
      {arc((minDeg+maxDeg)/2, maxDeg, "#22c55e", 8)}

      {/* redline for tach */}
      {showRedline && arc(80, maxDeg, "#ef4444", 8, r-6)}

      {/* needle */}
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke={accent} strokeWidth="5.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="7" fill="#e5e7eb" stroke="#0b1220" strokeWidth="1" />

      {/* glass */}
      <ellipse cx={cx} cy={cy-18} rx="74" ry="28" fill="url(#glass)" opacity="0.5" />

      {/* text */}
      {centerText ? (
        <text x={cx} y={cy-6} textAnchor="middle" fill="#111827" fontSize="18" fontWeight="700">
          {centerText}
        </text>
      ) : null}
      <text x={cx} y={cy+34} textAnchor="middle" fill="#cbd5e1" fontSize="12">{label}</text>
      <text x={cx} y={cy+52} textAnchor="middle" fill={accent} fontSize="14" fontWeight="600">
        {valStr}{sub}
      </text>
    </svg>
  );
}

export default function FerrariReplica({
  logoUrl = "/ferrari.png",
  momentum = 0,               // Speed dial: -1000..+1000
  breadth  = 0,               // Tach dial:  -1000..+1000
  psi,                        // Fuel dial: 0..100 (we map Fuel=100-psi)
  lights = {},
}) {
  const speedVal = clamp(momentum, -1000, 1000);
  const rpmVal   = clamp(breadth,  -1000, 1000);
  const fuelVal  = 100 - clamp(psi ?? 100, 0, 100);

  // normalize lights to show all pills
  const fullLights = {
    overheat:{state:"off",ttl:0}, turbo:{state:"off",ttl:0}, lowoil:{state:"off",ttl:0},
    squeeze:{state:"off",ttl:0}, expansion:{state:"off",ttl:0}, dist:{state:"off",ttl:0},
    div:{state:"off",ttl:0}, srwall:{state:"off",ttl:0}, breakout:{state:"off",ttl:0},
    ...lights
  };

  return (
    <div style={frame}>
      {/* carbon fiber bezel background */}
      <div style={frameCF} />
      {/* header logo */}
      <div style={logoWrap}>
        <img src={logoUrl} alt="Logo" style={logoImg} />
      </div>

      {/* three OEM dials */}
      <div style={dialRow}>
        <Dial label="SPEED" value={speedVal} vmin={-1000} vmax={1000} face="black" accent="#ef4444" />
        <Dial label="RPM"   value={rpmVal}   vmin={-1000} vmax={1000} face="yellow" accent="#f59e0b" showRedline centerText="rpm×1000" />
        <Dial label="FUEL"  value={fuelVal}  vmin={0}     vmax={100}  face="black" accent="#22c55e" sub="%" />
      </div>

      {/* engine lights */}
      <div style={lightsRow}>
        {Object.entries(lightsMeta).map(([id, meta]) => {
          const state = fullLights[id]?.state || "off";
          const color = stateColors[state] || stateColors.off;
          return (
            <div key={id} style={{...pill, borderColor: color}} title={meta.label}>
              <span style={{ color, marginRight:6 }}>{meta.icon}</span>
              <span>{meta.label}</span>
            </div>
          );
        })}
      </div>

      {/* glossy top highlight */}
      <div style={glassStrip} />
    </div>
  );
}

// --- styles for frame & carbon fiber ---
const frame = {
  position:"relative",
  margin:"12px 12px 8px",
  padding:"16px 18px 12px",
  background:"#0b1220",
  borderRadius:16,
  border:"1px solid #1f2a44",
  boxShadow:"inset 0 0 35px rgba(0,0,0,0.55), 0 6px 20px rgba(0,0,0,0.45)",
  overflow:"hidden",
};
const frameCF = {
  position:"absolute", inset:0,
  background:
    `repeating-linear-gradient(45deg, #0b1220 0 2px, #0f172a 2px 4px),
     repeating-linear-gradient(-45deg, #0b1220 0 2px, #0f172a 2px 4px)`,
  opacity:0.35,
  pointerEvents:"none",
};
const glassStrip = {
  position:"absolute", left:0, right:0, top:0, height:46,
  background:"linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
  borderBottom:"1px solid rgba(255,255,255,0.06)",
  pointerEvents:"none",
};
const logoWrap = {
  position:"absolute", left:18, top:8, height:46, display:"flex", alignItems:"center",
};
const logoImg = { height:36, objectFit:"contain", filter:"drop-shadow(0 2px 2px rgba(0,0,0,0.5))" };

const dialRow = {
  display:"flex", alignItems:"center", justifyContent:"center",
  gap:28, paddingTop:12,
};

const lightsRow = {
  marginTop:6, display:"flex", flexWrap:"wrap", gap:8, justifyContent:"flex-end",
};
const pill = {
  display:"flex", alignItems:"center", gap:4,
  padding:"4px 8px", border:"1px solid", borderRadius:999,
  fontSize:12, cursor:"default", background:"rgba(2,6,23,0.55)"
};
