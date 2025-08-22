// src/components/FerrariClusterPreview.jsx
// Intermediate Ferrari preview: full housing + header strip with logo watermark,
// center yellow RPM (black numerals, red band 8–10) + right red SPEED (white numerals).
// Static needles parked at zero. Curved text on tach: REDLINE TRADING / POWERED BY AI.
// No data wiring yet—visuals only.

import React, { useMemo } from "react";

// Map angle -> cartesian
const rad = (deg) => (deg - 90) * Math.PI / 180;
const P = (cx, cy, deg, r) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

function GaugeDial({
  size = 280,
  face = "yellow",                 // "yellow" | "red"
  label = "RPM",
  numerals = [],                   // [{ text, angleDeg, color, fontSize }]
  redBandStartDeg = null,          // e.g. 80 -> 120
  needleDeg = -120,                // parked at left limit (zero)
  accent = "#f59e0b",              // needle color (yellow tach), red for speed
  numeralsColor = "#000000",
  showCurvedTopText,               // optional { text, color, stroke }
  showCurvedBottomText,            // optional { text, color, stroke }
}) {
  const W = size, H = size, cx = W / 2, cy = H / 2;
  const rFace = size * 0.38;

  // needle target point
  const [nx, ny] = useMemo(() => P(cx, cy, needleDeg, rFace * 0.86), [cx, cy, needleDeg, rFace]);

  // Arc path helper (for curved text & bands)
  const describeArc = (cx, cy, r, startDeg, endDeg) => {
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    const [x1,y1] = P(cx, cy, startDeg, r);
    const [x2,y2] = P(cx, cy, endDeg, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: "block" }}>
      <defs>
        {/* Carbon fiber weave */}
        <pattern id="cfPattern" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2" />
        </pattern>
        {/* Deep steel bezel */}
        <linearGradient id="bezelGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#3a4757" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        {/* Dial faces */}
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
        {/* Glass gloss */}
        <radialGradient id="glass" cx="45%" cy="25%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.26)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>

        {/* Paths for curved text */}
        <path id="tachTopPath" d={describeArc(cx, cy, rFace * 0.88, -110, 110)} />
        <path id="tachBottomPath" d={describeArc(cx, cy, rFace * 0.68, 110, -110)} />
      </defs>

      {/* Carbon fiber panel + deep bezel */}
      <circle cx={cx} cy={cy} r={rFace * 1.40} fill="url(#cfPattern)" />
      <circle cx={cx} cy={cy} r={rFace * 1.34} fill="url(#bezelGrad)" stroke="#0b1220" strokeWidth="2" />
      {/* Recessed inner shadow to create depth */}
      <circle cx={cx} cy={cy} r={rFace * 1.08} fill="none" style={{ filter: "drop-shadow(0 9px 18px rgba(0,0,0,0.7))" }} />

      {/* Dial face */}
      <circle
        cx={cx} cy={cy} r={rFace}
        fill={face === "yellow" ? "url(#faceYellow)" : "url(#faceRed)"}
        stroke="#0b1220" strokeWidth="1"
      />

      {/* Ticks */}
      {Array.from({ length: 9 }, (_, i) => -120 + i * 30).map((a) => {
        const [x1,y1] = P(cx, cy, a, rFace * 0.95);
        const [x2,y2] = P(cx, cy, a, rFace * 0.78);
        return <line key={"M"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="3" opacity="0.95" />;
      })}
      {Array.from({ length: 24 }, (_, i) => -115 + i * 10).map((a) => {
        if ((a + 120) % 30 === 0) return null;
        const [x1,y1] = P(cx, cy, a, rFace * 0.95);
        const [x2,y2] = P(cx, cy, a, rFace * 0.86);
        return <line key={"m"+a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.5" opacity="0.85" />;
      })}

      {/* Numerals */}
      {numerals.map((n, idx) => {
        const [tx, ty] = P(cx, cy, n.angleDeg, rFace * 0.63);
        return (
          <text key={idx} x={tx} y={ty + 6} textAnchor="middle"
                fill={n.color || numeralsColor}
                fontSize={n.fontSize || 16} fontWeight="700">
            {n.text}
          </text>
        );
      })}

      {/* Red band (for tach 8..10) */}
      {redBandStartDeg !== null && (
        <path
          d={describeArc(cx, cy, rFace * 0.94, redBandStartDeg, 120)}
          stroke="#ef4444" strokeWidth={12} fill="none" strokeLinecap="round"
        />
      )}

      {/* Curved top text */}
      {showCurvedTopText && (
        <text fontSize={14} fontWeight="700" fill={showCurvedTopText.color} stroke={showCurvedTopText.stroke || "none"} strokeWidth={showCurvedTopText.stroke ? 1 : 0}>
          <textPath href="#tachTopPath" startOffset="50%" textAnchor="middle">
            {showCurvedTopText.text}
          </textPath>
        </text>
      )}

      {/* Curved bottom text */}
      {showCurvedBottomText && (
        <text fontSize={13} fontWeight="700" fill={showCurvedBottomText.color} stroke={showCurvedBottomText.stroke || "none"} strokeWidth={showCurvedBottomText.stroke ? 1 : 0}>
          <textPath href="#tachBottomPath" startOffset="50%" textAnchor="middle">
            {showCurvedBottomText.text}
          </textPath>
        </text>
      )}

      {/* Needle + hub (static parked at zero) */}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
            stroke={accent} strokeWidth="6.6" strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(239,68,68,0.4))" }} />
      <circle cx={cx} cy={cy} r="8.5" fill="#e5e7eb" stroke="#0b1220" strokeWidth="1.3" />

      {/* Glass gloss */}
      <ellipse cx={cx} cy={cy - 20} rx={rFace * 0.96} ry={rFace * 0.36} fill="url(#glass)" opacity="0.55" />

      {/* Label under dial */}
      <text x={cx} y={cy + 40} textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="600">{label}</text>
    </svg>
  );
}

export default function FerrariClusterPreview({
  // static preview — leave both at zero
  rpmPercent = 0,
  speedPercent = 0,
  // temporary logo watermark path (header strip)
  headerLogoUrl = "/ferrari.png",
}) {
  // Tach numerals: 1..10 (black)
  const tachLabels = useMemo(() => (
    Array.from({ length: 10 }, (_, i) => {
      const num = i + 1;                  // 1..10
      const t = (num - 1) / 9;            // 0..1
      const a = -120 + t * 240;           // map on arc
      return { angleDeg: a, text: String(num), color: "#0b1220", fontSize: 18 };
    })
  ), []);

  // Speed numerals: 20..220 step 20 (white)
  const speedLabels = useMemo(() => (
    Array.from({ length: 11 }, (_, i) => {
      const val = (i + 1) * 20;           // 20..220
      const t = i / 10;
      const a = -120 + t * 240;
      return { angleDeg: a, text: String(val), color: "#ffffff", fontSize: 15 };
    })
  ), []);

  return (
    <div style={wrap}>
      {/* Carbon-fiber header strip with temporary logo watermark */}
      <div style={header}>
        <div style={headerGloss} />
        <div style={headerInner}>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.75 }}>
            Ferrari Cluster — Preview (Static)
          </div>
          <div style={{ opacity: 0.2 }}>
            {/* watermark (safe if missing) */}
            <img src={headerLogoUrl} alt="Ferrari" style={{ height: 36, objectFit: "contain" }} />
          </div>
        </div>
      </div>

      {/* Two-gauge row: center tach (bigger) + right speed (smaller) */}
      <div style={row}>
        {/* Center RPM */}
        <div style={{ transform: "scale(1.10)" }}>
          <GaugeDial
            size={300}
            face="yellow"
            label="RPM"
            numerals={tachLabels}
            numeralsColor="#0b1220"
            redBandStartDeg={80}
            needleDeg={-120}               // parked at zero
            accent="#f59e0b"
            showCurvedTopText={{ text: "REDLINE TRADING", color: "#E21D1D", stroke: "#ffffff" }}
            showCurvedBottomText={{ text: "POWERED BY AI", color: "#ffffff" }}
          />
        </div>

        {/* Right SPEED */}
        <div style={{ transform: "scale(0.95)" }}>
          <GaugeDial
            size={260}
            face="red"
            label="SPEED"
            numerals={speedLabels}
            numeralsColor="#ffffff"
            needleDeg={-120}              // parked at zero
            accent="#ef4444"
          />
        </div>
      </div>
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
