// src/pages/rows/RowChart/IndicatorsToolbar.jsx
// v5.1 — Adds Swing Liquidity back (OFF by default), SMI gated

import React from "react";

export default function IndicatorsToolbar({
  // EMA
  showEma, ema10, ema20, ema50,
  // panes
  volume,
  // overlays
  moneyFlow,
  luxSr,
  swingLiquidity,         // ⬅️ new prop
  // oscillator (gated on Full Chart)
  smi,
  showSmiToggle = false,
  onChange,
  onReset,
}) {
  const B = (v) => !!v;

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
            minWidth: 240,
          }}
        >
          {/* EMA */}
          <div style={{ fontWeight: 700, opacity: 0.9, marginBottom: 6 }}>EMA</div>
          <label><input type="checkbox" checked={B(showEma)} onChange={(e)=>onChange?.({ showEma:e.target.checked })}/> Enable EMA</label>
          <div style={{ marginLeft: 18, display: "grid", gap: 4, marginBottom: 8 }}>
            <label><input type="checkbox" checked={B(ema10)} onChange={(e)=>onChange?.({ ema10:e.target.checked })}/> EMA 10</label>
            <label><input type="checkbox" checked={B(ema20)} onChange={(e)=>onChange?.({ ema20:e.target.checked })}/> EMA 20</label>
            <label><input type="checkbox" checked={B(ema50)} onChange={(e)=>onChange?.({ ema50:e.target.checked })}/> EMA 50</label>
          </div>

          {/* Pane */}
          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 6, marginBottom: 6 }}>Pane</div>
          <label><input type="checkbox" checked={B(volume)} onChange={(e)=>onChange?.({ volume:e.target.checked })}/> Show Volume Histogram</label>

          {/* Overlays */}
          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 12, marginBottom: 6 }}>Overlays</div>
          <label><input type="checkbox" checked={B(moneyFlow)} onChange={(e)=>onChange?.({ moneyFlow:e.target.checked })}/> Money Flow Profile (right)</label>
          <label><input type="checkbox" checked={B(luxSr)} onChange={(e)=>onChange?.({ luxSr:e.target.checked })}/> Lux S/R (lines + breaks)</label>
          <label><input type="checkbox" checked={B(swingLiquidity)} onChange={(e)=>onChange?.({ swingLiquidity:e.target.checked })}/> Swing Liquidity (pivots)</label>

          {/* Oscillators */}
          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 12, marginBottom: 6 }}>Oscillators</div>
          {showSmiToggle ? (
            <label><input type="checkbox" checked={B(smi)} onChange={(e)=>onChange?.({ smi:e.target.checked })}/> SMI (K:12, D:7, EMA:5)</label>
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
