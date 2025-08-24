// src/components/FerrariCluster.jsx
import React from "react";

/* ---------- shared helpers ---------- */
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

/* ---------- main cluster ---------- */
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
  const leftDefs  = leftKeys.map(k => ({ key:k, ...palette[k]  }));
  const rightDefs = rightKeys.map(k => ({ key:k, ...palette[k] }));

  return (
    <div
      style={{
        width: "100%", height, position: "relative", borderRadius: 18, overflow: "hidden",
        border: "1px solid #171a22",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.35)",
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,.32), rgba(0,0,0,.66)), repeating-linear-gradient(45deg, #101317 0 6px, #0b0e12 6px 12px)",
      }}
    >
      <div style={{ width: "100%", padding: "8px 14px 0 14px", height: "100%" }}>
        <div
          style={{
            maxWidth, minWidth: "min(1100px, 96vw)", margin: "0 auto", height: "100%", position: "relative",
            display: "grid", gridTemplateRows: "1fr",
            gridTemplateColumns: `
              1fr
              clamp(160px, 18vw, 260px)
              clamp(140px, 13vw, 220px)
              clamp(220px, 18vw, 300px)
              clamp(140px, 13vw, 220px)
              clamp(240px, 20vw, 320px)
              1fr
            `,
            alignItems: "center", columnGap: "clamp(6px, .8vw, 16px)",
          }}
        >
          {/* spacer left */}
          <div />

          {/* mini gauges */}
          <div style={{
            justifySelf:"start",
            display:"grid",
            gridTemplateRows:"repeat(3,1fr)",
            rowGap:"clamp(6px,1.2vw,12px)",
            alignItems:"center", justifyItems:"center",
          }}>
            <MiniGaugeBlack label="WATER" value={water} sizeCSS="clamp(88px,8vw,116px)" />
            <MiniGaugeBlack label="OIL"   value={oil}   sizeCSS="clamp(88px,8vw,116px)" />
            <MiniGaugeBlack label="FUEL"  value={fuel}  sizeCSS="clamp(88px,8vw,116px)" greenToRed />
          </div>

          {/* left lights */}
          <div style={{ alignSelf:"end", paddingBottom:8 }}>
            <LightsGroup defs={leftDefs} lights={lights} align="left" sizeCSS="clamp(40px,3.8vw,52px)" />
          </div>

          {/* RPM */}
          <div style={{ justifySelf:"center" }}>
            <FerrariRPMGauge value={rpm} max={9000} sizeCSS="clamp(220px,18vw,300px)" />
          </div>

          {/* right lights */}
          <div style={{ alignSelf:"end", paddingBottom:8 }}>
            <LightsGroup defs={rightDefs} lights={lights} align="right" sizeCSS="clamp(40px,3.8vw,52px)" />
          </div>

          {/* MPH */}
          <div style={{ justifySelf:"end" }}>
            <FerrariSpeedGauge value={speed} max={220} sizeCSS="clamp(240px,20vw,320px)" />
          </div>

          {/* spacer right */}
          <div />
        </div>
      </div>
    </div>
  );
}

/* ---------- lights ---------- */
function LightsGroup({ defs, lights, align="left", sizeCSS="48px" }) {
  return (
    <div style={{ display:"flex", gap:"clamp(8px,1vw,14px)", justifyContent:align==="left"?"flex-start":"flex-end", alignItems:"center" }}>
      {defs.map(d => {
        const on = !!lights?.[d.key];
        const isPad = !d.label;
        const active = !isPad && on;
        const bg = isPad ? "#6b7280" : d.color;
        return (
          <div key={d.key} title={d.label} style={{
            width:sizeCSS, height:sizeCSS, borderRadius:9999, display:"grid", placeItems:"center",
            color:"#0b0b0b", background:bg,
            boxShadow: active ? "0 0 14px rgba(255,255,255,.45)" : "0 0 0 3px rgba(0,0,0,.45) inset",
            opacity: active ? 1 : .35, filter: active ? "none":"saturate(.7) brightness(.9)", transition:"all 140ms ease"
          }}>
            <div style={{ fontSize:"clamp(9px,.9vw,11px)", fontWeight:800, letterSpacing:".05em", transform:"scale(.96)", userSelect:"none" }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- RPM (yellow) — small ticks, red needle, curved branding with white shadow ---------- */
function FerrariRPMGauge({ value=5200, min=0, max=9000, sizeCSS="280px" }) {
  const uid = React.useId();
  const topArcId = `rpm-top-arc-${uid}`;
  const botArcId = `rpm-bot-arc-${uid}`;

  const vb = 200, cx=100, cy=100;
  const R_TRIM = 94;            // red ring
  const R_FACE = 94;            // full yellow (no inner ring)
  const START = -120, END = 120;

  // small tick style (inside)
  const R_TICK_BASE = 98;       // tick base inside the bezel
  const R_NUM = 66;

  // branding arcs (bigger font, farther out, and visible)
  const R_LABEL_TOP = 108;
  const R_LABEL_BOT = 108;

  const t = v => (clampNum(v,min,max)-min)/(max-min);
  const angle = START + (END-START)*t(value);

  const majors=[], minors=[], nums=[];
  for (let k=0;k<=9;k++){
    const a = START + ((END-START)*(k*1000-min))/(max-min);
    const [x0,y0] = polarToXY(cx,cy,R_TICK_BASE-12,a);
    const [x1,y1] = polarToXY(cx,cy,R_TICK_BASE-2,a);
    majors.push(<line key={`maj-${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="2" />);
    const [tx,ty] = polarToXY(cx,cy,R_NUM,a);
    nums.push(<text key={`num-${k}`} x={tx} y={ty+3} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0a0a0a">{k}</text>);
  }
  for (let v=500; v<9000; v+=500){
    if (v%1000===0) continue;
    const a = START + ((END-START)*(v-min))/(max-min);
    const [x0,y0] = polarToXY(cx,cy,R_TICK_BASE-9,a);
    const [x1,y1] = polarToXY(cx,cy,R_TICK_BASE-4,a);
    minors.push(<line key={`min-${v}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.2" />);
  }

  return (
    <svg viewBox="0 0 200 200" style={{ width:sizeCSS, height:sizeCSS, overflow:"visible" }} aria-label="RPM">
      <defs>
        <path id={topArcId} d={arcPath(cx,cy,R_LABEL_TOP,-150,-30)} />
        <path id={botArcId} d={arcPath(cx,cy,R_LABEL_BOT, 30, 150)} />
      </defs>

      {/* red trim + yellow face */}
      <circle cx={cx} cy={cy} r={R_TRIM} fill="none" stroke="#dc2626" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={R_FACE-2} fill="#facc15" />

      {/* ticks + numerals */}
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>

      {/* red needle */}
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => { const [nx,ny]=polarToXY(cx,cy,R_TICK_BASE-16,angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />;
      })()}

      {/* RPM label */}
      <text x={cx} y={cy+24} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0a0a0a">RPM × 1000</text>

      {/* curved branding: white shadow behind red for 3D look */}
      {/* TOP */}
      <text fontSize="14" fontWeight="900" letterSpacing=".18em">
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle" fill="#ffffff" opacity=".7">REDLINE TRADING</textPath>
      </text>
      <text fontSize="14" fontWeight="900" letterSpacing=".18em">
        <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle" fill="#ff2f2f">REDLINE TRADING</textPath>
      </text>
      {/* BOTTOM */}
      <text fontSize="12" fontWeight="800" letterSpacing=".24em">
        <textPath href={`#${botArcId}`} startOffset="50%" textAnchor="middle" fill="#ffffff" opacity=".7">POWERED BY AI</textPath>
      </text>
      <text fontSize="12" fontWeight="800" letterSpacing=".24em">
        <textPath href={`#${botArcId}`} startOffset="50%" textAnchor="middle" fill="#ff2f2f">POWERED BY AI</textPath>
      </text>
    </svg>
  );
}

/* ---------- SPEED (red) — ticks inside, no sweep ---------- */
function FerrariSpeedGauge({ value=70, min=0, max=220, sizeCSS="300px" }) {
  const vb=220, cx=110, cy=110;
  const R_FACE=90, START=-120, END=120;

  // ticks inside face
  const R_TICK_BASE=96, R_NUM=68;
  const angle = START + (END-START)*((clampNum(value,min,max)-min)/(max-min));

  const majors=[], minors=[], nums=[];
  for(let k=0;k<=max;k+=20){
    const a=START+((END-START)*(k-min))/(max-min);
    const [x0,y0]=polarToXY(cx,cy,R_TICK_BASE-12,a);
    const [x1,y1]=polarToXY(cx,cy,R_TICK_BASE-2 ,a);
    majors.push(<line key={`M${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="2" />);
    const [tx,ty]=polarToXY(cx,cy,R_NUM,a);
    nums.push(<text key={`N${k}`} x={tx} y={ty+3} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{k}</text>);
  }
  for(let k=10;k<max;k+=10){
    if(k%20===0) continue;
    const a=START+((END-START)*(k-min))/(max-min);
    const [x0,y0]=polarToXY(cx,cy,R_TICK_BASE-9,a);
    const [x1,y1]=polarToXY(cx,cy,R_TICK_BASE-4,a);
    minors.push(<line key={`m${k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.2" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width:sizeCSS, height:sizeCSS, overflow:"visible" }} aria-label="Speed">
      <circle cx={cx} cy={cy} r={R_FACE} fill="#b91c1c" stroke="#7f1d1d" strokeWidth="8" />
      <g>{majors}</g><g>{minors}</g><g>{nums}</g>

      {/* no sweep */}

      {/* white needle */}
      <circle cx={cx} cy={cy} r="4.5" fill="#0f172a" />
      {(() => { const [nx,ny]=polarToXY(cx,cy,R_TICK_BASE-14,angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />;
      })()}
      <text x={cx} y={cy+30} textAnchor="middle" fontSize="10" fill="#ffffff" opacity=".92">MPH</text>
    </svg>
  );
}

/* ---------- mini black gauges ---------- */
function MiniGaugeBlack({ label, value=50, sizeCSS="100px", greenToRed=false }) {
  const vb=160, cx=80, cy=80;
  const R_FACE=60, R_TICKS=64, START=-120, END=120;
  const angle = START+((END-START)*clampNum(value,0,100))/100;

  const majors=[];
  for(let k=0;k<=100;k+=20){
    const a=START+((END-START)*k)/100;
    const [x0,y0]=polarToXY(cx,cy,R_TICKS-9,a);
    const [x1,y1]=polarToXY(cx,cy,R_TICKS+3,a);
    majors.push(<line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeWidth="1.8" />);
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width:sizeCSS, height:sizeCSS }} aria-label={label}>
      <circle cx={cx} cy={cy} r={R_FACE} fill="#0b0f14" stroke="#1a202a" strokeWidth="5" />
      {greenToRed && (
        <>
          <path d={arcPath(cx,cy,R_TICKS-13,START,START+(END-START)*0.5)} stroke="rgba(22,163,74,0.85)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={arcPath(cx,cy,R_TICKS-13,START+(END-START)*0.5,END)} stroke="rgba(239,68,68,0.85)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      <g>{majors}</g>

      {/* keep small mini sweep (can remove if you prefer) */}
      <path d={arcPath(cx,cy,R_TICKS-16,START,angle)} stroke="#ef4444" strokeWidth="5" fill="none" strokeLinecap="round" />

      <circle cx={cx} cy={cy} r="3.8" fill="#0f172a" />
      {(() => { const [nx,ny]=polarToXY(cx,cy,R_TICKS-20,angle);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="2.5" strokeLinecap="round" />;
      })()}
      <text x={cx} y={cy+26} textAnchor="middle" fontSize="10" fill="#cbd5e1" letterSpacing=".12em">{label}</text>
    </svg>
  );
}
