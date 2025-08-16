// src/components/HeaderBar.jsx
import React from "react";

/**
 * HeaderBar
 * - Shows your logo (or text fallback) on a carbon-fiber strip
 * - Optional tagline on the right
 * - Reads a global logo URL if you set window.__LOGO_URL__ in index.html later
 */
export default function HeaderBar() {
  const logoUrl =
    (typeof window !== "undefined" && window.__LOGO_URL__) || null;

  return (
    <header style={styles.wrap}>
      <div style={styles.inner}>
        <div style={styles.left}>
          <div style={styles.logoBox}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Frye Logo"
                style={{ height: 40, display: "block" }}
              />
            ) : (
              <div style={styles.logoText}>
                <span style={styles.logoAccent}>Frye</span> Trading
              </div>
            )}
          </div>
          <div style={styles.badge}>Ferrari-style</div>
        </div>

        <div style={styles.right}>
          <div style={styles.tagLine}>Carbon Fiber Dash • Live Feeds</div>
        </div>
      </div>
    </header>
  );
}

const carbon = {
  background:
    "repeating-linear-gradient(135deg, #0b0e13 0px, #0b0e13 4px, #11161f 4px, #11161f 8px)",
};

const styles = {
  wrap: {
    ...carbon,
    borderBottom: "1px solid #1b2130",
    padding: "10px 18px",
    position: "sticky",
    top: 0,
    zIndex: 1000,
  },
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 1400,
    margin: "0 auto",
  },
  left: { display: "flex", alignItems: "center", gap: 10 },
  logoBox: {
    background: "#0a0d12",
    border: "1px solid #202739",
    padding: "6px 10px",
    borderRadius: 10,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  logoText: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: 0.3,
    color: "#e6edf7",
  },
  logoAccent: {
    color: "#ff2a2a", // Ferrari red accent
  },
  badge: {
    background: "#ff2a2a",
    color: "#fff",
    fontWeight: 700,
    padding: "4px 8px",
    borderRadius: 8,
    fontSize: 12,
    boxShadow: "0 0 0 1px rgba(0,0,0,0.35) inset",
  },
  right: { opacity: 0.9 },
  tagLine: { color: "#c6d3ea", fontSize: 13 },
};
