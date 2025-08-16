// src/components/CarbonGauge.jsx
import React, { useMemo } from "react";

/**
 * Ferrari-style semicircle gauge.
 * Props:
 *  - label: string
 *  - value: number (0-100)
 *  - diameter: number (px)
 *  - color: needle color
 *  - face: "tach" | "dark"   (tach = yellow face)
 *  - subline?: string        (small line under label; used for Momentum “Powered by AI” if desired)
 *  - logoCenter?: boolean    (draws subtle “REDLINE” mark inside)
 */
export default function CarbonGauge({
  label,
  value = 0,
  diameter = 260,
  color = "#e24b4b",
  face = "dark",
  subline,
  logoCenter = false,
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = diameter / 2;
  const stroke = 10;
  const cx = radius;
  const cy = radius;
  const start = 210;      // degrees (left)
  const end = -30;        // degrees (right)
  const angle = start + (end - start) * (clamped / 100);

  const marks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const a = start + (end - start) * t;
      const len = i % 2 === 0 ? 14 : 8;
      const r1 = radius - 22;
      const r2 = r1 - len;
      const x1 = cx + r1 * Math.cos((a * Math.PI) / 180);
      const y1 = cy + r1 * Math.sin((a * Math.PI) / 180);
      const x2 = cx + r2 * Math.cos((a * Math.PI) / 180);
      const y2 = cy + r2 * Math.sin((a * Math.PI) / 180);
      ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cfd8ec" strokeOpacity={i%2?0.35:0.8} strokeWidth={i%2?1:1.6} />);
    }
    return ticks;
  }, [radius, cx, cy]);

  const needleLen = radius - 36;
  const nx = cx + needleLen * Math.cos((angle * Math.PI) / 180);
  const ny = cy + needleLen * Math.sin((angle * Math.PI) / 180);

  const faceFill = face === "tach" ? "url(#tachFace)" : "url(#darkFace)";

  return (
    <div style={{ width: diameter, height: diameter, position:"relative" }}>
      <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`}>
        <defs>
          {/* dark carbon */}
          <pattern id="carbon" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="12" height="12" fill="#0f1320" />
            <rect width="6" height="12" fill="rgba(255,255,255,.03)"/>
          </pattern>
          <radialGradient id="bezel" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#2a3248"/>
            <stop offset="100%" stopColor="#1a2236"/>
          </radialGradient>
          <linearGradient id="needleGrad" x1="0" x2="1">
            <stop offset="0%" stopColor={color}/>
            <stop offset="100%" stopColor="#851f1f"/>
          </linearGradient>
          <linearGradient id="tachYellow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffd84a"/>
            <stop offset="100%" stopColor="#f4c21d"/>
          </linearGradient>
          <mask id="semi">
            <rect width="100%" height="100%" fill="black"/>
            <path d={arcPath(cx, cy, radius - 12, start, end)} stroke="white" strokeWidth={radius} fill="none"/>
          </mask>
          <rect id="tachRect" width="100%" height="100%" fill="url(#tachYellow)" />
          <rect id="darkRect" width="100%" height="100%" fill="url(#carbon)" />
          <g id="tachFace"><use href="#tachRect"/></g>
          <g id="darkFace"><use href="#darkRect"/></g>
        </defs>

        {/* Face (masked semicircle) */}
        <g mask="url(#semi)">
          <rect width="100%" height="100%" fill={faceFill}/>
        </g>

        {/* Bezel */}
        <circle cx={cx} cy={cy} r={radius-6} fill="none" stroke="url(#bezel)" strokeWidth={6}/>

        {/* tick marks */}
        {marks}

        {/* needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="url(#needleGrad)" strokeWidth={4} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={8} fill="#1a2236" stroke="#eaeff9" strokeWidth={1}/>

        {/* label + value */}
        <text x={cx} y={cy+radius*0.40} fill="#cfd8ec" fontSize={14} textAnchor="middle">{label}</text>
        {subline ? (
          <text x={cx} y={cy+radius*0.54} fill="#9fb1d6" fontSize={12} textAnchor="middle">{subline}</text>
        ) : null}
        <g>
          <text x={cx} y={cy+4} textAnchor="middle" fontWeight="800" fontSize={28} fill="#ffffff">{Math.round(value)}%</text>
        </g>

        {/* subtle center branding if requested */}
        {logoCenter && (
          <text x={cx} y={cy-10} textAnchor="middle" fontWeight="900" fontSize={16} fill="#e23a3a" style={{letterSpacing:".2em"}}>
            REDLINE
          </text>
        )}
      </svg>
    </div>
  );
}

/** build a circular-arc path for mask */
function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = Math.abs(endDeg - startDeg) <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
