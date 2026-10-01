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

export function RedlineNavRail() {
  const location = useLocation();

  const items = [
    { icon: "⌖", short: "X-Ray", label: "Market X-Ray", href: "/" },
    { icon: "◴", short: "Meter", label: "Market Meter", href: "/market-meter" },
    { icon: "▦", short: "Sector", label: "Index Sector", href: "/index-sectors" },
    { icon: "≋", short: "Waves", label: "Wave Degrees", href: "/wave-degrees" },
    { icon: "⌁", short: "Chart", label: "Chart", href: "/chart" },
    { icon: "◈", short: "Strat", label: "Strategies", href: "/strategies-full" },
    { icon: "☷", short: "Journal", label: "Journal", href: "/journal-full" },
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
                  fontSize: 21,
                  lineHeight: 1,
                  fontFamily:
                    '"Segoe UI Symbol","Arial Unicode MS",Arial,sans-serif',
                }}
              >
                {item.icon}
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
        Powered
        <br />
        by AI
      </div>
    </aside>
  );
}

export default function RedlineAppShell({ children }) {
  return (
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "76px minmax(0,1fr)",
          gap: 14,
          maxWidth: 2200,
          margin: "0 auto",
          alignItems: "start",
        }}
      >
        <RedlineNavRail />

        <div
          style={{
            minWidth: 0,
            overflowX: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
