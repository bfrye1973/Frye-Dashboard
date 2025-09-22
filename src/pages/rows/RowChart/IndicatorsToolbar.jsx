// src/pages/rows/RowChart/IndicatorsToolbar.jsx
// v2.7 — EMA, Volume, Overlays (MoneyFlow, Lux S/R, Swing Liquidity),
//         Oscillators (SMI shown only when showSmiToggle=true)

import React from "react";

export default function IndicatorsToolbar({
  // EMA
  showEma,
  ema10 = true,
  ema20 = true,
  ema50 = true,

  // Volume (separate pane)
  volume = false,

  // Overlays
  moneyFlow = false,
  luxSr = false,
  swingLiquidity = false,

  // Oscillators (separate pane)
  smi = false,

  // NEW: controls whether we show the SMI checkbox (Full Chart only)
  showSmiToggle = true,

  onChange,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderBottom: "1px solid #2b2b2b",
        background: "#0f0f0f",
      }}
    >
      <label style={{ color: "#9ca3af", fontWeight: 600 }}>Indicators</label>

      <div style={{ position: "relative" }}>
        <details>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              color: "#e5e7eb",
              background: "#0b0b0b",
              border: "1px solid #2b2b2b",
              padding: "6px 10px",
              borderRadius: 8,
            }}
          >
            Indicators ▾
          </summary>

          <div
            style={{
              position: "absolute",
              zIndex: 5,
              marginTop: 6,
              background: "#111",
              border: "1px solid #2b2b2b",
              borderRadius: 8,
              padding: 10,
              minWidth: 270,
              color: "#e5e7eb",
            }}
          >
            {/* EMA */}
            <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>EMA</div>
            <label>
              <input
                type="checkbox"
                checked={!!showEma}
                onChange={(e) => onChange?.({ showEma: e.target.checked })}
              />{" "}
              Enable EMA
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              <label>
                <input
                  type="checkbox"
                  checked={!!ema10}
                  onChange={(e) => onChange?.({ ema10: e.target.checked })}
                />{" "}
                EMA 10
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!ema20}
                  onChange={(e) => onChange?.({ ema20: e.target.checked })}
                />{" "}
                EMA 20
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!ema50}
                  onChange={(e) => onChange?.({ ema50: e.target.checked })}
                />{" "}
                EMA 50
              </label>
            </div>

            <div style={{ height: 1, background: "#2b2b2b", margin: "10px 0" }} />

            {/* Volume */}
            <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>Volume</div>
            <label>
              <input
                type="checkbox"
                checked={!!volume}
                onChange={(e) => onChange?.({ volume: e.target.checked })}
              />{" "}
              Show Volume Histogram
            </label>

            <div style={{ height: 1, background: "#2b2b2b", margin: "10px 0" }} />

            {/* Overlays */}
            <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>Overlays</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label>
                <input
                  type="checkbox"
                  checked={!!moneyFlow}
                  onChange={(e) => onChange?.({ moneyFlow: e.target.checked })}
                />{" "}
                Money Flow Profile (right)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!luxSr}
                  onChange={(e) => onChange?.({ luxSr: e.target.checked })}
                />{" "}
                Lux S/R (lines + breaks)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!swingLiquidity}
                  onChange={(e) => onChange?.({ swingLiquidity: e.target.checked })}
                />{" "}
                Swing Liquidity (pivots)
              </label>
            </div>

            <div style={{ height: 1, background: "#2b2b2b", margin: "10px 0" }} />

            {/* Oscillators */}
            <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>Oscillators</div>
            {showSmiToggle ? (
              <label>
                <input
                  type="checkbox"
                  checked={!!smi}
                  onChange={(e) => onChange?.({ smi: e.target.checked })}
                />{" "}
                SMI (K=12, D=7, EMA=5)
              </label>
            ) : (
              <div style={{ opacity: 0.6 }}>SMI available in Full Chart</div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
