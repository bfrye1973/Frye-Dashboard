// src/components/RedlineAppShell.jsx
import React from "react";
import { useLocation } from "react-router-dom";

const COLORS = {
  red: "#ef4444",
  text: "#f8fafc",
  muted: "#94a3b8",
};

function isActive(item, location) {
  if (item.href === "/") return location.pathname === "/";

  const [path, hash = ""] = item.href.split("#");

  if (location.pathname !== path) return false;

  if (!hash) return true;

  return location.hash === `#${hash}`;
}

function RedlineIcon({ type, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (type === "xray") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }

  if (type === "meter") {
    return (
      <svg {...common}>
        <path d="M4 16a8 8 0 0 1 16 0" />
        <path d="M12 12l4-4" />
        <path d="M6 17h12" />
      </svg>
    );
  }

  if (type === "sector") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </svg>
    );
  }

  if (type === "waves") {
    return (
      <svg {...common}>
        <path d="M3 8c3-3 5 3 8 0s5 3 10 0" />
        <path d="M3 12c3-3 5 3 8 0s5 3 10 0" />
        <path d="M3 16c3-3 5 3 8 0s5 3 10 0" />
      </svg>
    );
  }

  if (type === "chart") {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 15l4-4 3 2 4-6" />
      </svg>
    );
  }

  if (type === "strategy") {
    return (
      <svg {...common}>
        <path d="M12 3l7 4v5c0 4.5-3 7-7 9-4-2-7-4.5-7-9V7l7-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export function RedlineNavRail() {
  const location = useLocation();

  const items = [
    { icon: "xray", short: "X-Ray", label: "Market X-Ray", href: "/" },
    { icon: "meter", short: "Meter", label: "Market Meter", href: "/market-meter" },
    { icon: "sector", short: "Sector", label: "Index Sector", href: "/index-sectors" },
    { icon: "waves", short: "Waves", label: "Wave Degrees", href: "/wave-degrees" },
    { icon: "chart", short: "Chart", label: "Chart", href: "/chart" },
    { icon: "strategy", short: "Strat", label: "Strategies", href: "/strategies-full" },
    { icon: "journal", short: "Journal", label: "Journal", href: "/journal-full" },
  ];

  return (
    <aside
      style={{
        position: "sticky",
        top: 48,
        alignSelf: "start",
        height: "calc(100vh - 64px)",
        border: "1px solid rgba(148,163,184,.16)",
        borderRadius: 14,
        background:
          "linear-gradient(180deg,rgba(12,16,21,.98),rgba(5,7,10,.99))",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.03), 0 12px 28px rgba(0,0,0,.36)",
        padding: "10px 8px",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 10,
        zIndex: 900,
      }}
    >
      <a
        href="/"
        aria-label="Redline Trading Market X-Ray"
        title="Redline Trading"
        style={{
          width: 42,
          height: 42,
          margin: "0 auto",
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          border: "1px solid rgba(239,68,68,.45)",
          background: "rgba(127,29,29,.22)",
          color: COLORS.red,
          fontSize: 18,
          fontWeight: 1000,
          boxShadow: "0 0 18px rgba(239,68,68,.12)",
          textDecoration: "none",
        }}
      >
        R
      </a>

      <nav
        style={{
          display: "grid",
          alignContent: "start",
          gap: 7,
          marginTop: 4,
        }}
      >
        {items.map((item) => {
          const active = isActive(item, location);

          return (
            <a
              key={item.label}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              style={{
                width: 54,
                minHeight: 52,
                margin: "0 auto",
                borderRadius: 11,
                textDecoration: "none",
                display: "grid",
                placeItems: "center",
                gap: 2,
                border: active
                  ? "1px solid rgba(239,68,68,.55)"
                  : "1px solid rgba(148,163,184,.13)",
                background: active
                  ? "linear-gradient(180deg,rgba(127,29,29,.28),rgba(35,8,8,.24))"
                  : "rgba(15,23,42,.30)",
                color: active ? COLORS.red : "#cbd5e1",
                boxShadow: active
                  ? "inset 3px 0 0 #ef4444, 0 0 14px rgba(239,68,68,.08)"
                  : "none",
                transition:
                  "border-color 220ms ease, background-color 220ms ease, color 220ms ease",
              }}
            >
              <span
                style={{
                  lineHeight: 1,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <RedlineIcon type={item.icon} />
              </span>

              <span
                style={{
                  fontSize: 8,
                  lineHeight: 1,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: ".02em",
                }}
              >
                {item.short}
              </span>
            </a>
          );
        })}
      </nav>

      <div
        style={{
          color: "#475569",
          fontSize: 8,
          lineHeight: 1.2,
          textAlign: "center",
          textTransform: "uppercase",
          fontWeight: 800,
        }}
      >
        V1 PREVIEW
        <br />
        POWERED BY AI
      </div>
    </aside>
  );
}

export default function RedlineAppShell({ children }) {
  return (
    <>
      <style>{`
        .redline-shell-grid {
          display: grid;
          grid-template-columns: 76px minmax(0, 1fr);
          gap: 14px;
          max-width: 2200px;
          margin: 0 auto;
          align-items: start;
        }

        .redline-shell-main {
          min-width: 0;
          overflow-x: auto;
        }

        @media (max-width: 980px) {
          .redline-shell-grid {
            grid-template-columns: 64px minmax(0, 1fr);
            gap: 10px;
          }
        }

        @media (max-width: 720px) {
          .redline-shell-grid {
            grid-template-columns: 1fr;
          }

          .redline-shell-grid aside {
            position: relative !important;
            top: auto !important;
            height: auto !important;
            grid-template-rows: auto !important;
            grid-template-columns: auto 1fr auto !important;
            align-items: center;
          }

          .redline-shell-grid aside nav {
            display: flex !important;
            overflow-x: auto;
            align-items: center;
          }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          color: COLORS.text,
          padding: "10px 22px 40px 10px",
          fontFamily: "Arial, Helvetica, sans-serif",
          background:
            "radial-gradient(circle at 50% -10%, rgba(127,29,29,.16), transparent 28%), linear-gradient(180deg,#050607 0%,#020304 100%)",
        }}
      >
        <div className="redline-shell-grid">
          <RedlineNavRail />

          <div className="redline-shell-main">
            <div
              style={{
                animation: "none",
                minHeight: "calc(100vh - 86px)",
              }}
            >
              {children}
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 10,
                borderTop: "1px solid rgba(148,163,184,.10)",
                color: COLORS.muted,
                fontSize: 10,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              <span>Redline Trading — Version 1 Preview</span>
              <span>Market intelligence • structure • planning • review</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
