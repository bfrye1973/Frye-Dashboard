// src/components/FerrariCluster.jsx
import React from "react";

/**
 * FerrariCluster — self-contained, hard-capped cluster.
 * - No vh / % height dependencies
 * - Uses a CSS var (--clusterH) so interior rows size deterministically
 * - Default cap 520px, configurable with `height` prop (will be clamped ≤ 520)
 */
export default function FerrariCluster({
  rpmValue = 5200,
  speedValue = 68,
  waterValue = 62,
  oilValue = 55,
  fuelValue = 73,
  height = 520, // default to full cap; can pass smaller (e.g., 360)
}) {
  const CAP = 520;
  const H = Math.max(280, Math.min(Number(height) || CAP, CAP)); // 280–520 sane range
  const TOP_ROW = Math.max(200, Math.min(H - 60, 460));          // leave 60px for lights

  return (
   <div data-owner="FerrariCluster" style={...}>
 
    <div
      id="cluster"
      style={{
        // self-contained sizing
        "--clusterH": `${H}px`,
        "--clusterTop": `${TOP_ROW}px`,
        width: "100%",
        height: "var(--clusterH)",
        maxHeight: CAP,
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid #171a22",
        boxShadow:
          "inset 0 0 0 2px rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.35)",
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,.35), rgba(0,0,0,.65)), repeating-linear-gradient(45deg, #101317 0 6px, #0b0e12 6px 12px)",
      }}
    >
      {/* Top row (fixed px, independent of parent %) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          padding: "18px 22px 8px 22px",
          alignItems: "center",
          height: "var(--clusterTop)",
          boxSizing: "border-box",
        }}
      >
        {/* RPM + minis (left) */}
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <FerrariRPMGauge value={rpmValue} max={9000} size={240} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              rowGap: 10,
              alignContent: "center",
            }}
          >
            <MiniGaugeBlack label="WATER" value={waterValue} size={90} />
            <MiniGaugeBlack label="OIL" value={oilValue} size={90} />
            <MiniGaugeBlack label="FUEL" value={fuelValue} size={90} greenToRed />
          </div>
        </div>

        {/* Speed (right) */}
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <FerrariSpeedGauge value={speedValue} max={220} size={260} />
        </div>
      </div>

      {/* Bottom engine lights row (fixed ~60px) */}
      <EngineLightsRow />
    </div>
  );
}

/* ============================ helpers ============================ */
function polarToXY(cx, cy, radius, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
}
function arcPath(cx, cy, r, angA, angB) {
  const [x0, y0] = polarToXY(cx, cy, r, angA);
  const [x1, y1] = polarToXY(cx, cy, r, angB);
  const largeArc = Math.abs(angB - angA) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
}

/* ============================ RPM (yellow) ============================ */
function FerrariRPMGauge({ value = 5200, min = 0, max = 9000, size = 240 }) {
  const vb = 200,
    cx = 100,
    cy = 100;
  const R_FACE = 84,
    R_TRIM = 92,
    R_TICKS = 88,
    R_NUM = 64;
  const START = -120,
    END = 120,
    R_LABEL = R_TRIM + 8;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const t = (v) => (clamp(v, min, max) - min) / (max - min);
  const currentAngle = START + (END - START) * t(value);
  const topArcId = "rpm-top-arc",
    botArcId = "rpm-bot-arc";

  const majors = [];
  for (let k = 0; k <= 9; k++) {
    const a = START + ((END - START) * (k * 1000 - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 10, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 6, a);
    majors.push(
      <line
        key={`rpm-maj-${k}`}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke="#fff"
        strokeWidth="2"
      />
    );
  }
  const minors = [];
  for (let k = 0; k <= 90; k += 10) {
    if (k % 20 === 0) continue;
    const a = START + ((END - START) * (k * 100 - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 6, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 4, a);
    minors.push(
      <line
        key={`rpm-min-${k}`}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke="#fff"
        strokeWidth="1.5"
      />
    );
  }
  const numerals = [];
  for (let k = 0; k <= 9; k++) {
    const a = START + ((END - START) * (k * 1000 - min)) / (max - min);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    numerals.push(
      <text
        key={`rpm-num-${k}`}
        x={tx}
        y={ty + 4}
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#0a0a0a"
      >
        {k}
      </text>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      width={size}
      height={size}
      role="img"
      aria-label="RPM Gauge"
      style={{ overflow: "hidden" }}
    >
      <defs>
        <path id={topArcId} d={arcPath(cx, cy, R_LABEL, -150, -30)} />
        <path id={botArcId} d={arcPath(cx, cy, R_LABEL, 30, 150)} />
      </defs>

      <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="#dc2626" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={R_FACE} fill="#facc15" />

      <g>{majors}</g>
      <g>{minors}</g>
      <g>{numerals}</g>

      <path
        d={arcPath(cx, cy, R_TICKS - 16, START, currentAngle)}
        stroke="#ef4444"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />

      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => {
        const [nx, ny] = polarToXY(cx, cy, R_TICKS - 22, currentAngle);
        return (
          <line
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke="#111827"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })()}

      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#0a0a0a" opacity=".85">
        RPM × 1000
      </text>

      <text fontSize="10" fontWeight="800" fill="#ef4444" letterSpacing=".12em">
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">
          REDLINE TRADING
        </textPath>
      </text>
      <text fontSize="9" fontWeight="700" fill="#ef4444" letterSpacing=".18em">
        <textPath href={`#${botArcId}`} startOffset="50%" textAnchor="middle">
          POWERED BY AI
        </textPath>
      </text>
    </svg>
  );
}

/* ============================ Speed (black) ============================ */
function FerrariSpeedGauge({ value = 70, min = 0, max = 220, size = 260 }) {
  const vb = 220,
    cx = 110,
    cy = 110;
  const R_FACE = 90,
    R_TICKS = 94,
    R_NUM = 68;
  const START = -120,
    END = 120;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const t = (v) => (clamp(v, min, max) - min) / (max - min);
  const currentAngle = START + (END - START) * t(value);

  const majors = [],
    minors = [],
    numerals = [];
  for (let k = 0; k <= max; k += 20) {
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 12, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 4, a);
    majors.push(
      <line
        key={`spd-maj-${k}`}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke="#fff"
        strokeWidth="2"
      />
    );
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    numerals.push(
      <text
        key={`spd-num-${k}`}
        x={tx}
        y={ty + 4}
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#e7eaee"
      >
        {k}
      </text>
    );
  }
  for (let k = 10; k < max; k += 10) {
    if (k % 20 === 0) continue;
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 7, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 2, a);
    minors.push(
      <line
        key={`spd-min-${k}`}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke="#fff"
        strokeWidth="1.5"
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      width={size}
      height={size}
      role="img"
      aria-label="Speed Gauge"
      style={{ overflow: "hidden" }}
    >
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="6" />
      <g>{majors}</g>
      <g>{minors}</g>
      <g>{numerals}</g>
      <path
        d={arcPath(cx, cy, R_TICKS - 16, START, currentAngle)}
        stroke="#ef4444"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => {
        const [nx, ny] = polarToXY(cx, cy, R_TICKS - 22, currentAngle);
        return (
          <line
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke="#e5e7eb"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })()}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#c9d1d9" opacity=".85">
        MPH
      </text>
    </svg>
  );
}

/* ============================ Mini (black) ============================ */
function MiniGaugeBlack({ label = "GAUGE", value = 50, size = 92, greenToRed = false }) {
  const vb = 160,
    cx = 80,
    cy = 80;
  const R_FACE = 60,
    R_TICKS = 64;
  const START = -120,
    END = 120;
  const v = Math.max(0, Math.min(100, value));
  const currentAngle = START + ((END - START) * v) / 100;

  const majors = [];
  for (let k = 0; k <= 100; k += 20) {
    const a = START + ((END - START) * k) / 100;
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 9, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 3, a);
    majors.push(
      <line
        key={`mini-maj-${k}`}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke="#fff"
        strokeWidth="1.8"
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      width={size}
      height={size}
      role="img"
      aria-label={`${label} gauge`}
      style={{ overflow: "hidden" }}
    >
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="5" />
      {greenToRed && (
        <>
          <path
            d={arcPath(cx, cy, R_TICKS - 13, START, START + (END - START) * 0.5)}
            stroke="rgba(22,163,74,0.8)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={arcPath(cx, cy, R_TICKS - 13, START + (END - START) * 0.5, END)}
            stroke="rgba(239,68,68,0.8)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      <g>{majors}</g>
      <path
        d={arcPath(cx, cy, R_TICKS - 16, START, currentAngle)}
        stroke="#ef4444"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="3.8" fill="#0f172a" />
      {(() => {
        const [nx, ny] = polarToXY(cx, cy, R_TICKS - 20, currentAngle);
        return (
          <line
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke="#e5e7eb"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        );
      })()}
      <text
        x={cx}
        y={cy + 26}
        textAnchor="middle"
        fontSize="10"
        fill="#cbd5e1"
        letterSpacing=".12em"
      >
        {label}
      </text>
    </svg>
  );
}

/* ============================ Engine lights (dim) ============================ */
function EngineLightsRow() {
  const lights = [
    { label: "BREAKOUT", color: "#22c55e" },
    { label: "BUY", color: "#3b82f6" },
    { label: "SELL", color: "#ef4444" },
    { label: "EMA X", color: "#f59e0b" },
    { label: "STOP", color: "#e11d48" },
    { label: "TRAIL", color: "#a78bfa" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        justifyContent: "center",
        alignItems: "center",
        height: 60,                 // fixed light row height
        padding: "10px 12px 14px",
        boxSizing: "border-box",
      }}
    >
      {lights.map((l) => (
        <div
          key={l.label}
          title={l.label}
          style={{
            width: 26,
            height: 26,
            borderRadius: 9999,
            display: "grid",
            placeItems: "center",
            color: "#0b0b0b",
            background: l.color,
            boxShadow: "0 0 0 2px rgba(0,0,0,.4) inset",
            opacity: 0.28,
            filter: "saturate(.7) brightness(.9)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: ".04em",
              transform: "scale(.95)",
            }}
          >
            {l.label.replace(" ", "")}
          </div>
        </div>
      ))}
    </div>
  );
}
