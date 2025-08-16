import React from "react";

/**
 * CarbonGauge (Ferrari-style)
 *
 * Props:
 * - value: number (0–100)         -> required; mapped to needle angle
 * - label: string                  -> small caption under the dial (e.g., "Momentum")
 * - size?: number                  -> overall size in px (default 260)
 * - isLogo?: boolean               -> if true, show brand text in center + Ferrari-yellow dial
 * - units?: string                 -> optional small units label (e.g., "%")
 * - redlineStart?: number          -> where red zone starts (default 70)
 */
export default function CarbonGauge({
  value,
  label = "",
  size = 260,
  isLogo = false,
  units = "%",
  redlineStart = 70,
}) {
  const clamped = Math.max(0, Math.min(100, Number(value ?? 0)));
  const r = size / 2;
  const cx = r;
  const cy = r;

  // Needle angle: -120° (min) to +120° (max)
  const minDeg = -120;
  const maxDeg = 120;
  const ang = minDeg + (clamped / 100) * (maxDeg - minDeg);

  // Dial colors
  const yellowDial = "#ffcf2f";
  const darkDial = "#0f141c";
  const dialFill = isLogo ? yellowDial : darkDial;

  // Common helpers
  const toRad = (deg) => (deg * Math.PI) / 180;
  const polar = (cx, cy, radius, deg) => ({
    x: cx + radius * Math.cos(toRad(deg - 90)),
    y: cy + radius * Math.sin(toRad(deg - 90)),
  });

  const arcPath = (cx, cy, radius, startDeg, endDeg) => {
    const start = polar(cx, cy, radius, startDeg);
    const end = polar(cx, cy, radius, endDeg);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const sweep = endDeg > startDeg ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} ${sweep} ${end.x} ${end.y}`;
    // NOTE: for our dial we stay under 180°, so large-arc-flag won't flip
  };

  // Redline arc from redlineStart..100
  const startRed = redlineStart;
  const startRedDeg = minDeg + (startRed / 100) * (maxDeg - minDeg);
  const endRedDeg = maxDeg;

  // Tick marks (major every 10, minor every 5)
  const ticks = [];
  for (let i = 0; i <= 100; i += 5) {
    const major = i % 10 === 0;
    const tickLen = major ? 14 : 8;
    const tickDeg = minDeg + (i / 100) * (maxDeg - minDeg);
    const p1 = polar(cx, cy, r - 20, tickDeg);
    const p2 = polar(cx, cy, r - 20 - tickLen, tickDeg);
    ticks.push(
      <line
        key={`t${i}`}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={major ? "#cfd8e3" : "#6a7484"}
        strokeWidth={major ? 2 : 1.5}
        strokeLinecap="round"
      />
    );
  }

  // Major numerals (0..10)
  const numbers = [];
  for (let k = 0; k <= 10; k++) {
    const pct = (k * 10) / 100; // 0..1
    const deg = minDeg + pct * (maxDeg - minDeg);
    const p = polar(cx, cy, r - 48, deg);
    numbers.push(
      <text
        key={`n${k}`}
        x={p.x}
        y={p.y}
        fill={isLogo ? "#10151f" : "#e7eef9"}
        fontSize={14}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontFamily: "system-ui, Segoe UI, Roboto, Arial" }}
      >
        {k}
      </text>
    );
  }

  // Needle end
  const needleOuter = polar(cx, cy, r - 38, ang);

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {/* carbon-fiber pattern for bezel */}
          <pattern id="cfiber" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#0b0e13" />
            <path d="M0,8 l8,-8 M-2,6 l4,-4 M6,10 l4,-4" stroke="#121821" strokeWidth="2" />
          </pattern>

          <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Outer bezel */}
        <circle cx={cx} cy={cy} r={r - 2} fill="url(#cfiber)" />
        {/* Silver trim */}
        <circle cx={cx} cy={cy} r={r - 8} fill="none" stroke="#aab3c2" strokeWidth="6" />
        {/* Inner ring */}
        <circle cx={cx} cy={cy} r={r - 16} fill={dialFill} stroke="#1b2430" strokeWidth="2" />

        {/* Redline arc */}
        <path
          d={arcPath(cx, cy, r - 24, startRedDeg, endRedDeg)}
          stroke="#e53935"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          filter="url(#softShadow)"
        />

        {/* Tick marks + numerals */}
        {ticks}
        {numbers}

        {/* Center hub ring */}
        <circle cx={cx} cy={cy} r={22} fill="#10151c" stroke="#747e8e" strokeWidth="2" />

        {/* Needle */}
        <g filter="url(#softShadow)">
          <line
            x1={cx}
            y1={cy}
            x2={needleOuter.x}
            y2={needleOuter.y}
            stroke="#d33"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={8} fill="#222a35" stroke="#c6cbd3" strokeWidth="2" />
        </g>

        {/* Value readout */}
        <text
          x={cx}
          y={cy + 40}
          fill={isLogo ? "#10151f" : "#e7eef9"}
          fontSize={20}
          fontWeight={900}
          textAnchor="middle"
          style={{ fontFamily: "system-ui, Segoe UI, Roboto, Arial", letterSpacing: 1 }}
        >
          {Math.round(clamped)}
          {units}
        </text>

        {/* Label */}
        {label ? (
          <text
            x={cx}
            y={size - 14}
            fill="#9fb3c8"
            fontSize={13}
            textAnchor="middle"
            style={{ fontFamily: "system-ui, Segoe UI, Roboto, Arial" }}
          >
            {label}
          </text>
        ) : null}

        {/* Center branding when used as the logo meter */}
        {isLogo && (
          <>
            <text
              x={cx}
              y={cy - 38}
              fill="#b80d10"
              fontSize={18}
              textAnchor="middle"
              fontWeight={900}
              style={{ fontFamily: "system-ui, Segoe UI, Roboto, Arial", letterSpacing: 2 }}
            >
              REDLINE
            </text>
            <text
              x={cx}
              y={cy - 16}
              fill="#10151f"
              fontSize={13}
              textAnchor="middle"
              fontWeight={900}
              style={{ fontFamily: "system-ui, Segoe UI, Roboto, Arial", letterSpacing: 1.5 }}
            >
              TRADING
            </text>
            <text
              x={cx}
              y={cy + 6}
              fill="#10151f"
              fontSize={11}
              textAnchor="middle"
              fontWeight={700}
              style={{ fontFamily: "system-ui, Segoe UI, Roboto, Arial", letterSpacing: 0.8 }}
            >
              Powered By AI
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
