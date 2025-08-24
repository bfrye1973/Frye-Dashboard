// src/components/FerrariCluster.jsx
import React from "react";

/* ------------------ helpers ------------------ */
const clampNum = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const polarToXY = (cx, cy, r, angDeg) => {
  const a = ((angDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polarToXY(cx, cy, r, a0);
  const [x1, y1] = polarToXY(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
};

/* ------------------ main cluster ------------------ */
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
  const leftKeys  = ["breakout", "buy", "sell", "emaCross", "stop"];
  const rightKeys = ["trail", "pad1", "pad2", "pad3", "pad4"];
  const palette = {
    breakout: { label: "BREAK", color: "#22c55e" },
    buy:      { label: "BUY",   color: "#3b82f6" },
    sell:     { label: "SELL",  color: "#ef4444" },
    emaCross: { label: "EMA X", color: "#f59e0b" },
    stop:     { label: "STOP",  color: "#e11d48" },
    trail:    { label: "TRAIL", color: "#a78bfa" },
    pad1:     { label: "",      color: "#6b7280" },
    pad2:     { label: "",      color: "#6b7280" },
    pad3:     { label: "",      color: "#6b7280" },
    pad4:     { label: "",      color: "#6b7280" },
  };
  const leftDefs  = leftKeys.map(k  => ({ key:k,  ...palette[k] }));
  const rightDefs = rightKeys.map(k => ({ key:k, ...palette[k] }));

  return (
    <div
      style={{
        width: "100%",
        height,
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid #171a22",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.35)",
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
            display: "grid",
            gridTemplateRows: "1fr",
            gridTemplateColumns: `
              1fr
              clamp(160px, 18vw, 260px)
              clamp(140px, 13vw, 220px)
              clamp(220px, 18vw, 300px)
              clamp(140px, 13vw, 220px)
              clamp(240px, 20vw, 320px)
              1fr
            `,
            alignItems: "center",
            columnGap: "clamp(6px, .8vw, 16px)",
          }}
        >
          {/* spacer left */}
          <div />

          {/* MINI GAUGES */}
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
            <MiniGauge label="WATER" value={water} sizeCSS="clamp(88px, 8vw, 116px)" />
            <MiniGauge label="OIL"   value={oil}   sizeCSS="clamp(88px, 8vw, 116px)" />
            <MiniGauge label="FUEL"  value={fuel}  sizeCSS="clamp(88px, 8vw, 116px)" greenToRed />
          </div>

          {/* LEFT LIGHTS (x5) */}
          <div style={{ alignSelf: "end", paddingBottom: 8 }}>
            <Lights defs={leftDefs} lights={lights} align="left" sizeCSS="clamp(40px, 3.8vw, 52px)" />
          </div>

          {/* RPM CENTER */}
          <div style={{ justifySelf: "center" }}>
            <RPMGauge value={rpm} max={9000} sizeCSS="clamp(220px, 18vw, 300px)" />
          </div>

          {/* RIGHT LIGHTS (x5) */}
          <div style={{ alignSelf: "end", paddingBottom: 8 }}>
            <Lights defs={rightDefs} lights={lights} align="right" sizeCSS="clamp(40px, 3.8vw, 52px)" />
          </div>

          {/* MPH RIGHT */}
          <div style={{ justifySelf: "end" }}>
            <MPHGauge value={speed} max={220} sizeCSS="clamp(240px, 20vw, 320px)" />
          </div>

          {/* spacer right */}
          <div />
        </div>
      </div>
    </div>
  );
}

/* ------------------ engine lights ------------------ */
function Lights({ defs, lights, align = "left", sizeCSS = "48px" }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "clamp(8px, 1vw, 14px)",
        justifyContent: align === "left" ? "flex-start" : "flex-end",
        alignItems: "center",
      }}
    >
      {defs.map((d) => {
        const on = !!lights?.[d.key];
        const isPad = !d.label;
        const active = !isPad && on;
        const bg = isPad ? "#6b7280" : d.color;
        return (
          <div
            key={d.key}
            style={{
              width: sizeCSS,
              height: sizeCSS,
              borderRadius: 9999,
              display: "grid",
              placeItems: "center",
              color: "#0b0b0b",
              background: bg,
              boxShadow: active ? "0 0 14px rgba(255,255,255,.45)" : "0 0 0 3px rgba(0,0,0,.45) inset",
              opacity: active ? 1 : 0.35,
              filter: active ? "none" : "saturate(.7) brightness(.9)",
              transition: "all 140ms ease",
            }}
          >
            <div style={{ fontSize: "clamp(9px, .9vw, 11px)", fontWeight: 800, letterSpacing: ".05em" }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------ RPM (yellow) ------------------ */
/* small inside ticks, red needle, curved TOP/BOTTOM branding with white stroke (3D), no inner ring, no sweep */
function RPMGauge({ value = 5200, min = 0, max = 9000, sizeCSS = "280px" }) {
  const uid = React.useId();
  const topArcId = `rpm-top-arc-${uid}`;
  const botArcId = `rpm-bot-arc-${uid}`;

  const cx = 100, cy = 100, vb = 200;
  const R_TRIM = 94;            // red ring
  const R_FACE = 94;            // yellow to ring edge (no inner ring)
  const START = -120, END = 120;

  const R_TB = 98;              // tick base inside bezel
  const R_NUM = 66;             // numerals

  const R_LABEL = 108;          // branding radius
  const t = (v) => (clampNum(v, min, max) - min) / (max - min);
  const angle = START + (END - START) * t(value);

  // small clean ticks
  const majors = [], minors = [], nums = [];
  for (let k = 0; k <= 9; k++) {
    const a = START + ((END - START) * (k * 1000 - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TB - 12, a);
    const [x1, y1] = polarToXY(cx, cy, R_TB - 2,  a);
    majors.push(<line key={`maj-${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="2" />);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    nums.push(<text key={`n-${k}`} x={tx} y={ty + 3} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0a0a0a">{k}</text>);
  }
  for (let v = 500; v < 9000; v += 500) {
    if (v % 1000 === 0) continue;
    const a = START + ((END - START) * (v - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TB - 9, a);
    const [x1, y1] = polarToXY(cx, cy, R_TB - 4, a);
    minors.push(<line key={`min-${v}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.2" />);
  }

  return (
    <svg viewBox="0 0 200 200" style={{ width: sizeCSS, height: sizeCSS, overflow: "visible" }} aria-label="RPM">
      <defs>
        {/* top arc across the top semicircle (180 -> 0) */}
        <path id={topArcId} d={arc(cx, cy, R_LABEL, 180, 0)} />
        {/* bottom arc across bottom semicircle (0 -> 180) */}
        <path id={botArcId} d={arc(cx, cy, R_LABEL, 0, 180)} />
      </defs>

      {/* bezel + face */}
      <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="#dc2626" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={R_FACE - 2} fill="#facc15" />

      {/* ticks + numerals */}
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>

      {/* red needle */}
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TB - 16, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />;
      })()}

      {/* inside label */}
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0a0a0a">RPM × 1000</text>

      {/* TOP branding with white stroke behind red (3D) */}
      <text fontSize="18" fontWeight="900" letterSpacing=".20em"
            stroke="#ffffff" strokeWidth="1.6" paintOrder="stroke fill">
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle" fill="#ff2f2f">
          REDLINE TRADING
        </textPath>
      </text>

      {/* BOTTOM branding with white stroke behind red */}
      <text fontSize="14" fontWeight="800" letterSpacing=".26em"
            stroke="#ffffff" strokeWidth="1.4" paintOrder="stroke fill">
        <textPath href={`#${botArcId}`} startOffset="50%" textAnchor="middle" fill="#ff2f2f">
          POWERED BY AI
        </textPath>
      </text>
    </svg>
  );
}

/* ------------------ MPH (red) — ticks inside, white needle, no sweep ------------------ */
function MPHGauge({ value = 70, min = 0, max = 220, sizeCSS = "300px" }) {
  const cx = 110, cy = 110, vb = 220, R_FACE = 90;
  const START = -120, END = 120, R_TB = 96, R_NUM = 68;
  const angle = START + (END - START) * ((clampNum(value, min, max) - min) / (max - min));

  const majors = [], minors = [], nums = [];
  for (let k = 0; k <= max; k += 20) {
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TB - 12, a);
    const [x1, y1] = polarToXY(cx, cy, R_TB - 2,  a);
    majors.push(<line key={`M${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="2" />);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    nums.push(<text key={`N${k}`} x={tx} y={ty + 3} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{k}</text>);
  }
  for (let k = 10; k < max; k += 10) {
    if (k % 20 === 0) continue;
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TB - 9, a);
    const [x1, y1] = polarToXY(cx, cy, R_TB - 4, a);
    minors.push(<line key={`m${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.2" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width: sizeCSS, height: sizeCSS, overflow:"visible" }} aria-label="MPH">
      <circle cx={cx} cy={cy} r={R_FACE} fill="#b91c1c" stroke="#7f1d1d" strokeWidth="8" />
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>

      {/* white needle */}
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TB - 14, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="3" strokeLinecap="round" />;
      })()}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#ffffff" opacity=".92">MPH</text>
    </svg>
  );
}

/* ------------------ MINI black gauge ------------------ */
function MiniGauge({ label, value = 50, sizeCSS = "100px", greenToRed = false }) {
  const cx = 80, cy = 80, vb = 160, R_FACE = 60, R_TICKS = 64, START = -120, END = 120;
  const angle = START + ((END - START) * clampNum(value, 0, 100)) / 100;

  const majors = [];
  for (let k = 0; k <= 100; k += 20) {
    const a = START + ((END - START) * k) / 100;
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 9, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 3, a);
    majors.push(<line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.8" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width: sizeCSS, height: sizeCSS }} aria-label={label}>
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="5" />
      {greenToRed && (
        <>
          <path d={arc(cx, cy, R_TICKS - 13, START, START + (END - START) * 0.5)} stroke="rgba(22,163,74,0.85)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={arc(cx, cy, R_TICKS - 13, START + (END - START) * 0.5, END)} stroke="rgba(239,68,68,0.85)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      <g>{majors}</g>
      {/* keep small mini sweep for vibe */}
      <path d={arc(cx, cy, R_TICKS - 16, START, angle)} stroke="#ef4444" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.8" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TICKS - 20, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="2.5" strokeLinecap="round" />;
      })()}
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize="10" fill="#cbd5e1" letterSpacing=".12em">{label}</text>
    </svg>
  );
}
