// src/components/CarbonGauge.jsx
import React from "react";

/**
 * CarbonGauge
 * - Ferrari-style semi-circle gauge with a red needle.
 * - value: 0..100 (percentage)
 * - label: string
 * - hint: small caption under label
 */
export default function CarbonGauge({ value = 50, label = "Gauge", hint }) {
  // clamp 0..100
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  // angle: -120° to +120° (240° sweep)
  const start = (-120 * Math.PI) / 180;
  const end = (120 * Math.PI) / 180;
  const theta = start + (v / 100) * (end - start);

  const cx = 100,
    cy = 100,
    r = 85;

  const arcPath = (fraction) => {
    const ang = start + fraction * (end - start);
    const x = cx + r * Math.cos(ang);
    const y = cy + r * Math.sin(ang);
    return { x, y };
  };

  const p0 = { x: cx + r * Math.cos(start), y: cy + r * Math.sin(start) };
  const p1 = { x: cx + r * Math.cos(end), y: cy + r * Math.sin(end) };

  const needleX = cx + (r - 12) * Math.cos(theta);
  const needleY = cy + (r - 12) * Math.sin(theta);

  // segments (green->yellow->red)
  const segs = [
    { f0: 0, f1: 0.6, color: "#15b26b" },
    { f0: 0.6, f1: 0.85, color: "#e3b341" },
    { f0: 0.85, f1: 1, color: "#ff2a2a" },
  ];

  return (
    <div style={styles.card}>
      <svg viewBox="0 0 200 140" style={{ width: "100%", display: "block" }}>
        {/* carbon fiber bg */}
        <defs>
          <pattern
            id="cfiber"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="#0b0e13" />
            <rect width="4" height="8" fill="#11161f" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="200" height="140" fill="url(#cfiber)" rx="10" />

        {/* arc track */}
        <path
          d={`M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`}
          fill="none"
          stroke="#1d2637"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* colored segments */}
        {segs.map((s, i) => {
          const a0 = arcPath(s.f0);
          const a1 = arcPath(s.f1);
          const large = s.f1 - s.f0 > 0.5 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M ${a0.x} ${a0.y} A ${r} ${r} 0 ${large} 1 ${a1.x} ${a1.y}`}
              fill="none"
              stroke={s.color}
              strokeWidth="8"
              strokeLinecap="round"
            />
          );
        })}

        {/* needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#ff2a2a"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="6" fill="#0b0e13" stroke="#ff2a2a" />
        {/* value */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial"
          fontSize="16"
          fill="#e6edf7"
          style={{ fontWeight: 800 }}
        >
          {Math.round(v)}%
        </text>
      </svg>

      <div style={styles.labelWrap}>
        <div style={styles.label}>{label}</div>
        {hint ? <div style={styles.hint}>{hint}</div> : null}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "#0b0f16",
    border: "1px solid #1b2130",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  labelWrap: { padding: "6px 10px 10px" },
  label: { color: "#e6edf7", fontWeight: 700 },
  hint: { color: "#a9b8d9", fontSize: 12, marginTop: 2 },
};
