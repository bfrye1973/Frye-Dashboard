// src/pages/rows/RowChart/IndicatorsToolbar.jsx
// v5.0 — matches RowChart v5.0 (no Swing Liquidity), SMI gated by prop

import React from "react";

export default function IndicatorsToolbar({
  // EMA
  showEma, ema10, ema20, ema50,
  // panes
  volume,
  // overlays
  moneyFlow,
  luxSr,
  // SMI gating
  smi,
  showSmiToggle = false,

  onChange,
  onReset,
}) {
  const bool = (v) => !!v;

  return (
    <div style={{ padding: "6px 12px", borderBottom: "1px solid #2b2b2b", display: "flex", gap: 8 }}>
      <div className="dropdown">
        <button
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            padding: "6px 10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Indicators ▾
        </button>

        <div
          className="menu"
          style={{
            position: "absolute",
            zIndex: 10,
            marginTop: 6,
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            padding: 10,
            minWidth: 220,
          }}
        >
          {/* EMA */}
          <div style={{ fontWeight: 700, opacity: 0.9, marginBottom: 6 }}>EMA</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={bool(showEma)}
              onChange={(e) => onChange?.({ showEma: e.target.checked })}
            />
            Enable EMA
          </label>
          <div style={{ marginLeft: 18, display: "grid", gap: 4, marginBottom: 8 }}>
            <label><input type="checkbox" checked={bool(ema10)} onChange={(e)=>onChange?.({ ema10:e.target.checked })}/> EMA 10</label>
            <label><input type="checkbox" checked={bool(ema20)} onChange={(e)=>onChange?.({ ema20:e.target.checked })}/> EMA 20</label>
            <label><input type="checkbox" checked={bool(ema50)} onChange={(e)=>onChange?.({ ema50:e.target.checked })}/> EMA 50</label>
          </div>

          {/* Volume */}
          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 6, marginBottom: 6 }}>Pane</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={bool(volume)}
              onChange={(e) => onChange?.({ volume: e.target.checked })}
            />
            Show Volume Histogram
          </label>

          {/* Overlays */}
          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 12, marginBottom: 6 }}>Overlays</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={bool(moneyFlow)}
              onChange={(e) => onChange?.({ moneyFlow: e.target.checked })}
            />
            Money Flow Profile (right)
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={bool(luxSr)}
              onChange={(e) => onChange?.({ luxSr: e.target.checked })}
            />
            Lux S/R (lines + breaks)
          </label>

          {/* Oscillators */}
          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 12, marginBottom: 6 }}>Oscillators</div>
          {showSmiToggle ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={bool(smi)}
                onChange={(e) => onChange?.({ smi: e.target.checked })}
              />
              SMI (K:12, D:7, EMA:5)
            </label>
          ) : (
            <div style={{ opacity: 0.5, fontSize: 12 }}>SMI available on Full Chart only</div>
          )}

          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => onReset?.()}
              style={{
                background: "#111",
                color: "#e5e7eb",
                border: "1px solid #2b2b2b",
                borderRadius: 6,
                padding: "4px 8px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
