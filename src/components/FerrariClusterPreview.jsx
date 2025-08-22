// src/components/FerrariClusterPreview.jsx
// Ferrari cluster preview v2 (visuals only):
// - Carbon fiber housing + header strip (temporary logo watermark)
// - RPM (yellow) with red perimeter ring under ticks, black label
// - SPEED (red) with white numerals, black label
// - Two demo trading lights (📈 green breakout + 📉 red sell pressure) centered below
// - “Live-looking” needles (mid-sweep), static for preview

import React, { useMemo } from "react";

const toRad = (deg) => (deg - 90) * Math.PI / 180;
const point = (cx, cy, deg, r) => [cx + r * Math.cos(toRad(deg)), cy + r * Math.sin(toRad(deg))];
const describeArc = (cx, cy, r, startDeg, endDeg) => {
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  const [x1,y1] = point(cx, cy, startDeg, r);
  const [x2,y2] = point(cx, cy, endDeg, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

// ---------- Single gauge dial ----------
function GaugeDial({
  size = 280,
  face = "yellow",                       // "yellow" | "red"
  label = "RPM",
  numerals = [],                         // [{ text, angleDeg, color, fontSize }]
  numeralsColor = "#000000",
  redBandStartDeg = null,                // draw red arc from this deg to 120
  redPerimeter = false,                  // thin red ring under ticks (for yellow tach)
  needleDeg = -20,                       // live-looking default (about 40% up from zero)
  accent = "#f59e0b",                    // needle color
  topArcText,                            // { text, color, stroke }
  bottomArcText,                         // { text, color, stroke }
}) {
  const W = size, H = size, cx = W/2, cy = H/2;
  const rFace = size * 0.38;

  // points
  const [nx, ny] = point(cx, cy, needleDeg, rFace * 0.86);

  // curved label paths
  const topPath   = describeArc(cx, cy, rFace * 0.88, -110, 110);
  const bottomPath= describeArc(cx, cy, rFace * 0.68,  110, -110);

  // ticks
  const majors = useMemo(() => Array.from({length:9}, (_,i)=>-120 + i*30), []);
  const minors = useMemo(() => {
    const out = [];
    for (let a=-110; a<=110; a+=10) if (a % 30 !== 0) out.push(a);
    return out;
  }, []);

  const faceFill = face === "yellow" ? "url(#faceYellow)" : "url(#faceRed)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: "block" }}>
      <defs>
        {/* carbon fiber */}
        <pattern id="cf" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2" />
        </pattern>
        {/* deep steel bezel */}
        <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#3a4757" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        {/* faces */}
        <radialGradient id="faceYellow" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ffe261" />
          <stop offset="82%" stopColor="#f5b500" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="faceRed" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ff5252" />
          <stop offset="82%" stopColor="#cf2a2a" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        {/* glass */}
        <radialGradient id="glass" cx="45%" cy="25%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.26)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>

        {/* text paths */}
        <path id="topPath" d={topPath} />
        <path id="bottomPath" d={bottomPath} />
      </defs>

      {/* CF panel + bezel + recess shadow */}
      <circle cx={cx} cy={cy} r={rFace * 1.40} fill="url(#cf)" />
      <circle cx={cx} cy={cy} r={rFace * 1.34} fill="url(#bezel)" stroke="#0b1220" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={rFace * 1.08} fill="none" style={{ filter: "drop-shadow(0 9px 18px rgba(0,0,0,0.7))" }} />

      {/* face */}
      <circle cx={cx} cy={cy} r={rFace} fill={faceFill} stroke="#0b1220" strokeWidth="1" />

      {/* thin red perimeter under ticks (tach only) */}
      {redPerimeter && (
        <path
          d={describeArc(cx, cy, rFace * 0.96, -120, 120)}
          stroke="#ef4444" strokeWidth={8} fill="none" strokeLinecap="round"
          opacity="0.9"
        />
      )}

      {/* major ticks */}
      {majors.map((a) => {
        const [x1,y1] = point(cx, cy, a, rFace * 0.95);
        const [x2,y2] = point(cx, cy, a, rFace * 0.78);
        return <line key={"M"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="3" opacity="0.95" />;
      })}
      {/* minor ticks */}
      {minors.map((a) => {
        const [x1,y1] = point(cx, cy, a, rFace * 0.95);
        const [x2,y2] = point(cx, cy, a, rFace * 0.86);
        return <line key={"m"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth="1.3" opacity="0.8" />;
      })}

      {/* numerals */}
      {numerals.map((n, idx) => {
        const [tx, ty] = point(cx, cy, n.angleDeg, rFace * 0.63);
        return (
          <text key={idx} x={tx} y={ty + 6} textAnchor="middle"
                fill={n.color || numeralsColor}
                fontSize={n.fontSize || 16} fontWeight="700">
            {n.text}
          </text>
        );
      })}

      {/* inner red band (tach 8..10) */}
      {redBandStartDeg !== null && (
        <path
          d={describeArc(cx, cy, rFace * 0.94, redBandStartDeg, 120)}
          stroke="#ef4444" strokeWidth={12} fill="none" strokeLinecap="round"
        />
      )}

      {/* curved text (top/bottom) */}
      {topArcText && (
        <text fontSize={14} fontWeight="700" fill={topArcText.color} stroke={topArcText.stroke || "none"} strokeWidth={topArcText.stroke ? 1 : 0}>
          <textPath href="#topPath" startOffset="50%" textAnchor="middle">{topArcText.text}</textPath>
        </text>
      )}
      {bottomArcText && (
        <text fontSize={13} fontWeight="700" fill={bottomArcText.color} stroke={bottomArcText.stroke || "none"} strokeWidth={bottomArcText.stroke ? 1 : 0}>
          <textPath href="#bottomPath" startOffset="50%" textAnchor="middle">{bottomArcText.text}</textPath>
        </text>
      )}

      {/* needle + hub */}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
            stroke={accent} strokeWidth="6.6" strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(239,68,68,0.4))" }} />
      <circle cx={cx} cy={cy} r="8.5" fill="#e5e7eb" stroke="#0b1220" strokeWidth="1.3" />

      {/* glass */}
      <ellipse cx={cx} cy={cy - 20} rx={rFace * 0.96} ry={rFace * 0.36} fill="url(#glass)" opacity="0.55" />

      {/* label (BLACK per your request) */}
      <text x={cx} y={cy + 40} textAnchor="middle" fill="#0b1220" fontSize="13" fontWeight="700">{label}</text>
    </svg>
  );
}

// ---------- Engine lights row (demo: 2 lights centered) ----------
function EngineLightsDemo() {
  const light = (emoji, color) => (
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      background: "rgba(2,6,23,0.8)",
      border: `2px solid ${color}`,
      boxShadow: `0 0 12px ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 16,
    }}>
      <span>{emoji}</span>
    </div>
  );

  return (
    <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop: 6 }}>
      {light("📈", "#22c55e")}  {/* Breakout (green) */}
      {light("📉", "#ef4444")}  {/* Distribution (red) */}
    </div>
  );
}

export default function FerrariClusterPreview({
  headerLogoUrl = "/ferrari.png",     // temporary watermark in header strip
  // live-looking needle angles (static for preview): map -120..120
  rpmNeedleDeg   =  10,               // ~3.5k look
  speedNeedleDeg = -20,               // ~40 look
}) {
  // tach numerals 1..10 (black)
  const tachLabels = useMemo(() => (
    Array.from({ length: 10 }, (_, i) => {
      const num = i + 1;
      const t = (num - 1) / 9;
      const a = -120 + t * 240;
      return { angleDeg: a, text: String(num), color: "#0b1220", fontSize: 18 };
    })
  ), []);

  // speed numerals 20..220 (white)
  const speedLabels = useMemo(() => (
    Array.from({ length: 11 }, (_, i) => {
      const val = (i + 1) * 20;
      const t = i / 10;
      const a = -120 + t * 240;
      return { angleDeg: a, text: String(val), color: "#ffffff", fontSize: 15 };
    })
  ), []);

  return (
    <div style={wrap}>
      {/* Carbon-fiber header strip + watermark */}
      <div style={header}>
        <div style={headerGloss} />
        <div style={headerInner}>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.75 }}>
            Ferrari Cluster — Visual Preview
          </div>
          <div style={{ opacity: 0.22 }}>
            <img src={headerLogoUrl} alt="Ferrari" style={{ height: 36, objectFit: "contain" }} />
          </div>
        </div>
      </div>

      {/* Two-gauge row */}
      <div style={row}>
        {/* Center RPM (yellow) with red perimeter + text arcs */}
        <div style={{ transform: "scale(1.10)" }}>
          <GaugeDial
            size={300}
            face="yellow"
            label="RPM"
            numerals={tachLabels}
            numeralsColor="#0b1220"
            redPerimeter
            redBandStartDeg={80}
            needleDeg={rpmNeedleDeg}
            accent="#f59e0b"
            topArcText={{ text: "REDLINE TRADING", color: "#E21D1D", stroke: "#ffffff" }}
            bottomArcText={{ text: "POWERED BY AI", color: "#ffffff" }}
          />
        </div>

        {/* Right SPEED (red) */}
        <div style={{ transform: "scale(0.95)" }}>
          <GaugeDial
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

      {/* Demo trading lights centered under cluster */}
      <EngineLightsDemo />
    </div>
  );
}

// ---------- housing styles ----------
const wrap = {
  position: "relative",
  margin: "12px 12px 10px",
  padding: "0 16px 12px",
  background: "#0b1220",
  borderRadius: 16,
  border: "1px solid #1f2a44",
  boxShadow: "inset 0 0 38px rgba(0,0,0,0.55), 0 6px 20px rgba(0,0,0,0.45)",
  overflow: "hidden",
};

const header = {
  position: "relative",
  borderBottom: "1px solid #1f2a44",
  padding: "10px 14px",
  background:
    `repeating-linear-gradient(45deg, #0b1220 0 2px, #0f172a 2px 4px),
     repeating-linear-gradient(-45deg, #0b1220 0 2px, #0f172a 2px 4px)`,
  backgroundBlendMode: "multiply",
};

const headerGloss = {
  position: "absolute",
  left: 0, right: 0, top: 0, height: 40,
  background: "linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  pointerEvents: "none",
};

const headerInner = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const row = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 26,
};
