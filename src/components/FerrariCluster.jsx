// src/components/FerrariCluster.jsx
import React from "react";

/* ===================== shared helpers ===================== */
const clampNum = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const polarToXY = (cx, cy, r, angDeg) => {
  const a = ((angDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arcPath = (cx, cy, r, angA, angB) => {
  const [x0, y0] = polarToXY(cx, cy, r, angA);
  const [x1, y1] = polarToXY(cx, cy, r, angB);
  const largeArc = Math.abs(angB - angA) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
};

/* ===================== main cluster ===================== */
/**
 * Grid (5 columns):
 * [ MINIS ] [ LEFT LIGHTS ] [ RPM ] [ RIGHT LIGHTS ] [ SPEED ]
 * - Engine lights are placed in the “between” columns and bottom-aligned.
 * - RPM stays visually centered; SPEED hugs right; MINIS hug left.
 */
export default function FerrariCluster({
  rpm = 5200,
  speed = 68,
  water = 62,
  oil = 55,
  fuel = 73,

  lights = { breakout:false, buy:false, sell:false, emaCross:false, stop:false, trail:false },

  height = 340,
  // cockpit width scales (big on 31.5", conservative on smaller)
  maxWidth = "min(1900px, 98vw)",
}) {
  // split lights (half/half)
  const defs = [
    { key: "breakout", label: "BREAKOUT", color: "#22c55e" },
    { key: "buy",      label: "BUY",      color: "#3b82f6" },
    { key: "sell",     label: "SELL",     color: "#ef4444" },
    { key: "emaCross", label: "EMA X",    color: "#f59e0b" },
    { key: "stop",     label: "STOP",     color: "#e11d48" },
    { key: "trail",    label: "TRAIL",    color: "#a78bfa" },
  ];
  const half = Math.ceil(defs.length / 2);
  const leftDefs = defs.slice(0, half);
  const rightDefs = defs.slice(half);

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
          "radial-gradient(ellipse at center, rgba(0,0,0,.32), rgba(0,0,0,.66)), repeating-linear-gradient(45deg, #101317 0 6px, #0b0e12 6px 12px)",
      }}
    >
      <div style={{ width: "100%", padding: "8px 14px 0 14px", height: "100%" }}>
        <div
          style={{
            maxWidth,
            minWidth: "min(1100px, 96vw)",
            margin: "0 auto",
            height: "100%",
            position: "relative",

            /* 5-column grid to place lights in-between gauges */
            display: "grid",
            gridTemplateRows: "1fr",
            gridTemplateColumns: `
              clamp(160px, 18vw, 260px)   /* MINI column */
              clamp(120px, 12vw, 200px)   /* LEFT LIGHTS */
              clamp(260px, 22vw, 360px)   /* RPM */
              clamp(120px, 12vw, 200px)   /* RIGHT LIGHTS */
              clamp(260px, 22vw, 360px)   /* SPEED */
            `,
            alignItems: "center",
            columnGap: "clamp(8px, 1vw, 16px)",
          }}
        >
          {/* LEFT: MINI GAUGES */}
          <div
            style={{
              justifySelf: "start",
              display: "grid",
              gridTemplateRows: "repeat(3, 1fr)",
              rowGap: "clamp(6px, 1.2vw, 12px)",
              alignItems: "center",
              justifyItems: "center",
            }}
          >
            <MiniGaugeBlack label="WATER" value={water} sizeCSS="clamp(82px, 7vw, 106px)" />
            <MiniGaugeBlack label="OIL"   value={oil}   sizeCSS="clamp(82px, 7vw, 106px)" />
            <MiniGaugeBlack label="FUEL"  value={fuel}  sizeCSS="clamp(82px, 7vw, 106px)" greenToRed />
          </div>

          {/* LEFT LIGHTS (between MINIS and RPM) */}
          <div
            style={{
              alignSelf: "end",     // bottom align to gauges
              paddingBottom: 8,
            }}
          >
            <LightsGroup defs={leftDefs} lights={lights} align="left" />
          </div>

          {/* RPM (center) */}
          <div style={{ justifySelf: "center" }}>
            <FerrariRPMGauge value={rpm} max={9000} sizeCSS="clamp(260px, 22vw, 360px)" />
          </div>

          {/* RIGHT LIGHTS (between RPM and SPEED) */}
          <div
            style={{
              alignSelf: "end",
              paddingBottom: 8,
            }}
          >
            <LightsGroup defs={rightDefs} lights={lights} align="right" />
          </div>

          {/* SPEED (far right) */}
          <div style={{ justifySelf: "end" }}>
            <FerrariSpeedGauge value={speed} max={220} sizeCSS="clamp(260px, 22vw, 360px)" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== LightsGroup ===================== */
function LightsGroup({ defs, lights, align = "left" }) {
  return (
    <div
      style={{
        pointerEvents: "auto",
        display: "flex",
        gap: "clamp(6px, 0.8vw, 12px)",
        justifyContent: align === "left" ? "flex-start" : "flex-end",
        alignItems: "center",
      }}
    >
      {defs.map((d) => {
        const on = !!lights?.[d.key];
        return (
          <div
            key={d.key}
            title={d.label}
            style={{
              width: "clamp(22px, 2.1vw, 26px)",
              height: "clamp(22px, 2.1vw, 26px)",
              borderRadius: 9999,
              display: "grid",
              placeItems: "center",
              color: "#0b0b0b",
              background: d.color,
              boxShadow: on
                ? "0 0 10px rgba(255,255,255,.35)"
                : "0 0 0 2px rgba(0,0,0,.4) inset",
              opacity: on ? 1 : 0.28,
              filter: on ? "none" : "saturate(.7) brightness(.9)",
              transition: "all 120ms ease",
            }}
          >
            <div
              style={{
                fontSize: "clamp(8px, .8vw, 9px)",
                fontWeight: 800,
                letterSpacing: ".04em",
                transform: "scale(.95)",
              }}
            >
              {d.label.replace(" ", "")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== RPM (yellow) ===================== */
function FerrariRPMGauge({ value = 5200, min = 0, max = 9000, sizeCSS = "300px" }) {
  const vb = 200, cx = 100, cy = 100;
  const R_FACE = 84, R_TRIM = 94, R_TICKS = 88, R_NUM = 64;

  // Angle span & label radius
  const START = -120, END = 120;
  const t = (v) => (clampNum(v, min, max) - min) / (max - min);
  const angle = START + (END - START) * t(value);

  // Branding (outside trim) – slightly larger radius & spacing
  const R_LABEL = R_TRIM + 12;   // moved out a bit
  const topArcId = "rpm-top-arc", botArcId = "rpm-bot-arc";

  const majors = [], minors = [], nums = [];
  for (let k = 0; k <= 9; k++) {
    const a = START + ((END - START) * (k * 1000 - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 10, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 6, a);
    majors.push(<line key={`maj-${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="2" />);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    nums.push(<text key={`n-${k}`} x={tx} y={ty + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0a0a0a">{k}</text>);
  }
  for (let k = 0; k <= 90; k += 10) {
    if (k % 20 === 0) continue;
    const a = START + ((END - START) * (k * 100 - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 6, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 4, a);
    minors.push(<line key={`min-${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="1.5" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width: sizeCSS, height: sizeCSS }} aria-label="RPM">
      <defs>
        {/* arcs for outside branding */}
        <path id={topArcId} d={arcPath(cx, cy, R_LABEL, -150, -30)} />
        <path id={botArcId} d={arcPath(cx, cy, R_LABEL, 30, 150)} />
      </defs>

      {/* red outer trim + yellow face */}
      <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="#dc2626" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={R_FACE} fill="#facc15" />

      {/* ticks + numerals */}
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>

      {/* RED tach sweep */}
      <path d={arcPath(cx, cy, R_TICKS - 16, START, angle)} stroke="#ef4444" strokeWidth="6" fill="none" strokeLinecap="round" />

      {/* needle */}
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TICKS - 22, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#111827" strokeWidth="3" strokeLinecap="round" />; })()}

      {/* label */}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#0a0a0a" opacity=".85">RPM × 1000</text>

      {/* branding (outside trim, more spacing, no overlap) */}
      <text fontSize="11" fontWeight="900" fill="#ff3b30" letterSpacing=".14em">
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">REDLINE TRADING</textPath>
      </text>
      <text fontSize="10" fontWeight="800" fill="#ff3b30" letterSpacing=".22em">
        <textPath href={`#${botArcId}`} startOffset="50%" textAnchor="middle">POWERED BY AI</textPath>
      </text>
    </svg>
  );
}

/* ===================== Speed (Ferrari RED face) ===================== */
function FerrariSpeedGauge({ value = 70, min = 0, max = 220, sizeCSS = "300px" }) {
  const vb = 220, cx = 110, cy = 110;
  const R_FACE = 90, R_TICKS = 94, R_NUM = 68, START = -120, END = 120;
  const angle = START + (END - START) * ((clampNum(value, min, max) - min) / (max - min));

  const majors = [], minors = [], nums = [];
  for (let k = 0; k <= max; k += 20) {
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 12, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 4, a);
    majors.push(<line key={`M${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="2" />);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    nums.push(<text key={`N${k}`} x={tx} y={ty + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">{k}</text>);
  }
  for (let k = 10; k < max; k += 10) {
    if (k % 20 === 0) continue;
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 7, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 2, a);
    minors.push(<line key={`m${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="1.5" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width: sizeCSS, height: sizeCSS }} aria-label="Speed">
      <circle cx={cx} cy={cy} r={R_FACE} fill="#b91c1c" stroke="#7f1d1d" strokeWidth="8" />
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>
      <path d={arcPath(cx, cy, R_TICKS - 16, START, angle)} stroke="#ef4444" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TICKS - 22, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />; })()}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#ffffff" opacity=".92">MPH</text>
    </svg>
  );
}

/* ===================== Mini black gauges ===================== */
function MiniGaugeBlack({ label, value = 50, sizeCSS = "100px", greenToRed = false }) {
  const vb = 160, cx = 80, cy = 80;
  const R_FACE = 60, R_TICKS = 64, START = -120, END = 120;
  const angle = START + ((END - START) * clampNum(value, 0, 100)) / 100;

  const majors = [];
  for (let k = 0; k <= 100; k += 20) {
    const a = START + ((END - START) * k) / 100;
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 9, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 3, a);
    majors.push(<line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="1.8" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width: sizeCSS, height: sizeCSS }} aria-label={label}>
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="5" />
      {greenToRed && (
        <>
          <path d={arcPath(cx, cy, R_TICKS - 13, START, START + (END - START) * 0.5)} stroke="rgba(22,163,74,0.85)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={arcPath(cx, cy, R_TICKS - 13, START + (END - START) * 0.5, END)} stroke="rgba(239,68,68,0.85)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      <g>{majors}</g>
      <path d={arcPath(cx, cy, R_TICKS - 16, START, angle)} stroke="#ef4444" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.8" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TICKS - 20, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="2.5" strokeLinecap="round" />; })()}
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize="10" fill="#cbd5e1" letterSpacing=".12em">{label}</text>
    </svg>
  );
}
