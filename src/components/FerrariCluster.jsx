import React from "react";

/** ============================== utils ============================== **/
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
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

/** ========================= main cluster ============================ **/
export default function FerrariCluster({
  // live values — replace with your feed
  rpm = 5200,         // 0..9000
  speed = 68,         // 0..220
  water = 62,         // 0..100
  oil = 55,           // 0..100
  fuel = 73,          // 0..100

  // engine lights (dimmed unless true)
  lights = {
    breakout: false,
    buy: false,
    sell: false,
    emaCross: false,
    stop: false,
    trail: false,
  },

  height = 360,       // compact so we have room for chart/journal below
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
          "radial-gradient(ellipse at center, rgba(0,0,0,.32), rgba(0,0,0,.66)), repeating-linear-gradient(45deg, #101317 0 6px, #0b0e12 6px 12px)",
      }}
    >
      {/* 3‑column cockpit layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "560px 1fr 320px",
          alignItems: "center",
          gap: 0,
          padding: "18px 18px 6px 18px",
        }}
      >
        {/* LEFT: RPM + minis stacked */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr",
            alignItems: "center",
            columnGap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <FerrariRPMGauge value={rpm} max={9000} size={240} />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateRows: "repeat(3, 1fr)",
              rowGap: 8,
              justifyItems: "start",
            }}
          >
            <MiniGaugeBlack label="WATER" value={water} size={94} />
            <MiniGaugeBlack label="OIL" value={oil} size={94} />
            <MiniGaugeBlack label="FUEL" value={fuel} size={94} greenToRed />
          </div>
        </div>

        {/* CENTER: soft vignette (badge area – optional) */}
        <div
          style={{
            height: "100%",
            display: "grid",
            placeItems: "center",
            opacity: 0.22,
            background:
              "radial-gradient(circle at center, rgba(255,255,255,.06), rgba(0,0,0,0) 60%)",
            maskImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,1), rgba(0,0,0,0.0) 70%)",
          }}
        />

        {/* RIGHT: Speed */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <FerrariSpeedGauge value={speed} max={220} size={280} />
        </div>
      </div>

      {/* Engine lights (dimmed unless lights.* = true) */}
      <EngineLightsRow lights={lights} />
    </div>
  );
}

/** =========================== RPM (yellow) ========================== **/
function FerrariRPMGauge({ value = 5200, min = 0, max = 9000, size = 240 }) {
  const vb = 200, cx = 100, cy = 100;
  const R_FACE = 84, R_TRIM = 92, R_TICKS = 88, R_NUM = 64;
  const START = -120, END = 120, R_LABEL = R_TRIM + 8;
  const t = (v) => (clamp(v, min, max) - min) / (max - min);
  const angle = START + (END - START) * t(value);
  const topArcId = "rpm-top-arc", botArcId = "rpm-bot-arc";

  const majors = [];        // 0..9 x1000
  for (let k = 0; k <= 9; k++) {
    const a = START + ((END - START) * (k * 1000 - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 10, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 6, a);
    majors.push(<line key={`maj-${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="2" />);
  }
  const minors = [];        // 100’s except where majors land
  for (let k = 0; k <= 90; k += 10) {
    if (k % 20 === 0) continue;
    const a = START + ((END - START) * (k * 100 - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 6, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 4, a);
    minors.push(<line key={`min-${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.5" />);
  }
  const numerals = [];
  for (let k = 0; k <= 9; k++) {
    const a = START + ((END - START) * (k * 1000 - min)) / (max - min);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    numerals.push(
      <text key={`num-${k}`} x={tx} y={ty + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0a0a0a">
        {k}
      </text>
    );
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} aria-label="RPM">
      <defs>
        <path id={topArcId} d={arcPath(cx, cy, R_LABEL, -150, -30)} />
        <path id={botArcId} d={arcPath(cx, cy, R_LABEL, 30, 150)} />
      </defs>

      {/* red trim + yellow face */}
      <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="#dc2626" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={R_FACE} fill="#facc15" />

      {/* white ticks + black numerals */}
      <g>{majors}</g><g>{minors}</g><g>{numerals}</g>

      {/* RED tach line */}
      <path d={arcPath(cx, cy, R_TICKS - 16, START, angle)} stroke="#ef4444" strokeWidth="6" fill="none" strokeLinecap="round" />

      {/* needle */}
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => {
        const [nx, ny] = polarToXY(cx, cy, R_TICKS - 22, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#111827" strokeWidth="3" strokeLinecap="round" />;
      })()}

      {/* label */}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#0a0a0a" opacity=".85">RPM × 1000</text>

      {/* arced branding outside the red trim */}
      <text fontSize="10" fontWeight="800" fill="#ef4444" letterSpacing=".12em">
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">REDLINE TRADING</textPath>
      </text>
      <text fontSize="9" fontWeight="700" fill="#ef4444" letterSpacing=".18em">
        <textPath href={`#${botArcId}`} startOffset="50%" textAnchor="middle">POWERED BY AI</textPath>
      </text>
    </svg>
  );
}

/** ========================= Speed (black) ========================== **/
function FerrariSpeedGauge({ value = 70, min = 0, max = 220, size = 280 }) {
  const vb = 220, cx = 110, cy = 110;
  const R_FACE = 90, R_TICKS = 94, R_NUM = 68, START = -120, END = 120;
  const angle = START + (END - START) * ((clamp(value, min, max) - min) / (max - min));

  const majors = [], minors = [], nums = [];
  for (let k = 0; k <= max; k += 20) {
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 12, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 4, a);
    majors.push(<line key={`M${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="2" />);
    const [tx, ty] = polarToXY(cx, cy, R_NUM, a);
    nums.push(<text key={`N${k}`} x={tx} y={ty + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#e7eaee">{k}</text>);
  }
  for (let k = 10; k < max; k += 10) {
    if (k % 20 === 0) continue;
    const a = START + ((END - START) * (k - min)) / (max - min);
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 7, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 2, a);
    minors.push(<line key={`m${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.5" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} aria-label="Speed">
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="6" />
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>
      <path d={arcPath(cx, cy, R_TICKS - 16, START, angle)} stroke="#ef4444" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => { const [nx, ny] = polarToXY(cx, cy, R_TICKS - 22, angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />; })()}
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="10" fill="#c9d1d9" opacity=".85">MPH</text>
    </svg>
  );
}

/** ======================== Mini black gauges ======================= **/
function MiniGaugeBlack({ label, value = 50, size = 94, greenToRed = false }) {
  const vb = 160, cx = 80, cy = 80;
  const R_FACE = 60, R_TICKS = 64, START = -120, END = 120;
  const angle = START + ((END - START) * clamp(value, 0, 100)) / 100;

  const majors = [];
  for (let k = 0; k <= 100; k += 20) {
    const a = START + ((END - START) * k) / 100;
    const [x0, y0] = polarToXY(cx, cy, R_TICKS - 9, a);
    const [x1, y1] = polarToXY(cx, cy, R_TICKS + 3, a);
    majors.push(<line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.8" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} aria-label={label}>
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="5" />
      {greenToRed && (
        <>
          <path d={arcPath(cx, cy, R_TICKS - 13, START, START + (END - START) * 0.5)} stroke="rgba(22,163,74,0.8)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={arcPath(cx, cy, R_TICKS - 13, START + (END - START) * 0.5, END)} stroke="rgba(239,68,68,0.8)" strokeWidth="3" fill="none" strokeLinecap="round" />
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

/** ========================= Engine lights row ====================== **/
function EngineLightsRow({ lights }) {
  const defs = [
    { key: "breakout", label: "BREAKOUT", color: "#22c55e" },
    { key: "buy",      label: "BUY",      color: "#3b82f6" },
    { key: "sell",     label: "SELL",     color: "#ef4444" },
    { key: "emaCross", label: "EMA X",    color: "#f59e0b" },
    { key: "stop",     label: "STOP",     color: "#e11d48" },
    { key: "trail",    label: "TRAIL",    color: "#a78bfa" },
  ];
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", padding: "10px 12px 14px" }}>
      {defs.map((d) => {
        const on = !!lights?.[d.key];
        return (
          <div key={d.key} title={d.label}
            style={{
              width: 26, height: 26, borderRadius: 9999, display: "grid", placeItems: "center",
              color: "#0b0b0b", background: d.color, boxShadow: on ? "0 0 10px rgba(255,255,255,.35)" : "0 0 0 2px rgba(0,0,0,.4) inset",
              opacity: on ? 1 : 0.28, filter: on ? "none" : "saturate(.7) brightness(.9)", transition: "all 120ms ease",
            }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".04em", transform: "scale(.95)" }}>
              {d.label.replace(" ", "")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
