// src/components/FerrariTwoGaugesMock.jsx
// Two-gauge Ferrari visual mock (static needles):
// - Center RPM (yellow, black numerals, red band 8–10)
// - Right SPEED (red, white numerals)
// Carbon-fiber background, deep bezels, glass overlay.
// No data wiring; visuals only for approval.

import React, { useRef, useEffect, useState } from "react";

// ---------- helpers ----------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp  = (a, b, t) => a + (b - a) * t;

function useEasedValue(target, speed = 0.2) {
  const [v, setV] = useState(target);
  const rafRef = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      setV(prev => {
        const next = lerp(prev, target, speed);
        if (Math.abs(next - target) < 0.25) return target;
        rafRef.current = requestAnimationFrame(loop);
        return next;
      });
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, speed]);
  return v;
}

// polar helpers
const toRad = (deg) => (deg - 90) * Math.PI / 180;
const point = (cx, cy, deg, r) => [cx + r * Math.cos(toRad(deg)), cy + r * Math.sin(toRad(deg))];

// ---------- one dial face ----------
function DialFace({
  size = 260,
  face = "yellow",             // "yellow" | "red"
  label = "RPM",
  valuePercent = 0,            // 0..100, position along arc (-120..120)
  numerals = [],               // [{ angleDeg, text, color, fontSize }]
  numeralsColor = "#000000",
  redBandStartDeg = null,      // draw red arc from this deg to 120
  needleDeg = -120,            // static angle (e.g., parked at left)
  accent = "#f59e0b",          // needle color
}) {
  const eased = useEasedValue(valuePercent, 0.2);
  const angle = -120 + (eased / 100) * 240;

  const W = size, H = size, cx = W/2, cy = H/2;
  const rFace = size * 0.38;

  // needle end-point (no inline spread)
  const needlePt = point(cx, cy, needleDeg, rFace * 0.86);
  const nx = needlePt[0];
  const ny = needlePt[1];

  // arc path helper
  const arcPath = (r, startDeg, endDeg) => {
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    const p1 = point(cx, cy, startDeg, r);
    const p2 = point(cx, cy, endDeg, r);
    return `M ${p1[0]} ${p1[1]} A ${r} ${r} 0 ${large} 1 ${p2[0]} ${p2[1]}`;
  };

  // precompute ticks
  const majors = [];
  for (let a = -120; a <= 120; a += 30) majors.push(a);
  const minors = [];
  for (let a = -110; a <= 110; a += 10) if (a % 30 !== 0) minors.push(a);

  const faceFill = (face === "yellow") ? "url(#faceYellowR)" : "url(#faceRedR)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: "block" }}>
      <defs>
        {/* carbon fiber */}
        <pattern id="cfR" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#0b1220" />
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#0f172a" strokeWidth="2" />
        </pattern>
        {/* deep steel bezel */}
        <linearGradient id="ringR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#394456" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        {/* faces */}
        <radialGradient id="faceYellowR" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ffe261" />
          <stop offset="82%" stopColor="#f5b500" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="faceRedR" cx="50%" cy="45%">
          <stop offset="0%"  stopColor="#ff5252" />
          <stop offset="82%" stopColor="#cf2a2a" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        {/* glass gloss */}
        <radialGradient id="glassR" cx="45%" cy="25%">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.26)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>
      </defs>

      {/* carbon panel + bezel */}
      <circle cx={cx} cy={cy} r={rFace * 1.40} fill="url(#cfR)" />
      <circle cx={cx} cy={cy} r={rFace * 1.34} fill="url(#ringR)" stroke="#0b1220" strokeWidth="2" />
      {/* recess shadow */}
      <circle cx={cx} cy={cy} r={rFace * 1.08} fill="none" style={{ filter: "drop-shadow(0 9px 18px rgba(0,0,0,0.7))" }} />

      {/* face */}
      <circle cx={cx} cy={cy} r={rFace} fill={faceFill} stroke="#0b1220" strokeWidth="1" />

      {/* major ticks */}
      {majors.map((a) => {
        const p1 = point(cx, cy, a, rFace * 0.95);
        const p2 = point(cx, cy, a, rFace * 0.78);
        return <line key={"M"+a} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#e5e7eb" strokeWidth="3" opacity="0.95" />;
      })}
      {/* minor ticks */}
      {minors.map((a) => {
        const p1 = point(cx, cy, a, rFace * 0.95);
        const p2 = point(cx, cy, a, rFace * 0.86);
        return <line key={"m"+a} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#94a3b8" strokeWidth="1.5" opacity="0.85" />;
      })}

      {/* numerals */}
      {numerals.map((n, idx) => {
        const pt = point(cx, cy, n.angleDeg, rFace * 0.63);
        return (
          <text key={idx} x={pt[0]} y={pt[1] + 6} textAnchor="middle"
                fill={n.color || numeralsColor}
                fontSize={n.fontSize || 16} fontWeight="700">
            {n.text}
          </text>
        );
      })}

      {/* red band (tach 8..10) */}
      {redBandStartDeg !== null && (
        <path
          d={arcPath(rFace * 0.94, redBandStartDeg, 120)}
          stroke="#ef4444" strokeWidth={12} fill="none" strokeLinecap="round"
        />
      )}

      {/* needle + hub (static) */}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
            stroke={accent} strokeWidth="6.6" strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(239,68,68,0.4))" }} />
      <circle cx={cx} cy={cy} r="8.5" fill="#e5e7eb" stroke="#0b1220" strokeWidth="1.3" />

      {/* glass gloss */}
      <ellipse cx={cx} cy={cy - 20} rx={rFace * 0.96} ry={rFace * 0.36} fill="url(#glassR)" opacity="0.55" />

      {/* label */}
      <text x={cx} y={cy + 40} textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="600">{label}</text>
    </svg>
  );
}

export default function FerrariTwoGaugesMock({ rpmPercent = 0, speedPercent = 0 }) {
  const rpm   = clamp(rpmPercent,   0, 100);
  const speed = clamp(speedPercent, 0, 100);

  // tach labels 1..10 (black)
  const tachLabels = Array.from({ length: 10 }, (_, i) => {
    const num = i + 1;                          // 1..10
    const t = (num - 1) / 9;                    // 0..1
    const a = -120 + t * 240;                   // position on arc
    return { angleDeg: a, text: String(num), color: "#0b1220", fontSize: 18 };
  });

  // speed labels 20..220 (white)
  const speedLabels = Array.from({ length: 11 }, (_, i) => {
    const val = (i + 1) * 20;                   // 20..220
    const t = i / 10;                           // 0..1
    const a = -120 + t * 240;
    return { angleDeg: a, text: String(val), color: "#ffffff", fontSize: 15 };
  });

  return (
    <div style={panelWrap}>
      <div style={cfHeader}><div style={cfGloss} /></div>

      <div style={row}>
        {/* Center RPM (bigger) */}
        <div style={{ transform: "scale(1.10)" }}>
          <DialFace
            size={280}
            face="yellow"
            label="RPM"
            numerals={tachLabels}
            numeralsColor="#0b1220"
            redBandStartDeg={80}
            needleDeg={-120}         // parked at zero
            valuePercent={rpm}
            accent="#f59e0b"
          />
        </div>

        {/* Right SPEED (slightly smaller) */}
        <div style={{ transform: "scale(0.95)" }}>
          <DialFace
            size={240}
            face="red"
            label="SPEED"
            numerals={speedLabels}
            numeralsColor="#ffffff"
            needleDeg={-120}         // parked at zero
            valuePercent={speed}
            accent="#ef4444"
          />
        </div>
      </div>
    </div>
  );
}

// ---------- container styles ----------
const panelWrap = {
  position: "relative",
  margin: "12px 12px 10px",
  padding: "14px 16px 10px",
  background: "#0b1220",
  borderRadius: 16,
  border: "1px solid #1f2a44",
  boxShadow: "inset 0 0 38px rgba(0,0,0,0.55), 0 6px 20px rgba(0,0,0,0.45)",
  overflow: "hidden",
};

const cfHeader = {
  position: "absolute", left: 0, right: 0, top: 0, height: 48,
  background:
    `repeating-linear-gradient(45deg, #0b1220 0 2px, #0f172a 2px 4px),
     repeating-linear-gradient(-45deg, #0b1220 0 2px, #0f172a 2px 4px)`,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const cfGloss = {
  position: "absolute", inset: 0,
  background: "linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
  pointerEvents: "none",
};

const row = {
  marginTop: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 26,
};
