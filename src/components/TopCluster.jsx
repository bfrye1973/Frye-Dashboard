// src/components/TopCluster.jsx
import React from "react";
import CarbonGauge from "./CarbonGauge";

/**
 * TopCluster
 * - Clean, responsive cluster row for four CarbonGauge dials
 * - Matches CarbonGauge API (size, isLogo, units)
 * - No vh; clamps via maxHeight + overflow:hidden
 */
export default function TopCluster({ metrics = {}, height = 520 }) {
  const H = Math.max(220, Math.min(Number(height) || 520, 520));

  const breadth   = Number.isFinite(+metrics.breadth)   ? +metrics.breadth   : 44;
  const momentum  = Number.isFinite(+metrics.momentum)  ? +metrics.momentum  : 72;
  const vol       = Number.isFinite(+metrics.volatility)? +metrics.volatility: 63;
  const liquidity = Number.isFinite(+metrics.liquidity) ? +metrics.liquidity : 58;

  return (
    <div style={{ ...styles.wrap, "--H": `${H}px` }}>
      {/* Breadth */}
      <div style={styles.cell}>
        <CarbonGauge label="Breadth" value={breadth} size={220} units="%" />
      </div>

      {/* Momentum (center / hero) */}
      <div style={styles.cell}>
        <CarbonGauge label="Momentum" value={momentum} size={280} isLogo units="%" />
      </div>

      {/* Volatility */}
      <div style={styles.cell}>
        <CarbonGauge label="Volatility" value={vol} size={220} units="%" />
      </div>

      {/* Liquidity / Fuel */}
      <div style={styles.cell}>
        <CarbonGauge label="Liquidity / Fuel" value={liquidity} size={220} units="%" />
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    // Containment: no vh; respect the cluster cap and prevent overflow
    maxHeight: "var(--H)",
    overflow: "hidden",
    width: "100%",

    // Responsive grid — maintains 4 columns when space allows,
    // gracefully wraps on smaller screens (min card ~200px)
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 24,
    justifyItems: "center",
    alignItems: "center",
    padding: "18px 12px",
    boxSizing: "border-box",
  },
  cell: {
    // make sure gauges don’t clip their shadow
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
  },
};
