// src/components/Header.jsx
import React from "react";

export default function Header({ online }) {
  return (
    <header style={styles.wrap}>
      <div style={styles.brand}>
        <span style={styles.brandBig}>REDLINE TRADING</span>
        <span style={styles.power}> — Powered by AI</span>
      </div>

      <div className="badge" style={{borderColor: online ? "#225d37" : "#5d2222", background: online ? "#0e1f16" : "#1f0e0e", color: online ? "#9ee4b2" : "#f3a0a0"}}>
        {online ? "Backend: online" : "Backend: offline"}
      </div>
    </header>
  );
}

const styles = {
  wrap:{
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    padding:"14px 18px",
    borderBottom:"1px solid var(--line)",
    background:"linear-gradient(180deg, rgba(255,255,255,.02), transparent 40%)",
    position:"sticky",
    top:0,
    zIndex:10
  },
  brand:{ fontWeight:900, letterSpacing:".06em" },
  brandBig:{ fontSize:20 },
  power:{ fontSize:16, opacity:.9 }
};
