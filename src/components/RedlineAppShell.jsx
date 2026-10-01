// src/components/RedlineAppShell.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

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

  if (type === "controls") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        <path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      </svg>
    );
  }

  if (type === "lights") {
    return (
      <svg {...common}>
        <circle cx="7" cy="12" r="2.2" />
        <circle cx="12" cy="12" r="2.2" />
        <circle cx="17" cy="12" r="2.2" />
        <path d="M4 6h16M4 18h16" />
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

  const currentParams = new URLSearchParams(location.search || "");
  const contextKeys = [
    "symbol",
    "tf",
    "candidateId",
    "strategyId",
    "setupClass",
  ];

  const contextualHref = (href) => {
    const [beforeHash, hash = ""] = href.split("#");
    const [path, query = ""] = beforeHash.split("?");
    const next = new URLSearchParams(query);

    for (const key of contextKeys) {
      const value = currentParams.get(key);
      if (value && !next.has(key)) {
        next.set(key, value);
      }
    }

    const suffix = next.toString();
    const queryPart = suffix ? `?${suffix}` : "";
    const hashPart = hash ? `#${hash}` : "";

    return `${path}${queryPart}${hashPart}`;
  };

  const items = [
    { icon: "xray", short: "X-Ray", label: "Market X-Ray", href: "/" },
    { icon: "meter", short: "Meter", label: "Market Meter", href: "/market-meter" },
    { icon: "sector", short: "Sector", label: "Index Sector", href: "/index-sectors" },
    { icon: "strategy", short: "Strat", label: "Strategies", href: "/strategies" },
    { icon: "chart", short: "Chart", label: "Chart", href: "/chart" },
    { icon: "journal", short: "Journal", label: "Journal", href: "/journal-full" },
    { icon: "controls", short: "Tools", label: "Controls / Replay / AI Listen", href: "/controls" },
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
      <Link
        to="/"
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
      </Link>

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
            <Link
              key={item.label}
              to={contextualHref(item.href)}
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
            </Link>
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
  const location = useLocation();
  const qs = new URLSearchParams(location.search || "");

  const linkedCandidateId = qs.get("candidateId") || "";
  const linkedSymbol = (qs.get("symbol") || "").toUpperCase();
  const linkedTf = qs.get("tf") || "";
  const linkedStrategyId = qs.get("strategyId") || "";
  const linkedSetupClass = qs.get("setupClass") || "";

  return (
    <>
      <style>{`
        html,
        body,
        #root {
          width: 100%;
          max-width: none;
          min-height: 100%;
        }

        body {
          margin: 0;
          overflow-x: hidden;
          overflow-y: auto;
        }

        .redline-shell-grid {
          display: grid;
          grid-template-columns: 76px minmax(0, 1fr);
          gap: 14px;
          width: 100%;
          max-width: none;
          margin: 0;
          align-items: start;
          box-sizing: border-box;
        }

        .redline-shell-main {
          width: 100%;
          min-width: 0;
          max-width: none;
          overflow-x: hidden;
          overflow-y: visible;
        }

        .redline-shell-main .panel {
          background:
            linear-gradient(180deg, rgba(18,23,30,.96), rgba(7,10,14,.98)) !important;
          border: 1px solid rgba(148,163,184,.16) !important;
          border-radius: 14px !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.025),
            0 10px 28px rgba(0,0,0,.24) !important;
          color: #e5e7eb !important;
        }

        .redline-shell-main .panel-head {
          border-bottom-color: rgba(239,68,68,.16) !important;
        }

        .redline-shell-main .panel-title {
          color: #f8fafc !important;
          font-weight: 900 !important;
          letter-spacing: .025em;
        }

        .redline-shell-main button,
        .redline-shell-main select {
          border-color: rgba(148,163,184,.25) !important;
          border-radius: 9px !important;
        }

        .redline-shell-main button:hover {
          border-color: rgba(239,68,68,.55) !important;
        }

        .redline-shell-main ::-webkit-scrollbar {
          width: 9px;
          height: 9px;
        }

        .redline-shell-main ::-webkit-scrollbar-track {
          background: rgba(2,6,23,.45);
        }

        .redline-shell-main ::-webkit-scrollbar-thumb {
          background: rgba(100,116,139,.55);
          border-radius: 999px;
        }

        .redline-shell-main ::-webkit-scrollbar-thumb:hover {
          background: rgba(239,68,68,.55);
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
          width: "100%",
          minHeight: "100vh",
          boxSizing: "border-box",
          color: COLORS.text,
          padding: "10px 14px 40px 10px",
          fontFamily: "Arial, Helvetica, sans-serif",
          background:
            "radial-gradient(circle at 50% -10%, rgba(127,29,29,.16), transparent 28%), linear-gradient(180deg,#050607 0%,#020304 100%)",
        }}
      >
        <div className="redline-shell-grid">
          <RedlineNavRail />

          <div className="redline-shell-main">
            {linkedCandidateId ? (
              <div
                style={{
                  marginBottom: 10,
                  border: "1px solid rgba(251,191,36,.32)",
                  background:
                    "linear-gradient(90deg, rgba(120,53,15,.18), rgba(10,13,17,.94) 42%)",
                  borderRadius: 10,
                  padding: "7px 10px",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  fontSize: 11,
                }}
              >
                <strong
                  style={{
                    color: "#fde68a",
                    letterSpacing: ".05em",
                  }}
                >
                  LINKED SETUP
                </strong>

                <span style={{ color: "#f8fafc", fontWeight: 1000 }}>
                  {linkedCandidateId}
                </span>

                {linkedSymbol ? (
                  <span style={{ color: "#94a3b8" }}>
                    {linkedSymbol}
                  </span>
                ) : null}

                {linkedTf ? (
                  <span style={{ color: "#94a3b8" }}>
                    {linkedTf}
                  </span>
                ) : null}

                {linkedStrategyId ? (
                  <span style={{ color: "#94a3b8" }}>
                    {linkedStrategyId}
                  </span>
                ) : null}

                {linkedSetupClass ? (
                  <span
                    style={{
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    {linkedSetupClass.replaceAll("_", " ")}
                  </span>
                ) : null}
              </div>
            ) : null}

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
