// src/components/LogoFerrari.jsx
import React from "react";

/**
 * Ferrari-style tach logo with carbon-fiber banner
 * - Fully inline SVG (no external assets)
 * - Responsive: scales to container width
 */
export default function LogoFerrari() {
  return (
    <div style={wrap}>
      <svg viewBox="0 0 1200 360" style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          {/* carbon fiber pattern */}
          <pattern id="cfiber" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="#0c0f16" />
            <rect width="5" height="10" fill="#101522" />
          </pattern>

          {/* metal rim */}
          <radialGradient id="rim" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#dfe4e7" />
            <stop offset="45%" stopColor="#a9b1b7" />
            <stop offset="65%" stopColor="#f2f4f6" />
            <stop offset="100%" stopColor="#6f787f" />
          </radialGradient>

          {/* inner bevel */}
          <linearGradient id="bevel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#20242c" />
            <stop offset="100%" stopColor="#07080b" />
          </linearGradient>

          {/* yellow dial */}
          <radialGradient id="dial" cx="42%" cy="38%" r="85%">
            <stop offset="0%" stopColor="#ffe680" />
            <stop offset="55%" stopColor="#ffcf00" />
            <stop offset="100%" stopColor="#e1b200" />
          </radialGradient>

          {/* dial glass gloss */}
          <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" />
          </filter>
        </defs>

        {/* carbon banner */}
        <rect x="0" y="0" width="1200" height="360" fill="url(#cfiber)" rx="14" />

        {/* tachometer group */}
        <g transform="translate(190,180)">
          {/* metal rim */}
          <circle cx="0" cy="0" r="130" fill="url(#rim)" />
          {/* inner bezel */}
          <circle cx="0" cy="0" r="120" fill="url(#bevel)" />
          {/* dial */}
          <circle cx="0" cy="0" r="112" fill="url(#dial)" />

          {/* major ticks */}
          <g stroke="#1b1f2a" strokeWidth="6" strokeLinecap="round">
            {Array.from({ length: 11 }).map((_, i) => {
              const a = (-120 + i * 24) * (Math.PI / 180);
              const x1 = Math.cos(a) * 88;
              const y1 = Math.sin(a) * 88;
              const x2 = Math.cos(a) * 102;
              const y2 = Math.sin(a) * 102;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>

          {/* minor ticks */}
          <g stroke="#2a2f3b" strokeWidth="3" strokeLinecap="round" opacity="0.8">
            {Array.from({ length: 50 }).map((_, i) => {
              const a = (-120 + i * (240 / 49)) * (Math.PI / 180);
              const x1 = Math.cos(a) * 94;
              const y1 = Math.sin(a) * 94;
              const x2 = Math.cos(a) * 100;
              const y2 = Math.sin(a) * 100;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>

          {/* redline arc */}
          <path
            d={arcPath(86, 120, 106)}
            fill="none"
            stroke="#ff2a2a"
            strokeWidth="10"
            strokeLinecap="round"
            filter="url(#soft)"
          />

          {/* needle */}
          <g>
            <line x1="0" y1="0" x2="100" y2="-18" stroke="#ff2a2a" strokeWidth="10" strokeLinecap="round" />
            <circle cx="0" cy="0" r="10" fill="#0a0b0d" stroke="#ff2a2a" strokeWidth="3" />
          </g>

          {/* gloss */}
          <ellipse cx="-24" cy="-38" rx="70" ry="40" fill="url(#gloss)" opacity="0.55" />

          {/* dial text */}
          <text x="0" y="48" textAnchor="middle" fontSize="22" fill="#222" fontWeight="800">
            x1000 RPM
          </text>
        </g>

        {/* wordmark */}
        <g transform="translate(420,140)">
          <text fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial"
                fontSize="72" fontWeight="900" fill="#ffffff" letterSpacing="2">
            FRYE DASHBOARD
          </text>
          <rect x="0" y="20" width="460" height="8" fill="#ff2a2a" opacity="0.9" />
          <text y="92" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial"
                fontSize="24" fontWeight="700" fill="#c9d4ea" letterSpacing="4">
            TRADING PLATFORM
          </text>
        </g>
      </svg>
    </div>
  );
}

/* helpers */
function arcPath(degStart, degEnd, radius) {
  const a0 = (degStart * Math.PI) / 180;
  const a1 = (degEnd * Math.PI) / 180;
  const x0 = Math.cos(a0) * radius;
  const y0 = Math.sin(a0) * radius;
  const x1 = Math.cos(a1) * radius;
  const y1 = Math.sin(a1) * radius;
  const large = degEnd - degStart > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
}

const wrap = {
  padding: "14px 18px",
  borderBottom: "1px solid #1b2130",
  borderRadius: 14,
  overflow: "hidden",
};
