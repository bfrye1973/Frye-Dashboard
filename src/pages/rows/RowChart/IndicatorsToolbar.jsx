// src/pages/rows/RowChart/IndicatorsToolbar.jsx
// v3.6 — Minimal toolbar for SMZ system
// Keeps ONLY:
// - EMA
// - Volume
// - Institutional Zones (auto)
// - Acc/Dist Shelves (auto)

import React from "react";

/**
 * IndicatorsToolbar
 * Props:
 * - showEma, ema10, ema20, ema50
 * - volume
 * - institutionalZonesAuto
 * - smzShelvesAuto
 * - onChange(patch), onReset()
 */
export default function IndicatorsToolbar({
  // EMA block
  showEma = true,
  ema10 = true,
  ema20 = true,
  ema50 = true,

  // Volume
  volume = true,

  // SMZ overlays
  institutionalZonesAuto = false, // 🟨 Institutional Zones (auto)
  smzShelvesAuto = false,         // 🔵🔴 Acc/Dist Shelves (auto)

  // Handlers
  onChange,
  onReset,
}) {
  const divider = (
    <div
      style={{
        height: 1,
        background: "#2b2b2b",
        margin: "10px 0",
      }}
    />
  );

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
              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>
                EMA
              </div>

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
              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>
                Volume
              </div>

              <label>
                <input
                  type="checkbox"
                  checked={!!volume}
                  onChange={(e) => onChange?.({ volume: e.target.checked })}
                />{" "}
                Show Volume Histogram
              </label>

              {divider}

              {/* SMZ Overlays */}
              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>
                SMZ Overlays
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!institutionalZonesAuto}
                    onChange={(e) =>
                      onChange?.({ institutionalZonesAuto: e.target.checked })
                    }
                  />{" "}
                  Institutional Zones (auto)
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!smzShelvesAuto}
                    onChange={(e) => onChange?.({ smzShelvesAuto: e.target.checked })}
                  />{" "}
                  Acc/Dist Shelves (auto)
                </label>
              </div>

              {divider}

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
