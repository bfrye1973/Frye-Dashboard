// src/components/Gauge.jsx
import React, { useMemo } from "react";

/**
 * Reusable Ferrari-style radial gauge.
 * Props:
 *  - value (0..100)
 *  - label (string)
 *  - size (px diameter)
 *  - redlineStart (% where red arc begins)
 *  - theme: "dark" (carbon) | "yellow" (logo face)
 *  - showTicks (boolean)
 *  - centerBrand (ReactNode)  // optional overlay (e.g., REDLINE/TRADING text)
 *  - sublabel (string)        // optional secondary line inside gauge
 */
export default function Gauge({
  value = 0,
  label = "Gauge",
  size = 220,
  redlineStart = 75,
  theme = "dark",
  showTicks = true,
  centerBrand = null,
  sublabel = null,
}) {
  const radius = size / 2;
  const thickness = Math.max(12, size * 0.075);

  // sweep angles (Ferrari-like)
  const startDeg = -135;
  const endDeg = 135;

  const clamped = clamp01(value / 100);
  const angle = useMemo(
    () => startDeg + clamped * (endDeg - startDeg),
    [clamped]
  );

  // tick marks
  const ticks = useMemo(() => {
    if (!showTicks) return [];
    const arr = [];
    const majorEvery = 10;
    for (let v = 0; v <= 100; v += 5) {
      const a = degToRad(startDeg + (v / 100) * (endDeg - startDeg));
      const isMajor = v % majorEvery === 0;
      const r1 = radius - thickness * (isMajor ? 1.2 : 1.05);
      const r2 = radius - thickness * 0.55;
      arr.push({
        x1: radius + r1 * Math.cos(a),
        y1: radius + r1 * Math.sin(a),
        x2: radius + r2 * Math.cos(a),
        y2: radius + r2 * Math.sin(a),
        isMajor,
      });
    }
    return arr;
  }, [radius, thickness]);

  const yellowFace = theme === "yellow";
  const faceColor = yellowFace ? "#F7D21B" : "url(#carbonWeave)";
  const tickColor = yellowFace ? "#1a1a1a" : "#e8e8e8";
  const textColor = yellowFace ? "#1a1a1a" : "#eaeaea";
  const ringColor = yellowFace ? "#c5ab15" : "#888";

  const redStartDeg =
    startDeg + clamp01(redlineStart / 100) * (endDeg - startDeg);

  return (
    <div style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label} gauge at ${Math.round(value)}%`}
      >
        <defs>
          {/* subtle carbon-fiber weave */}
          <pattern id="carbonWeave" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#0e0f13" />
            <path d="M0,8 L8,0 M-2,6 L2,10 M6,-2 L10,2" stroke="#14161d" strokeWidth="2" />
            <path d="M0,0 L8,8 M-2,2 L2,-2 M6,10 L10,6" stroke="#1a1d26" strokeWidth="2" />
          </pattern>
        </defs>

        {/* dial face */}
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
          startDeg={redStartDeg}
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

        {/* black '0' printed at left for yellow face */}
        {yellowFace && (
          <text
            x={radius + (radius - thickness * 0.9) * Math.cos(degToRad(startDeg))}
            y={radius + (radius - thickness * 0.9) * Math.sin(degToRad(startDeg))}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#101010"
            fontWeight="700"
            fontSize={size * 0.1}
          >
            0
          </text>
        )}

        {/* value */}
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

        {/* label */}
        <text
          x={radius}
          y={radius + size * 0.33}
          textAnchor="middle"
          fill={textColor}
          fontWeight="600"
          fontSize={Math.max(12, size * 0.09)}
          style={{ letterSpacing: 0.4 }}
        >
          {label}
        </text>

        {/* sublabel */}
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

        {/* needle */}
        <Needle
          cx={radius}
          cy={radius}
          r={radius - thickness * 0.6}
          angleDeg={angle}
          hubColor={yellowFace ? "#1a1a1a" : "#e6e6e6"}
        />

        {/* overlay slot for brand/extra marks (e.g., REDLINE/TRADING) */}
        {centerBrand}
      </svg>
    </div>
  );
}

/* ----- LogoGauge helper (yellow face + brand text) ----- */
export function LogoGauge({ value = 0, size = 260, label = "Momentum" }) {
  return (
    <Gauge
      value={value}
      size={size}
      label={label}
      theme="yellow"
      redlineStart={78}
      showTicks
      centerBrand={
        <g>
          {/* REDLINE top */}
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

          {/* TRADING center */}
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

          {/* Powered By AI bottom */}
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

/* ----- primitives ----- */
export function Needle({ cx, cy, r, angleDeg, hubColor = "#ddd" }) {
  const a = degToRad(angleDeg);
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

export function Arc({
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

/* ----- helpers ----- */
function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function degToRad(deg) {
  return (deg * Math.PI) / 180;
}
function polar(cx, cy, r, deg) {
  const a = degToRad(deg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
