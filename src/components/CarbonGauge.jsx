// src/components/CarbonGauge.jsx
import React from "react";

export default function CarbonGauge({ value=50, label="Gauge", hint }) {
  const v = Math.max(0, Math.min(100, Number(value)||0));
  const start = (-120 * Math.PI)/180, end = (120 * Math.PI)/180;
  const theta = start + (v/100)*(end-start);
  const cx=100, cy=100, r=85;
  const needleX = cx+(r-12)*Math.cos(theta);
  const needleY = cy+(r-12)*Math.sin(theta);

  return (
    <div style={styles.card}>
      <svg viewBox="0 0 200 140" style={{width:"100%",display:"block"}}>
        <defs>
          <pattern id="cfiber" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#0b0e13"/>
            <rect width="4" height="8" fill="#11161f"/>
          </pattern>
        </defs>
        <rect x="0" y="0" width="200" height="140" fill="url(#cfiber)" rx="10"/>
        <path d="M 25 120 A 85 85 0 0 1 175 120" fill="none" stroke="#1d2637" strokeWidth="12"/>
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#ff2a2a" strokeWidth="4"/>
        <circle cx={cx} cy={cy} r="6" fill="#0b0e13" stroke="#ff2a2a"/>
        <text x={cx} y={cy+28} textAnchor="middle" fontSize="16" fill="#fff" fontWeight="800">
          {Math.round(v)}%
        </text>
      </svg>
      <div style={{padding:"6px 10px 10px"}}>
        <div style={{color:"#fff",fontWeight:700}}>{label}</div>
        {hint && <div style={{color:"#aaa",fontSize:12}}>{hint}</div>}
      </div>
    </div>
  );
}
const styles={card:{background:"#0b0f16",border:"1px solid #1b2130",borderRadius:12}};
