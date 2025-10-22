// src/pages/rows/RowChart/IndicatorsToolbar.jsx
// v3.2 — Adds Shelves (Dual 1h) toggle alongside existing overlays.

import React from "react";

/**
 * IndicatorsToolbar
 * Props (all optional; parent RowChart supplies live state):
 * - showEma, ema10, ema20, ema50
 * - volume
 * - moneyFlow, luxSr, swingLiquidity
 * - smi1h
 * - shelvesDual   <-- NEW (blue/yellow dual shelves)
 * - onChange(patch), onReset()
 */
export default function IndicatorsToolbar({
  // EMAs
  showEma = true,
  ema10 = true,
  ema20 = true,
  ema50 = true,

  // Volume
  volume = true,

  // Overlays (price pane)
  moneyFlow = false,
  luxSr = false,
  swingLiquidity = false,

  // Oscillators (bottom pane)
  smi1h = false,

  // New shelves overlay (price pane)
  shelvesDual = false,

  onChange,
  onReset,
}) {
  const divider = <div style={{ height: 1, background: "#2b2b2b", margin: "10px 0" }} />;

  const wrap = (children) => (
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
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
      }}
    >
      {children}
    </div>
  );

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
              userSelect: "none",
            }}
          >
            Indicators ▾
          </summary>

          {wrap(
            <>
              {/* EMAs */}
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

              {divider}

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

              {divider}

              {/* Overlays (price pane) */}
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
                <label>
                  <input
                    type="checkbox"
                    checked={!!shelvesDual}
                    onChange={(e) => onChange?.({ shelvesDual: e.target.checked })}
                  />{" "}
                  Shelves (Dual 1h) — blue/yellow
                </label>
              </div>
                <label>
                 <input
                   type="checkbox"
                   checked={!!shelvesFour}
                   onChange={(e) => onChange?.({ shelvesFour: e.target.checked })}
              />{" "}
              Shelves (1h + 10m) — 2×Blue/Yellow
            </lab
              {divider}

              {/* Oscillators (bottom pane) */}
              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>Oscillators</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!smi1h}
                    onChange={(e) => onChange?.({ smi1h: e.target.checked })}
                  />{" "}
                    SMI (1h) — bottom pane
                </label>
              </div>

              {divider}

              {/* Reset */}
              <button
                type="button"
                onClick={() => onReset?.()}
                style={{
                  width: "100%",
                  background: "#0b0b0b",
                  color: "#e5e7eb",
                  border: "1px solid #2b2b2b",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Reset to EMAs + Volume only"
              >
                Reset to Defaults
              </button>
            </>
          )}
        </details>
      </div>
    </div>
  );
}
