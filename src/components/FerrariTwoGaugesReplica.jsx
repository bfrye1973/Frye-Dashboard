// src/components/FerrariTwoGaugesReplica.jsx
// Ferrari replica look: big center RPM (yellow) + smaller right SPEED (red)
// Carbon fiber panel, deep recessed 3D bezels, glossy glass, smooth needles.
// Props:
//   rpmValue   : number (-1000..1000 ideal; clamped)
//   speedValue : number (-1000..1000 ideal; clamped)
//   startSweep : bool (true = short startup sweep)

import React, { useEffect, useMemo, useRef, useState } from "react";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp  = (a, b, t) => a + (b - a) * t;
const map   = (v, inMin, inMax, outMin, outMax) => {
  const t = (v - inMin) / (inMax - inMin || 1);
  const u = Math.max(0, Math.min(1, t));
  return outMin + u * (outMax - outMin);
};

function useEasedValue(target, speed = 0.18) {
  const [val, setVal] = useState(target);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const loop = () => {
      setVal(prev => {
        const next = lerp(prev, target, speed);
        if (Math.abs(next - target) < 0.25) return target;
        raf.current = requestAnimationFrame(loop);
        return next;
      });
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [target, speed]);
  return val;
}

function useStartupSweep(enabled, ms = 900, delayPhase = 0) {
  const [phase, setPhase] = useState(enabled ? 0 : 1); // 0..1
  useEffect(() => {
    if (!enabled) return;
    const start = performance.now();
    let raf;
    const anim = (t) => {
      const z = Math.min(1, (t - start) / ms);
      // smooth easeInOut
      const e = z < 0.5 ? (2*z*z) : (1 - Math.pow(-2*z+2, 2)/2);
      const d = Math.max(0, e - delayPhase);
      setPhase(Math.min(1, d / (1 - delayPhase || 1)));
      if (z < 1) raf = requestAnimationFrame(anim);
    };
    raf = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(raf);
  }, [enabled, ms, delayPhase]);
  return phase;
}

function GaugeDial({
  label = "RPM",
  value = 0,
  vmin = -1000,
  vmax = 1000,
  face = "yellow",      // "yellow" | "red" | "black"
  accent = "#f59e0b",   // needle color
  minDeg = -120,
  maxDeg =  120,
  redlineStartDeg = null,   // e.g. 80 for tach
  size = 260,
  startSweepPhase = 1,      // 0..1
}) {
  const sweepVal = useMemo(() => {
    const sweepAngle = map(startSweepPhase, 0, 1, minDeg, maxDeg);
    return map(sweepAngle, minDeg, maxDeg, vmin, vmax);
  }, [startSweepPhase, vmin, vmax, minDeg, maxDeg]);

  const target = startSweepPhase < 1 ? sweepVal : value;
  const eased  = useEasedValue(target, 0.20);
  const angle  = map(eased, vmin, vmax, minDeg, maxDeg);

  const W=size, H=size, cx=W/2, cy=H/2;
  const r = size*0.38;
  const rad = d => (d - 90) * Math.PI / 180;
  const P   = (deg, rr) => [cx + rr*Math.cos(rad(deg)), cy + rr*Math.sin(rad(deg))];
  const [hx, hy] = P(angle, r*0.86);

  const arc = (a1, a2, color, width=12, rr=r*0.97) => {
    const large = (a2 - a1) > 180 ? 1 : 0;
    const [x1,y1] = P(a1, rr);
    const [x2,y2] = P(a2, rr);
    return <path d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />;
  };

  // ticks
  const ticks=[];
  const majorEvery=30, minorEvery=10;
  for (let a=minDeg; a<=maxDeg; a+=majorEvery){
    const [x1,y1]=P(a,r*0.95), [x2,y2]=P(a,r*0.78);
    ticks.push(<line key={"M"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="3" opacity="0.95" />);
  }
  for (let a=minDeg; a<=maxDeg; a+=minorEvery){
    if (a%majorEvery===0) continue;
    const [x1,y1]=P(a,r*0.95), [x2,y2]=P(a,r*0.85);
    ticks.push(<line key={"m"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.4" opacity="0.85" />);
  }

  // face color
  const faceFill = face==="yellow" ? "url(#faceYellow3)"
                   : face==="red"  ? "url(#faceRed3)"
                   : "url(#faceBlack3)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:W, height:H, display:"block" }}>
      <defs>
        <pattern id="cf3" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2" />
        </pattern>
        <linearGradient id="ring3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#3a4757" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <radialGradient id="faceYellow3" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ffe261" />
          <stop offset="82%" stopColor="#f5b500" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="faceRed3" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ff5252" />
          <stop offset="82%" stopColor="#cf2a2a" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="faceBlack3" cx="50%" cy="55%">
          <stop offset="0%"  stopColor="#0f172a" />
          <stop offset="85%" stopColor="#0b1220" />
          <stop offset="100%" stopColor="#111827" />
        </radialGradient>
        <radialGradient id="glass3" cx="45%" cy="25%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.26)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>
      </defs>

      {/* carbon panel + deep bezel */}
      <circle cx={cx} cy={cy} r={r*1.36} fill="url(#cf3)" />
      <circle cx={cx} cy={cy} r={r*1.30} fill="url(#ring3)" stroke="#0b1220" strokeWidth="2" />
      {/* inner shadow to recess dial */}
      <circle cx={cx} cy={cy} r={r*1.06} fill="none"
              style={{ filter:"drop-shadow(0 8px 12px rgba(0,0,0,0.7))" }} />

      {/* face */}
      <circle cx={cx} cy={cy} r={r} fill={faceFill} stroke="#0b1220" strokeWidth="1" />

      {/* tick marks */}
      <g>{ticks}</g>

      {/* blue→green performance arcs; redline if provided */}
      {arc(minDeg, (minDeg+maxDeg)/2, "#38bdf8", 10)}
      {arc((minDeg+maxDeg)/2, maxDeg, "#22c55e", 10)}
      {redlineStartDeg !== null && arc(redlineStartDeg, maxDeg, "#ef4444", 10, r*0.94)}

      {/* needle with glow */}
      <line x1={cx} y1={cy} x2={hx} y2={hy}
            stroke={accent} strokeWidth="6.4" strokeLinecap="round"
            style={{ filter:"drop-shadow(0 0 8px rgba(229,115,38,0.45))" }} />
      <circle cx={cx} cy={cy} r="8" fill="#e5e7eb" stroke="#0b1220" strokeWidth="1.2" />

      {/* glass reflection */}
      <ellipse cx={cx} cy={cy-20} rx={r*0.96} ry={r*0.36} fill="url(#glass3)" opacity="0.55" />

      {/* labels / value */}
      <text x={cx} y={cy+40} textAnchor="middle" fill="#cbd5e1" fontSize="13">{label}</text>
      <text x={cx} y={cy+62} textAnchor="middle" fill={accent} fontSize="16" fontWeight="700">
        {Math.round(eased)}
      </text>
    </svg>
  );
}

export default function FerrariTwoGaugesReplica({
  rpmValue   = 0,       // Breadth mapped later
  speedValue = 0,       // Momentum mapped later
  startSweep = true,
}) {
  const rpm   = clamp(rpmValue,   -1000, 1000);
  const speed = clamp(speedValue, -1000, 1000);

  const sweepRPM   = useStartupSweep(startSweep, 950, 0.00); // tach first
  const sweepSpeed = useStartupSweep(startSweep, 950, 0.18); // slight delay

  return (
    <div style={panelWrap}>
      {/* carbon header strip */}
      <div style={cfStrip}><div style={cfGloss}/></div>

      {/* layout: big center tach, smaller right speedo */}
      <div style={row}>
        {/* center RPM (larger) */}
        <div style={{ transform:"scale(1.08)" }}>
          <GaugeDial
            label="RPM"
            value={rpm}
            face="yellow"
            accent="#f59e0b"
            minDeg={-120}
            maxDeg={120}
            redlineStartDeg={80}
            size={270}
            startSweepPhase={sweepRPM}
          />
        </div>

        {/* right SPEED (slightly smaller) */}
        <div style={{ transform:"scale(0.96)" }}>
          <GaugeDial
            label="SPEED"
            value={speed}
            face="red"
            accent="#ef4444"
            minDeg={-120}
            maxDeg={120}
            size={240}
            startSweepPhase={sweepSpeed}
          />
        </div>
      </div>
    </div>
  );
}

// ----------- container styles -----------
const panelWrap = {
  position:"relative",
  margin:"12px 12px 10px",
  padding:"14px 16px 10px",
  background:"#0b1220",
  borderRadius:16,
  border:"1px solid #1f2a44",
  boxShadow:"inset 0 0 38px rgba(0,0,0,0.55), 0 6px 20px rgba(0,0,0,0.45)",
  overflow:"hidden",
};

const cfStrip = {
  position:"absolute", left:0, right:0, top:0, height:48,
  background:
    `repeating-linear-gradient(45deg, #0b1220 0 2px, #0f172a 2px 4px),
     repeating-linear-gradient(-45deg, #0b1220 0 2px, #0f172a 2px 4px)`,
  borderBottom:"1px solid rgba(255,255,255,0.06)",
};
const cfGloss = {
  position:"absolute", inset:0,
  background:"linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
  pointerEvents:"none",
};

const row = {
  marginTop:16,
  display:"flex",
  alignItems:"center",
  justifyContent:"center",
  gap: 22,
};
