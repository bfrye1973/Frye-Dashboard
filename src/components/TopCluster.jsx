// src/components/TopCluster.jsx
import React from "react";
import CarbonGauge from "./CarbonGauge";

export default function TopCluster({ metrics = {} }) {
  return (
    <div style={styles.wrap}>
      <CarbonGauge
        label="Breadth"
        value={Number(metrics.breadth ?? 44)}
        diameter={220}
        face="dark"
        color="#f04b4b"
      />
      <CarbonGauge
        label="Momentum"
        value={Number(metrics.momentum ?? 72)}
        diameter={280}
        face="tach"
        color="#f04b4b"
        subline="Powered by AI"
        logoCenter
      />
      <CarbonGauge
        label="Volatility"
        value={Number(metrics.volatility ?? 63)}
        diameter={220}
        face="dark"
        color="#f04b4b"
      />
      <CarbonGauge
        label="Liquidity / Fuel"
        value={Number(metrics.liquidity ?? 58)}
        diameter={220}
        face="dark"
        color="#f04b4b"
      />
    </div>
  );
}

const styles = {
  wrap:{
    display:"grid",
    gridTemplateColumns:"220px 280px 220px 220px",
    gap:24,
    justifyContent:"center",
    alignItems:"center",
    padding:"18px 12px",
  }
};
