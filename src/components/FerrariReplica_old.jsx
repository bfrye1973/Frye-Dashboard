// src/components/FerrariReplica.jsx
// First‑draft Ferrari replica cluster (OEM style) — video‑game polished.
// Dials: Speed (Momentum), RPM (Breadth), Fuel (100 - PSI)
// Aux dials: Water Temp, Oil Pressure (placeholder mappings; tunable later).
// Props: logoUrl, momentum (-1000..1000), breadth (-1000..1000), psi (0..100), lights (optional)

import React, { useEffect, useRef, useState } from "react";

// ---------- helpers ----------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp  = (a, b, t) => a + (b - a) * t;
const map   = (v, inMin, inMax, outMin, outMax) => {
  const t = (v - inMin) / (inMax - inMin || 1);
  const t2 = Math.max(0, Math.min(1, t));
  return outMin + t2 * (outMax - outMin);
};

// small easing for needle motion
function useEased(value, speed = 0.18) {
  const [eased, setEased] = useState(value);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const loop = () => {
      setEased(prev => {
        const next = lerp(prev, value, speed);
        if (Math.abs(next - value) < 0.25) return value;
        raf.current = requestAnimationFrame(loop);
        return next;
      });
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [value, speed]);
  return eased;
}

// ---------- a small aux gauge (left side) ----------
function AuxGauge({ label="TEMP", value=50, min=0, max=100, unit="" }) {
  const eased = useEased(value, 0.2);
  const pct = clamp((eased - min) / (max - min || 1), 0, 1);
  const w = 140, h = 56, r = 24, x = 10, y = 10;
  const barW = Math.round(pct * (w - 2*x));
  return (
    <svg viewBox="0 0 160 80" style={{ width: 160, height: 80 }}>
      <defs>
        <linearGradient id="auxRing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="160" height="80" rx="12" ry="12" fill="#0b1220" stroke="#1f2a44" />
      <rect x="8" y="8" width="144" height="64" rx="10" ry="10" fill="url(#auxRing)" stroke="#0b1220" />
      <text x="80" y="28" textAnchor="middle" fill="#cbd5e1" fontSize="12">{label}</text>
      <rect x={x} y={y+26} width={w-2*x} height={12} rx="6" fill="#0b1220" stroke="#1f2a44" />
      <rect x={x} y={y+26} width={barW} height={12} rx="6" fill="#22c55e" />
      <text x="80" y="64" textAnchor="middle" fill="#22c55e" fontSize="12" fontWeight="600">
        {Math.round(eased)}{unit}
      </text>
    </svg>
  );
}

// ---------- segmented fuel bar ----------
function FuelBar({ pct = 100 }) {
  const p = clamp(pct, 0, 100);
  const filled = Math.round((p/100) * 10);
  const segs = Array.from({ length: 10 }, (_, i) => i < filled);
  return (
    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
      {segs.map((on, i) => (
        <div key={i} style={{
          width: 18, height: 10, borderRadius: 3,
          background: on ? "#22c55e" : "#334155",
          boxShadow: on ? "0 0 7px rgba(34,197,94,0.55)" : "none",
          border: "1px solid #1f2a44"
        }}/>
      ))}
    </div>
  );
}

// ---------- main dial (tach/speed) ----------
function Dial({
  label = "RPM",
  value = 0,
  vmin = -1000,
  vmax = 1000,
  face = "yellow",        // "yellow" (Ferrari tach) or "black"
  accent = "#f59e0b",     // needle/accent color
  showRedline = false,    // red arc
  minDeg = -120,
  maxDeg =  120,
  logoUrl,                // only for tach (on face)
  centerText,
}) {
  const easedVal = useEased(value, 0.2);
  const angle = map(easedVal, vmin, vmax, minDeg, maxDeg);

  const cx = 100, cy = 100, r = 78;
  const rad = d => (d - 90) * Math.PI / 180;
  const P = (deg, rr) => [cx + rr*Math.cos(rad(deg)), cy + rr*Math.sin(rad(deg))];

  const [hx, hy] = P(angle, 66);

  const arc = (a1, a2, color, width=10, rr=r-2) => {
    const large = (a2 - a1) > 180 ? 1 : 0;
    const [x1,y1] = P(a1, rr);
    const [x2,y2] = P(a2, rr);
    return <path d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />;
  };

  // ticks
  const ticks = [];
  const majorEvery = 30;
  for (let a = minDeg; a <= maxDeg; a += majorEvery) {
    const [x1,y1] = P(a, r-6), [x2,y2] = P(a, r-18);
    ticks.push(<line key={`maj-${a}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="2" opacity="0.9" />);
  }
  const minorEvery = 10;
  for (let a = minDeg; a <= maxDeg; a += minorEvery) {
    if (a % majorEvery === 0) continue;
    const [x1,y1] = P(a, r-6), [x2,y2] = P(a, r-12);
    ticks.push(<line key={`min-${a}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1" opacity="0.75" />);
  }

  return (
    <svg viewBox="0 0 200 200" style={{ width: 230, height: 230 }}>
      <defs>
        <pattern id="cf" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2" />
        </pattern>
        <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
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
        <radialGradient id="glass" cx="45%" cy="25%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.25)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>
      </defs>

      {/* bezel + CF */}
      <circle cx={100} cy={100} r={92} fill="url(#cf)" />
      <circle cx={100} cy={100} r={90} fill="url(#ring)" stroke="#0b1220" strokeWidth="2" />

      {/* dial face */}
      <circle
        cx={100} cy={100} r={78}
        fill={face === "yellow" ? "url(#faceYellow)" : "url(#faceBlack)"}
        stroke="#0b1220" strokeWidth="1"
      />

      {/* ticks */}
      <g>{ticks}</g>

      {/* arcs (blue→green) + redline */}
      {arc(minDeg, (minDeg+maxDeg)/2, "#38bdf8", 8)}
      {arc((minDeg+maxDeg)/2, maxDeg, "#22c55e", 8)}
      {showRedline && arc(80, maxDeg, "#ef4444", 8, 72)}

      {/* needle */}
      <line x1={100} y1={100} x2={hx} y2={hy} stroke={accent} strokeWidth="5.5" strokeLinecap="round" />
      <circle cx={100} cy={100} r={7} fill="#e5e7eb" stroke="#0b1220" strokeWidth="1" />

      {/* tach logo */}
      {logoUrl && face === "yellow" ? (
        <image href={logoUrl} x={85} y={58} width={30} height={30} preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.95 }} />
      ) : null}

      {/* glass */}
      <ellipse cx={100} cy={82} rx={74} ry={26} fill="url(#glass)" opacity="0.5" />

      {/* text */}
      {centerText ? (
        <text x={100} y={96} textAnchor="middle" fill="#111827" fontSize="18" fontWeight="700">
          {centerText}
        </text>
      ) : null}
      <text x={100} y={136} textAnchor="middle" fill="#cbd5e1" fontSize="12">{label}</text>
      <text x={100} y={154} textAnchor="middle" fill={accent} fontSize="14" fontWeight="600">
        {Math.round(easedVal)}
      </text>
    </svg>
  );
}

export default function FerrariReplica({
  logoUrl = "/ferrari.png",
  momentum = 0,     // Speed dial (left)
  breadth  = 0,     // Tach dial (center)
  psi = 100,        // Fuel = 100 - psi
}) {
  const speedVal = clamp(momentum, -1000, 1000);
  const rpmVal   = clamp(breadth,  -1000, 1000);
  const fuelPct  = 100 - clamp(psi, 0, 100);

  // simple placeholders for aux dials (tunable later)
  const waterTemp = 140 + (clamp(breadth, -1000, 1000) + 1000) * (140/2000); // 140..280
  const oilPress  = (clamp(momentum, -1000, 1000) + 1000) * (140/2000);      // 0..140

  return (
    <div style={frame}>
      <div style={frameCF} />
      <div style={glassStrip} />

      {/* top row: aux dials + tach + speed */}
      <div style={topRow}>
        <div style={{ display:"flex", flexDirection:"column", gap:10, justifyContent:"center" }}>
          <AuxGauge label="WATER TEMP" value={Math.round(waterTemp)} min={140} max={280} unit="°F" />
          <AuxGauge label="OIL PRESS"  value={Math.round(oilPress)}  min={0}   max={140} unit="psi" />
        </div>

        <Dial
          label="RPM"
          value={rpmVal}
          vmin={-1000}
          vmax={1000}
          face="yellow"
          accent="#f59e0b"
          showRedline
          centerText="rpm×1000"
          logoUrl={logoUrl}
        />

        <Dial
          label="SPEED"
          value={speedVal}
          vmin={-1000}
          vmax={1000}
          face="black"
          accent="#ef4444"
        />
      </div>

      {/* fuel cluster */}
      <div style={fuelWrap}>
        <div style={{ color:"#cbd5e1", fontSize:12, letterSpacing:0.6, marginBottom:8 }}>FUEL</div>
        <FuelBar pct={fuelPct} />
        <div style={{ color:"#22c55e", fontSize:14, fontWeight:600, marginTop:6 }}>{Math.round(fuelPct)}%</div>
      </div>
    </div>
  );
}

// ---------- bezel styles ----------
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
  opacity:0.35, pointerEvents:"none",
};
const glassStrip = {
  position:"absolute", left:0, right:0, top:0, height:46,
  background:"linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
  borderBottom:"1px solid rgba(255,255,255,0.06)", pointerEvents:"none"
};
const topRow = {
  display:"grid",
  gridTemplateColumns:"170px 1fr 1fr",
  gap:16,
  alignItems:"center",
};
const fuelWrap = {
  display:"flex", flexDirection:"column", alignItems:"center",
  paddingTop:6,
};
