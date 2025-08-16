// src/components/Header.jsx
import React from "react";

export default function Header({ online }) {
  return (
    <header style={styles.wrap}>
      <div style={styles.left}>
        <div style={styles.logo}>REDLINE TRADING</div>
      </div>
      <div style={styles.right}>
        <div
          style={{
            ...styles.badge,
            background: online ? "#0b5d1e" : "#6b0d0d",
          }}
        >
          {online ? "Backend: Online" : "Backend: Offline"}
        </div>
      </div>
    </header>
  );
}

const styles = {
  wrap: {
    background:
      "repeating-linear-gradient(135deg,#0b0e13 0px,#0b0e13 4px,#11161f 4px,#11161f 8px)",
    padding: "10px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #202733",
  },
  left: { fontWeight: 800, fontSize: 20, color: "#fff" },
  right: {},
  badge: {
    padding: "6px 12px",
    borderRadius: 12,
    fontWeight: 600,
    color: "#fff",
  },
};
