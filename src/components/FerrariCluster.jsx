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
 * Grid (7 columns):
 * [ SPACER ] [ MINIS ] [ LEFT LIGHTS ] [ RPM ] [ RIGHT LIGHTS ] [ SPEED ] [ SPACER ]
 * Lights are bottom-aligned and positioned in the gaps between minis↔RPM and RPM↔SPEED.
 */
export default function FerrariCluster({
  rpm = 5200,
  speed = 68,
  water = 62,
  oil = 55,
  fuel = 73,

  lights = { breakout:false, buy:false, sell:false, emaCross:false, stop:false, trail:false },

  height = 340,
  maxWidth = "min(1900px, 98vw)",
}) {
  // split the lights 3/3
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

            display: "grid",
            gridTemplateRows: "1fr",
            gridTemplateColumns: `
              1fr                                        /* spacer left  */
              clamp(160px, 18vw, 260px)                  /* minis        */
              clamp(110px, 11vw, 180px)                  /* left-lights  */
              clamp(220px, 18vw, 300px)                  /* RPM (smaller for branding) */
              clamp(110px, 11vw, 180px)                  /* right-lights */
              clamp(240px, 20vw, 320px)                  /* speed        */
              1fr                                        /* spacer right */
            `,
            alignItems: "center",
            columnGap: "clamp(6px, .8vw, 14px)",
          }}
        >
          {/* [0] spacer left */}
          <div />

          {/* [1] minis (left) */}
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

          {/* [2] left-lights (between minis and RPM) */}
          <div style={{ alignSelf: "end", paddingBottom: 8 }}>
            <LightsGroup defs={leftDefs} lights={lights} align="left" />
          </div>

          {/* [3] RPM (center column) */}
          <div style={{ justifySelf: "center" }}>
            <FerrariRPMGauge value={rpm} max={9000} sizeCSS="clamp(220px, 18vw, 300px)" />
          </div>

          {/* [4] right-lights (between RPM and SPEED) */}
          <div style={{ alignSelf: "end", paddingBottom: 8 }}>
            <LightsGroup defs={rightDefs} lights={lights} align="right" />
          </div>

          {/* [5] speed (right) */}
          <div style={{ justifySelf: "end" }}>
            <FerrariSpeedGauge value={speed} max={220} sizeCSS="clamp(240px, 20vw, 320px)" />
          </div>

          {/* [6] spacer right */}
          <div />
        </div>
      </div>
    </div>
  );
}

/* ===================== engine lights (in-between) ===================== */
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

/* ===================== RPM (yellow) — small ticks, no sweep, RPM label, bigger branding ===================== */
function FerrariRPMGauge({ value = 5200, min = 0, max = 9000, sizeCSS = "300px" }) {
  const uid = React.useId(); // unique textPath IDs
  const topArcId = `rpm-top-arc-${uid}`;
  const botArcId = `rpm-bot-arc-${uid}`;

  const vb = 200, cx = 100, cy = 100;

  // Outer bezel and face
  const R_TRIM = 94;   // red trim outer radius
  const R_FACE = 94;   // yellow fills to trim (no inner black ring)
  const START = -120, END = 120;

  // Ticks placement (back to smaller style)
  const R_TICK_BASE = 96;    // tick base radius (inside trim edge)
  const R_NUM = 66;          // numeral radius

  // Branding arcs — larger font, farther out, but keep within visible area
  const R_LABEL = 110; // push outside; SVG has overflow:visible so it won't clip

  const t = (v) => (clampNum(v, min, max) - min) / (max - min);
  const angle = START + (END - START) * t(value);

  const majors = [], minors = [], nums = [];
  // MAJORS every 1000
  for (let k = 0; k <= 9; k++) {
    const a = START + ((END - START) * (k * 1000 - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICK_BASE - 10, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICK_BASE + 3,  a);
    majors.push(<line key={`maj-${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="2.2" />);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    nums.push(<text key={`num-${k}`} x={tx} y={ty + 3} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0a0a0a">{k}</text>);
  }
  // MINORS every 500, shorter
  for (let v = 500; v < 9000; v += 500) {
    if (v % 1000 === 0) continue;
    const a = START + ((END - START) * (v - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICK_BASE - 7, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICK_BASE + 1, a);
    minors.push(<line key={`min-${v}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="1.2" />);
  }

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      style={{ width: sizeCSS, height: sizeCSS, overflow: "visible" }}
      aria-label="RPM"
    >
      <defs>
        <path id={topArcId} d={arcPath(cx, cy, R_LABEL, -150, -30)} />
        <path id={botArcId} d={arcPath(cx, cy, R_LABEL, 30, 150)} />
      </defs>

      {/* red trim + full yellow face (no inner ring) */}
      <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="#dc2626" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={R_FACE - 2} fill="#facc15" />

      {/* ticks + numerals (smaller style) */}
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>

      {/* NO sweep trace */}

      {/* needle */}
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => {
        const [nx, ny] = polarToXY(cx, cy, R_TICK_BASE - 12, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#111827" strokeWidth="3" strokeLinecap="round" />;
      })()}

      {/* Inside label */}
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0a0a0a">
        RPM × 1000
      </text>

      {/* Outside branding, larger font, comfortably out from the trim */}
      <text fontSize="13" fontWeight="900" fill="#ff3b30" letterSpacing=".16em">
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">REDLINE TRADING</textPath>
      </text>
      <text fontSize="11" fontWeight="800" fill="#ff3b30" letterSpacing=".24em">
        <textPath href={`#${botArcId}`} startOffset="50%" textAnchor="middle">POWERED BY AI</textPath>
      </text>
    </svg>
  );
}

/* ===================== SPEED (Ferrari red face) — small ticks, no sweep ===================== */
function FerrariSpeedGauge({ value = 70, min = 0, max = 220, sizeCSS = "300px" }) {
  const vb = 220, cx = 110, cy = 110;
  const R_FACE = 90, START = -120, END = 120;

  // Keep tick style consistent with “smaller” look
  const R_TICK_BASE = 100;  // just outside the red face
  const R_NUM = 68;
  const angle = START + (END - START) * ((clampNum(value, min, max) - min) / (max - min));

  const majors = [], minors = [], nums = [];
  for (let k = 0; k <= max; k += 20) {
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICK_BASE - 10, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICK_BASE + 3,  a);
    majors.push(<line key={`M${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="2.2" />);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    nums.push(<text key={`N${k}`} x={tx} y={ty + 3} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">{k}</text>);
  }
  for (let k = 10; k < max; k += 10) {
    if (k % 20 === 0) continue;
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICK_BASE - 7, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICK_BASE + 1, a);
    minors.push(<line key={`m${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeWidth="1.2" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width: sizeCSS, height: sizeCSS, overflow: "visible" }} aria-label="Speed">
      <circle cx={cx} cy={cy} r={R_FACE} fill="#b91c1c" stroke="#7f1d1d" strokeWidth="8" />
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>

      {/* NO sweep */}

      {/* needle */}
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TICK_BASE - 15, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />; })()}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#ffffff" opacity=".92">MPH</text>
    </svg>
  );
}

/* ===================== MINI black gauges ===================== */
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
      {/* mini sweep kept; if you also want it removed here, we can remove */}
      <path d={arcPath(cx, cy, R_TICKS - 16, START, angle)} stroke="#ef4444" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.8" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TICKS - 20, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="2.5" strokeLinecap="round" />; })()}
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize="10" fill="#cbd5e1" letterSpacing=".12em">{label}</text>
    </svg>
  );
}
