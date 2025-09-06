// src/components/TopCluster.jsx
import React from "react";
import CarbonGauge from "./CarbonGauge";

/**
 * TopCluster
 * - Responsive, self-contained top gauge row
 * - No vh/%; default height ~380px, cap handled by global soft-cap (max-height:520)
 */
export default function TopCluster({ metrics = {}, height = 380 }) {
  const H = Math.max(320, Math.min(Number(height) || 380, 520)); // safe default, capped by global soft-cap

  // Dial sizes (measured to fit inside ~380–440px total height)
  const SIZE_SPEED = 220;
  const SIZE_RPM   = 200;
  const SIZE_MINI  = 80;
  const GAP_MINI   = 8;

  const TOP_PAD = 16;   // top padding
  const BOT_PAD = 8;    // bottom padding
  const LIGHTS  = 56;   // engine lights row
  // total = max(SPEED, RPM, 3*MINI + 2*GAP) + TOP_PAD + BOT_PAD + LIGHTS
  // max(220, 200, 3*80+2*8=256) + 16 + 8 + 56 = 336 -> default 380 gives headroom

  const breadth   = Number.isFinite(+metrics.breadth)   ? +metrics.breadth   : 44;
  const momentum  = Number.isFinite(+metrics.momentum)  ? +metrics.momentum  : 72;
  const volatility= Number.isFinite(+metrics.volatility)? +metrics.volatility: 63;
  const liquidity = Number.isFinite(+metrics.liquidity) ? +metrics.liquidity : 58;

  return (
    <div style={{ ...styles.wrap, "--H": `${H}px` }}>
      <div style={styles.topRow}>
        {/* RPM + minis (left) */}
        <div style={styles.left}>
          <CarbonGauge label="RPM" value={momentum} size={SIZE_RPM} units="%" />
          <div style={{ display: "grid", rowGap: GAP_MINI, alignContent: "center" }}>
            <CarbonGauge label="WATER"  value={breadth}   size={SIZE_MINI} units="%" />
            <CarbonGauge label="OIL"    value={volatility} size={SIZE_MINI} units="%" />
            <CarbonGauge label="FUEL"   value={liquidity} size={SIZE_MINI} units="%" />
          </div>
        </div>

        {/* Speed (right / hero) */}
        <div style={styles.right}>
          <CarbonGauge label="Speed" value={momentum} size={SIZE_SPEED} units="%" isLogo />
        </div>
      </div>

      {/* Engine lights row (visual placeholder) */}
      <div style={styles.lightsRow}>
        <div style={styles.light} title="Breakout" />
        <div style={styles.light} title="Squeeze" />
        <div style={styles.light} title="Distribution" />
        <div style={styles.light} title="Risk" />
        <div style={styles.light} title="Turbo" />
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    width: "100%",
    height: "var(--H)",        // default ~380, real cap handled by global soft-cap (max-height:520)
    maxHeight: 520,
    overflow: "hidden",
    borderRadius: 18,
    border: "1px solid #171a22",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.35)",
    background:
      "radial-gradient(ellipse at center, rgba(0,0,0,.35), rgba(0,0,0,.65)), repeating-linear-gradient(45deg, #101317 0 6px, #0b0e12 6px 12px)",
    display: "flex",
    flexDirection: "column",
  },

  topRow: {
    flex: "0 0 auto",
    padding: "16px 22px 8px 22px",   // TOP_PAD / BOT_PAD
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    alignItems: "center",
    gap: 20,
    boxSizing: "border-box",
  },

  left:  { display: "flex", gap: 18, alignItems: "center", justifyContent: "flex-start" },
  right: { display: "flex", gap: 18, alignItems: "center", justifyContent: "flex-end" },

  lightsRow: {
    flex: "0 0 56px",                // LIGHTS height
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "8px 12px",
    boxSizing: "border-box",
  },
  light: {
    width: 22,
    height: 22,
    borderRadius: 9999,
    background: "#22c55e",
    opacity: 0.28,
    boxShadow: "0 0 0 2px rgba(0,0,0,.4) inset",
  },
};
