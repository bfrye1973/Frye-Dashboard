// src/components/FerrariTwoGaugesMock.jsx
// Two-gauge Ferrari replica mock (visuals only) to match your photo exactly:
// - Center RPM gauge: yellow face, black numerals 1..10, red band 8..10
// - Right Speed gauge: red face, white numerals 20..220
// - Deep bezels, carbon-fiber background, glass gloss overlay
// No logo yet. No data hookup; it's for visual approval only.

import React, { useEffect, useRef, useState } from "react";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp  = (a, b, t) => a + (b - a) * t;

function useEasedValue(target, speed=0.2) {
  const [v, setV] = useState(target);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const loop = () => {
      setV(prev => {
        const next = lerp(prev, target, speed);
        if (Math.abs(next - target) < 0.25) return target;
        raf.current = requestAnimationFrame(loop);
        return next;
      });
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [target, speed]);
  return v;
}

function DialFace({
  size=260,
  face="yellow",               // "yellow" or "red"
  label="RPM",
  value=0,
  valueMin=0, valueMax=100,    // 0..100 (we animate needle angle in %)
  tickLabels=[],               // [{angleDeg, text, color, fontSize}]
  redBandStartDeg=null,        // draw red arc to max
  numeralsColor="#000",        // default for tach
}) {
  const eased = useEasedValue(value, 0.2);
  const angle = -120 + (eased/100)*240; // -120..120 degrees
  const W=size, H=size, cx=W/2, cy=H/2;
  const r = size*0.38;
  const rad=(d)=> (d-90)*Math.PI/180;
  const P  =(deg, rr)=>[cx+rr*Math.cos(rad(deg)), cy+rr*Math.sin(rad(deg))];
  const [hx, hy] = P(angle, r*0.86);

  const faceFill = (face==="yellow")
    ? "url(#faceYellowR)"
    : "url(#faceRedR)";

  const tickMajorAngles = [];
  for (let a=-120; a<=120; a+=30) tickMajorAngles.push(a);
  const tickMinorAngles = [];
  for (let a=-120; a<=120; a+=10) if (a%30!==0) tickMinorAngles.push(a);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:W, height:H, display:"block" }}>
      <defs>
        {/* carbon fiber weave */}
        <pattern id="cfR" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2" />
        </pattern>
        {/* deep steel bezel */}
        <linearGradient id="ringR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#394456" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        {/* faces */}
        <radialGradient id="faceYellowR" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ffe261" />
          <stop offset="82%" stopColor="#f5b500" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="faceRedR" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ff5252" />
          <stop offset="82%" stopColor="#cf2a2a" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        {/* glass gloss */}
        <radialGradient id="glassR" cx="45%" cy="25%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.26)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>
      </defs>

      {/* Carbon panel + bezel */}
      <circle cx={cx} cy={cy} r={r*1.40} fill="url(#cfR)" />
      <circle cx={cx} cy={cy} r={r*1.34} fill="url(#ringR)" stroke="#0b1220" strokeWidth="2" />
      {/* inside recess shadow */}
      <circle cx={cx} cy={cy} r={r*1.08} fill="none" style={{ filter:"drop-shadow(0 9px 18px rgba(0,0,0,0.7))" }}/>

      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill={faceFill} stroke="#0b1220" strokeWidth="1" />

      {/* Major ticks */}
      {tickMajorAngles.map(a=>{
        const [x1,y1]=P(a, r*0.95);
        const [x2,y2]=P(a, r*0.78);
        return <line key={"M"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="3" opacity="0.95" />
      })}
      {/* Minor ticks */}
      {tickMinorAngles.map(a=>{
        const [x1,y1]=P(a, r*0.95);
        const [x2,y2]=P(a, r*0.86);
        return <line key={"m"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.5" opacity="0.85" />
      })}

      {/* Red band (e.g., 8..10) */}
      {redBandStartDeg !== null ? (() => {
        const large = (120 - redBandStartDeg) > 180 ? 1 : 0;
        const rr = r*0.94, width=12;
        const [x1,y1] = P(redBandStartDeg, rr);
        const [x2,y2] = P(120, rr);
        return <path d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2}`} stroke="#ef4444" strokeWidth={width} fill="none" strokeLinecap="round" />
      })() : null}

      {/* Numerals on face (precise Ferrari-style positions) */}
      {tickLabels.map((t, idx) => {
        const [tx, ty] = P(t.angleDeg, r*0.64);
        return (
          <text key={idx} x={tx} y={ty+5} textAnchor="middle"
                fill={t.color || numeralsColor}
                fontSize={t.fontSize || 16} fontWeight="700">
            {t.text}
          </text>
        );
      })}

      {/* Needle + hub (per face color) */}
      <line x1={cx} y1={cy} x2={ ...(()=>{
        const [nx,ny]=P(angle, r*0.86); return [nx, ny] ;
      })() } stroke={face==="yellow" ? "#f59e0b" : "#ef4444"} strokeWidth="6.6" strokeLinecap="round"
            style={{ filter:"drop-shadow(0 0 8px rgba(239,68,68,0.4))" }} />
      <circle cx={cx} cy={cy} r="8.5" fill="#e5e7eb" stroke="#0b1220" strokeWidth="1.3" />

      {/* Glass gloss */}
      <ellipse cx={cx} cy={cy-20} rx={r*0.96} ry={r*0.36} fill="url(#glassR)" opacity="0.55" />

      {/* Label */}
      <text x={cx} y={cy+40} textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="600">{label}</text>
    </svg>
  );
}

export default function FerrariTwoGaugesMock({
  rpmPercent   = 40,  // 0..100 for mock
  speedPercent = 20,  // 0..100 for mock
}) {
  // clamp for visuals
  const rpm   = clamp(rpmPercent,   0, 100);
  const speed = clamp(speedPercent, 0, 100);

  // tick labels for tach (1..10) → map to angles
  const tachLabels = Array.from({length:10}, (_,i)=>{
    const num=i+1; // 1..10
    // map 1..10 evenly onto -120..120
    const t=(num-1)/9; const a = -120 + t*240;
    return { angleDeg:a, text:String(num), color:"#0b1220", fontSize:18 };
  });

  // speed labels 20..220 step 20
  const speedLabels = Array.from({length:11}, (_,i)=>{
    const val=(i+1)*20; // 20..220
    const t=i/10; const a = -120 + t*240;
    return { angleDeg:a, text:String(val), color:"#e5e7eb", fontSize:15 };
  });

  return (
    <div style={panelWrap}>
      <div style={cfHeader}><div style={cfGloss} /></div>

      <div style={row}>
        {/* Center RPM (bigger), yellow face, black numerals, red band 8..10 */}
        <div style={{ transform:"scale(1.10)" }}>
          <DialFace
            label="RPM"
            value={rpm}
            valueMin={0} valueMax={100}
            face="yellow"
            numeralsColor="#0b1220"
            redBandStartDeg={80}
            tickLabels={tachLabels}
            size={280}
          />
        </div>

        {/* Right SPEED (smaller), red face, white numerals */}
        <div style={{ transform:"scale(0.95)" }}>
          <DialFace
            label="SPEED"
            value={speed}
            valueMin={0} valueMax={100}
            face="red"
            numeralsColor="#ffffff"
            tickLabels={speedLabels}
            size={240}
          />
        </div>
      </div>
    </div>
  );
}

// --------- container styles ----------
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
const cfHeader = {
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
  gap:26,
};
