import React from "react";

/**
 * FerrariCluster.jsx
 * Full Ferrari-style cluster:
 * - Carbon fiber background
 * - RPM gauge (yellow): black numerals, white ticks, red trim, RED tach sweep, arced brand text OUTSIDE the trim
 * - Speed gauge (black): white numerals/ticks, RED tach sweep
 * - Mini gauges (black): Water / Oil / Fuel — white ticks, RED sweeps
 * - Engine lights row: visible but dimmed
 *
 * Props:
 *   rpmValue, speedValue: numbers (displayed by sweeps/needles)
 *   waterValue, oilValue, fuelValue: 0..100 (percent-ish dummy scales for now)
 *   height: overall cluster height (defaults ~ 40% shorter cockpit layout)
 */
export default function FerrariCluster({
  rpmValue = 5200,
  speedValue = 68,
  waterValue = 62,
  oilValue = 55,
  fuelValue = 73,
  height = 360, // compact to free room below for chart/journal/strategies
}) {
  return (
    <div
      style={{
        width: "100%",
        height,
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
      {/* top cluster row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          padding: "18px 22px 8px 22px",
          alignItems: "center",
        }}
      >
        {/* RPM (Yellow) */}
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <FerrariRPMGauge value={rpmValue} max={9000} size={240} />
          {/* Mini gauges stack - left of speed */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              rowGap: 10,
              alignContent: "center",
            }}
          >
            <MiniGaugeBlack
              label="WATER"
              value={waterValue}
              size={90}
              suffix="%"
            />
            <MiniGaugeBlack label="OIL" value={oilValue} size={90} suffix="%" />
            <MiniGaugeBlack
              label="FUEL"
              value={fuelValue}
              size={90}
              suffix="%"
              greenToRed // draws subtle green→red arc for fuel
            />
          </div>
        </div>

        {/* Speed (Black) */}
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

      {/* bottom engine lights row — always visible but dimmed */}
      <EngineLightsRow />
    </div>
  );
}

/* =======================================================================================
   Core SVG utilities
======================================================================================= */
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

/* =======================================================================================
   Ferrari RPM Gauge (Yellow face, white ticks, black numerals, red trim, RED sweep)
   Brand text OUTSIDE the red trim: "REDLINE TRADING" / "POWERED BY AI"
======================================================================================= */
function FerrariRPMGauge({ value = 5200, min = 0, max = 9000, size = 240 }) {
  const vb = 200;
  const cx = 100,
    cy = 100;
  const R_FACE = 84;
  const R_TRIM = 92;
  const R_TICKS = 88;
  const R_NUM = 64;
  const START = -120;
  const END = 120;
  const R_LABEL = R_TRIM + 8;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const t = (v) => (clamp(v, min, max) - min) / (max - min);
  const currentAngle = START + (END - START) * t(value);
  const topArcId = "rpm-top-arc";
  const botArcId = "rpm-bot-arc";

  // majors 0..9 (x1000)
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
        stroke="#ffffff"
        strokeWidth="2"
      />
    );
  }
  // minors every 100 except where majors land
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
        stroke="#ffffff"
        strokeWidth="1.5"
      />
    );
  }
  // numerals
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
    >
      <defs>
        <path id={topArcId} d={arcPath(cx, cy, R_LABEL, -150, -30)} />
        <path id={botArcId} d={arcPath(cx, cy, R_LABEL, 30, 150)} />
      </defs>

      {/* red outer trim */}
      <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="#dc2626" strokeWidth="8" />
      {/* yellow face */}
      <circle cx={cx} cy={cy} r={R_FACE} fill="#facc15" />

      {/* ticks + numerals */}
      <g>{majors}</g>
      <g>{minors}</g>
      <g>{numerals}</g>

      {/* red tach sweep (START -> current) */}
      <path
        d={arcPath(cx, cy, R_TICKS - 16, START, currentAngle)}
        stroke="#ef4444"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />

      {/* needle */}
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

      {/* RPM label */}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#0a0a0a" opacity=".85">
        RPM × 1000
      </text>

      {/* Brand text OUTSIDE the red trim */}
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

/* =======================================================================================
   Ferrari Speed Gauge (Black face, white ticks/numerals, RED sweep)
======================================================================================= */
function FerrariSpeedGauge({ value = 70, min = 0, max = 220, size = 260 }) {
  const vb = 220;
  const cx = 110,
    cy = 110;
  const R_FACE = 90;
  const R_TICKS = 94;
  const R_NUM = 68;
  const START = -120;
  const END = 120;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const t = (v) => (clamp(v, min, max) - min) / (max - min);
  const currentAngle = START + (END - START) * t(value);

  // majors every 20
  const majors = [];
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
        stroke="#ffffff"
        strokeWidth="2"
      />
    );
  }
  // minors every 10
  const minors = [];
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
        stroke="#ffffff"
        strokeWidth="1.5"
      />
    );
  }
  // numerals every 20
  const numerals = [];
  for (let k = 0; k <= max; k += 20) {
    const a = START + ((END - START) * (k - min)) / (max - min);
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

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      width={size}
      height={size}
      role="img"
      aria-label="Speed Gauge"
    >
      {/* black face */}
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="6" />
      {/* ticks + numerals */}
      <g>{majors}</g>
      <g>{minors}</g>
      <g>{numerals}</g>
      {/* red sweep */}
      <path
        d={arcPath(cx, cy, R_TICKS - 16, START, currentAngle)}
        stroke="#ef4444"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* needle */}
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

/* =======================================================================================
   Mini Gauge (Black face, white ticks, RED sweep) — water / oil / fuel
======================================================================================= */
function MiniGaugeBlack({
  label = "GAUGE",
  value = 50, // 0..100 dummy percent for sweep
  size = 92,
  greenToRed = false, // fuel: green→red thin arc
}) {
  const vb = 160;
  const cx = 80,
    cy = 80;
  const R_FACE = 60;
  const R_TICKS = 64;
  const START = -120;
  const END = 120;
  const currentAngle = START + ((END - START) * Math.max(0, Math.min(100, value))) / 100;

  // simple ticks every 20%
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
        stroke="#ffffff"
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
    >
      {/* face */}
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="5" />
      {/* optional fuel arc (green->red thin) */}
      {greenToRed && (
        <>
          <path
            d={arcPath(cx, cy, R_TICKS - 13, START, START + (END - START) * 0.5)}
            stroke="rgba(22,163,74,0.8)" // green
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={arcPath(cx, cy, R_TICKS - 13, START + (END - START) * 0.5, END)}
            stroke="rgba(239,68,68,0.8)" // red
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {/* ticks */}
      <g>{majors}</g>
      {/* red sweep */}
      <path
        d={arcPath(cx, cy, R_TICKS - 16, START, currentAngle)}
        stroke="#ef4444"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* needle */}
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
      {/* label */}
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

/* =======================================================================================
   Engine lights row (dimmed by default - ready to flip "on")
======================================================================================= */
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
        padding: "10px 12px 14px",
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
            // DIMMED default:
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
