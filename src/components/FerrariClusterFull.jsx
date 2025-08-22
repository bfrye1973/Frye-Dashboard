// src/components/FerrariClusterFull.jsx
// Ferrari cluster – full visual replica (static needles, no data yet).
// - Center yellow tach: black numerals, red perimeter ring under ticks, red band 8..10,
//   curved arc text: REDLINE TRADING (top), POWERED BY AI (bottom).
// - Right red speedometer: white numerals.
// - Left two mini-gauges: water temp, oil pressure.
// - Carbon-fiber housing with bezels + glass gloss.
// - Trading “engine lights” row centered (two demo lights ON); others hidden.

import React, { useMemo } from "react";

const toRad = (deg) => (deg - 90) * Math.PI / 180;
const point = (cx, cy, deg, r) => [cx + r * Math.cos(toRad(deg)), cy + r * Math.sin(toRad(deg))];
const arcPath  = (cx, cy, r, startDeg, endDeg) => {
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  const [x1,y1] = point(cx, cy, startDeg, r);
  const [x2,y2] = point(cx, cy, endDeg, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

// ---------- Main big gauge ----------
function BigGauge({
  size = 300,
  face = "yellow",                      // "yellow" | "red"
  label = "RPM",
  numerals = [],
  numeralsColor = "#0b1220",
  redPerimeter = false,                 // thin ring under ticks (tach)
  redBandStartDeg = null,               // inner red band (8..10 region)
  needleDeg = -120,                     // static angle
  accent = "#f59e0b",                   // needle color
  topArcText,                           // { text, color, stroke }
  bottomArcText,                        // { text, color, stroke }
}) {
  const W = size, H = size, cx = W/2, cy = H/2;
  const rFace = size * 0.38;

  // Ticks
  const majorAngles = useMemo(() => Array.from({length:9}, (_,i) => -120 + i*30), []);
  const minorAngles = useMemo(() => {
    const arr = [];
    for (let a=-110; a<=110; a+=10) if (a % 30 !== 0) arr.push(a);
    return arr;
  }, []);

  const [nx, ny] = point(cx, cy, needleDeg, rFace * 0.86);
  const topPath    = arcPath(cx, cy, rFace * 0.88, -110, 110);
  const bottomPath = arcPath(cx, cy, rFace * 0.68, 110, -110);

  const faceFill = face === "yellow" ? "url(#faceYellowG)" : "url(#faceRedG)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: "block" }}>
      <defs>
        {/* carbon fiber */}
        <pattern id="cfG" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2" />
        </pattern>
        {/* deep steel bezel */}
        <linearGradient id="bezelG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#3a4757" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        {/* faces */}
        <radialGradient id="faceYellowG" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ffe261" />
          <stop offset="82%" stopColor="#f5b500" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="faceRedG" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ff5252" />
          <stop offset="82%" stopColor="#cf2a2a" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        {/* glass gloss */}
        <radialGradient id="glassG" cx="45%" cy="25%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.26)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>

        {/* curved text paths */}
        <path id="gTopPath" d={topPath} />
        <path id="gBottomPath" d={bottomPath} />
      </defs>

      {/* Carbon-fiber + bezel + recess shadow */}
      <circle cx={cx} cy={cy} r={rFace*1.40} fill="url(#cfG)" />
      <circle cx={cx} cy={cy} r={rFace*1.34} fill="url(#bezelG)" stroke="#0b1220" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={rFace*1.08} fill="none" style={{ filter:"drop-shadow(0 9px 18px rgba(0,0,0,0.7))" }} />

      {/* face */}
      <circle cx={cx} cy={cy} r={rFace} fill={faceFill} stroke="#0b1220" strokeWidth="1" />

      {/* thin red perimeter ring under ticks (tach) */}
      {redPerimeter && (
        <path d={arcPath(cx,cy, rFace*0.96, -120, 120)}
              stroke="#ef4444" strokeWidth={8} fill="none" strokeLinecap="round" opacity="0.9" />
      )}

      {/* major ticks */}
      {majorAngles.map(a => {
        const p1 = point(cx, cy, a, rFace*0.95);
        const p2 = point(cx, cy, a, rFace*0.78);
        return <line key={"M"+a} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#e5e7eb" strokeWidth="3" opacity="0.95" />;
      })}
      {/* minor ticks */}
      {minorAngles.map(a => {
        const p1 = point(cx, cy, a, rFace*0.95);
        const p2 = point(cx, cy, a, rFace*0.86);
        return <line key={"m"+a} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#ffffff" strokeWidth="1.3" opacity="0.80" />;
      })}

      {/* numerals */}
      {numerals.map((n, i) => {
        const pt = point(cx, cy, n.angleDeg, rFace*0.63);
        return (
          <text key={i} x={pt[0]} y={pt[1]+6} textAnchor="middle"
                fill={n.color || numeralsColor}
                fontSize={n.fontSize || 16} fontWeight="700">
            {n.text}
          </text>
        );
      })}

      {/* inner red band for tach (8..10) */}
      {redBandStartDeg !== null && (
        <path d={arcPath(cx,cy, rFace*0.94, redBandStartDeg, 120)}
              stroke="#ef4444" strokeWidth={12} fill="none" strokeLinecap="round" />
      )}

      {/* needle + hub */}
      {(() => {
        const [nx, ny] = point(cx, cy, needleDeg, rFace*0.86);
        return (
          <>
            <line x1={cx} y1={cy} x2={nx} y2={ny}
                  stroke={face==="yellow" ? "#f59e0b" : "#ef4444"}
                  strokeWidth="6.6" strokeLinecap="round"
                  style={{ filter:"drop-shadow(0 0 8px rgba(239,68,68,0.4))" }} />
            <circle cx={cx} cy={cy} r="8.5" fill="#e5e7eb" stroke="#0b1220" strokeWidth="1.3"/>
          </>
        );
      })()}

      {/* glass gloss */}
      <ellipse cx={cx} cy={cy-20} rx={rFace*0.96} ry={rFace*0.36} fill="url(#glassG)" opacity="0.55" />

      {/* label (black as requested) */}
      <text x={cx} y={cy+40} textAnchor="middle" fill="#0b1220" fontSize="13" fontWeight="700">{label}</text>
    </svg>
  );
}

// ---------- Mini gauge (left column) ----------
function MiniGauge({ label="TEMP", valueText="210°F" }) {
  return (
    <div style={miniWrap}>
      <div style={miniFace}>
        <div style={miniGlass}/>
        <div style={miniTicks}/>
      </div>
      <div style={miniLabel}>{label}</div>
      <div style={miniValue}>{valueText}</div>
    </div>
  );
}

// ---------- Engine lights (centered row; two demo ON) ----------
function EngineLightsDemo() {
  const Light = ({ emoji, color }) => (
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      background: "rgba(2,6,23,0.85)",
      border: `2px solid ${color}`,
      boxShadow: `0 0 12px ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 16,
    }}>
      <span>{emoji}</span>
    </div>
  );
  return (
    <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop: 8 }}>
      <Light emoji="📈" color="#22c55e" /> {/* Breakout */}
      <Light emoji="📉" color="#ef4444" /> {/* Distribution */}
    </div>
  );
}

// ---------- Full cluster (static preview) ----------
export default function FerrariClusterFull({
  // Needle angles (static)
  rpmNeedleDeg   =  10,   // tach ~3.5k
  speedNeedleDeg = -20,   // speed ~40
}) {
  // Tach numerals 1..10 (black)
  const tachLabels = useMemo(() =>
    Array.from({length:10}, (_,i)=>{
      const num=i+1; const t=(num-1)/9; const a=-120 + t*240;
      return { angleDeg:a, text:String(num), color:"#0b1220", fontSize:18 };
    })
  ,[]);

  // Speed numerals 20..220 (white)
  const speedLabels = useMemo(() =>
    Array.from({length:11}, (_,i)=>{
      const val=(i+1)*20; const t=i/10; const a=-120 + t*240;
      return { angleDeg:a, text:String(val), color:"#ffffff", fontSize:15 };
    })
  ,[]);

  return (
    <div style={clusterWrap}>
      {/* Header strip (carbon-fiber, watermark area) */}
      <div style={header}>
        <div style={headerGloss}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:12, letterSpacing:1.2, textTransform:"uppercase", opacity:0.75 }}>
            Ferrari Cluster — Static Visual
          </div>
          <div style={{ opacity:0.22 }}>
            {/* optional logo watermark position */}
          </div>
        </div>
      </div>

      {/* Row: mini-gauges (left) + big tach (center) + speedo (right) */}
      <div style={row}>
        <div style={leftCol}>
          <MiniGauge label="WATER" valueText="210°F" />
          <MiniGauge label="OIL"   valueText="70 psi" />
        </div>

        <div style={{ transform:"scale(1.08)" }}>
          <BigGauge
            size={310}
            face="yellow"
            label="RPM"
            numerals={tachLabels}
            numeralsColor="#0b1220"
            redPerimeter
            redBandStartDeg={80}
            needleDeg={rpmNeedleDeg}
            accent="#f59e0b"
          />
        </div>

        <div style={{ transform:"scale(0.96)" }}>
          <BigGauge
            size={260}
            face="red"
            label="SPEED"
            numerals={speedLabels}
            numeralsColor="#ffffff"
            needleDeg={speedNeedleDeg}
            accent="#ef4444"
          />
        </div>
      </div>

      {/* Engine lights row (demo: two on) */}
      <EngineLightsDemo />
    </div>
  );
}

// ---------- styles ----------
const clusterWrap = {
  position:"relative",
  margin:"12px 12px 12px",
  padding:"0 16px 12px",
  background:"#0b1220",
  borderRadius:16,
  border:"1px solid #1f2a44",
  boxShadow:"inset 0 0 38px rgba(0,0,0,0.55), 0 6px 20px rgba(0,0,0,0.45)",
  overflow:"hidden",
};

const header = {
  position:"relative",
  borderBottom:"1px solid #1f2a44",
  padding:"10px 14px",
  background:
    `repeating-linear-gradient(45deg, #0b1220 0 2px, #0f172a 2px 4px),
     repeating-linear-gradient(-45deg, #0b1220 0 2px, #0f172a 2px 4px)`,
  backgroundBlendMode:"multiply",
};
const headerGloss = {
  position:"absolute", left:0, right:0, top:0, height:40,
  background:"linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
  borderBottom:"1px solid rgba(255,255,255,0.06)", pointerEvents:"none"
};

const row = {
  marginTop:10,
  display:"grid",
  gridTemplateColumns:"190px 1fr 1fr",
  gap:20,
  alignItems:"center",
  justifyItems:"center",
};

const leftCol = {
  display:"flex",
  flexDirection:"column",
  gap:10,
  alignItems:"center",
};

// Mini-gauge styles
const miniWrap = {
  width:150,
  height:90,
  borderRadius:12,
  background:"#0b1220",
  border:"1px solid #1f2a44",
  boxShadow:"inset 0 0 18px rgba(0,0,0,0.5)",
  position:"relative",
  padding:"8px 10px",
};
const miniFace = {
  position:"relative",
  width:"100%",
  height:54,
  borderRadius:8,
  background:
    `radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.12), rgba(0,0,0,0) 55%),
     linear-gradient(#161f2b, #0e1620)`,
  border:"1px solid #223045",
  overflow:"hidden",
};
const miniGlass = {
  position:"absolute",
  left:0, right:0, top:0, height:18,
  background:"linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(0,0,0,0))",
};
const miniTicks = {
  position:"absolute",
  inset:4,
  borderTop:"2px solid #dbe4f2",
  borderBottom:"2px solid #dbe4f2",
  opacity:0.6,
};
const miniLabel = {
  marginTop:6, fontSize:11, color:"#cbd5e1", textAlign:"center"
};
const miniValue = {
  fontSize:12, color:"#22c55e", fontWeight:700, textAlign:"center"
};
