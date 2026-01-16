// src/pages/rows/RowChart/IndicatorsToolbar.jsx
// v3.9 — Minimal toolbar for SMZ system + Engine 2 Fib (Multi-degree + per-toggle settings)
// Keeps:
// - EMA
// - Volume
// - Institutional Zones (auto)
// - Acc/Dist Shelves (auto)
// Adds:
// - Fib (Intermediate) + ⚙ settings
// - Fib (Minor) + ⚙ settings
// - Fib (Minute) + ⚙ settings

import React from "react";

/* -------------------- small UI helpers -------------------- */
function ColorInput({ value, onChange }) {
  return (
    <input
      type="color"
      value={value || "#ffd54a"}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        width: 34,
        height: 22,
        border: "1px solid #2b2b2b",
        background: "transparent",
        borderRadius: 6,
        cursor: "pointer",
      }}
      title="Pick color"
    />
  );
}

function Slider({ min, max, step, value, onChange }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange?.(Number(e.target.value))}
      style={{ width: "100%" }}
    />
  );
}

function SettingsBlock({ styleObj, onPatch }) {
  const s = styleObj || {};
  const fontPx = Number.isFinite(s.fontPx) ? s.fontPx : 18;
  const lineWidth = Number.isFinite(s.lineWidth) ? s.lineWidth : 3;

  return (
    <div
      style={{
        marginTop: 8,
        width: 260,
        background: "#0b0b0b",
        border: "1px solid #2b2b2b",
        borderRadius: 10,
        padding: 10,
      }}
    >
      {/* Color */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px 1fr",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Color</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ColorInput value={s.color || "#ffd54a"} onChange={(v) => onPatch?.({ color: v })} />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>{s.color || "#ffd54a"}</span>
        </div>
      </div>

      {/* Font size */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px 1fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Font</div>
        <div>
          <Slider min={10} max={64} step={1} value={fontPx} onChange={(v) => onPatch?.({ fontPx: v })} />
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{fontPx}px</div>
        </div>
      </div>

      {/* Line thickness */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px 1fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Line</div>
        <div>
          <Slider min={1} max={12} step={0.5} value={lineWidth} onChange={(v) => onPatch?.({ lineWidth: v })} />
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{lineWidth}px</div>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={s.showAnchors !== false}
            onChange={(e) => onPatch?.({ showAnchors: e.target.checked })}
          />
          Show Anchors
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={s.showRetrace !== false}
            onChange={(e) => onPatch?.({ showRetrace: e.target.checked })}
          />
          Show Retrace
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={s.showExtensions !== false}
            onChange={(e) => onPatch?.({ showExtensions: e.target.checked })}
          />
          Show Extensions
        </label>
      </div>
    </div>
  );
}

function FibRow({
  label,
  enabled,
  styleObj,
  onToggle,
  onStylePatch,
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={!!enabled} onChange={(e) => onToggle?.(e.target.checked)} />
          <span style={{ fontWeight: 800 }}>{label}</span>
        </label>

        <details>
          <summary
            style={{
              cursor: "pointer",
              userSelect: "none",
              color: "#e5e7eb",
              fontWeight: 800,
            }}
            title="Settings"
          >
            ⚙
          </summary>
          <SettingsBlock styleObj={styleObj} onPatch={onStylePatch} />
        </details>
      </div>
    </div>
  );
}

/**
 * IndicatorsToolbar
 * Props:
 * - showEma, ema10, ema20, ema50
 * - volume
 * - institutionalZonesAuto
 * - smzShelvesAuto
 * - fibIntermediate, fibMinor, fibMinute
 * - fibIntermediateStyle, fibMinorStyle, fibMinuteStyle
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
  institutionalZonesAuto = false,
  smzShelvesAuto = false,

  // Engine 2 Fib (multi-degree)
  fibIntermediate = false,
  fibMinor = false,
  fibMinute = false,

  fibIntermediateStyle,
  fibMinorStyle,
  fibMinuteStyle,

  // Handlers
  onChange,
  onReset,
}) {
  const divider = (
    <div style={{ height: 1, background: "#2b2b2b", margin: "10px 0" }} />
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
        minWidth: 340,
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
                    onChange={(e) => onChange?.({ institutionalZonesAuto: e.target.checked })}
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

              {/* Engine 2 (Fib) — Multi-degree */}
              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                Engine 2 (Fib) — Multi-Degree
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <FibRow
                  label="Fib (Intermediate)"
                  enabled={fibIntermediate}
                  styleObj={fibIntermediateStyle}
                  onToggle={(v) => onChange?.({ fibIntermediate: v })}
                  onStylePatch={(patch) =>
                    onChange?.({
                      fibIntermediateStyle: { ...(fibIntermediateStyle || {}), ...patch },
                    })
                  }
                />

                <FibRow
                  label="Fib (Minor)"
                  enabled={fibMinor}
                  styleObj={fibMinorStyle}
                  onToggle={(v) => onChange?.({ fibMinor: v })}
                  onStylePatch={(patch) =>
                    onChange?.({
                      fibMinorStyle: { ...(fibMinorStyle || {}), ...patch },
                    })
                  }
                />

                <FibRow
                  label="Fib (Minute)"
                  enabled={fibMinute}
                  styleObj={fibMinuteStyle}
                  onToggle={(v) => onChange?.({ fibMinute: v })}
                  onStylePatch={(patch) =>
                    onChange?.({
                      fibMinuteStyle: { ...(fibMinuteStyle || {}), ...patch },
                    })
                  }
                />
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
