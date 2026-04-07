// src/pages/rows/RowChart/IndicatorsToolbar.jsx
// Engine 17 + Premarket Fib controls

import React from "react";

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

  const color = s.color || "#ffd54a";
  const fontPx = Number.isFinite(s.fontPx) ? s.fontPx : 18;
  const lineWidth = Number.isFinite(s.lineWidth) ? s.lineWidth : 3;

  const showAnchors = s.showAnchors !== false;
  const showRetrace = s.showRetrace !== false;
  const showExtensions = s.showExtensions !== false;

  const showWaveLabels = s.showWaveLabels === true;
  const showWaveLines = s.showWaveLines === true;

  const waveLabelColor = s.waveLabelColor || color;
  const waveLabelFontPx = Number.isFinite(s.waveLabelFontPx) ? s.waveLabelFontPx : fontPx;

  const waveLineColor = s.waveLineColor || color;
  const waveLineWidth = Number.isFinite(s.waveLineWidth) ? s.waveLineWidth : Math.max(2, lineWidth);

  return (
    <div
      style={{
        marginTop: 8,
        width: 300,
        background: "#0b0b0b",
        border: "1px solid #2b2b2b",
        borderRadius: 10,
        padding: 10,
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
        Fib Visuals
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Color</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ColorInput value={color} onChange={(v) => onPatch?.({ color: v })} />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>{color}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
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

      <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input type="checkbox" checked={showAnchors} onChange={(e) => onPatch?.({ showAnchors: e.target.checked })} />
          Show Anchors
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input type="checkbox" checked={showRetrace} onChange={(e) => onPatch?.({ showRetrace: e.target.checked })} />
          Show Retrace
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={showExtensions}
            onChange={(e) => onPatch?.({ showExtensions: e.target.checked })}
          />
          Show Extensions
        </label>
      </div>

      <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
        Elliott (Manual) Labels & Lines
      </div>

      <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={showWaveLabels}
            onChange={(e) => onPatch?.({ showWaveLabels: e.target.checked })}
          />
          Show Wave Labels
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={showWaveLines}
            onChange={(e) => onPatch?.({ showWaveLines: e.target.checked })}
          />
          Show Wave Lines
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Label Color</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ColorInput value={waveLabelColor} onChange={(v) => onPatch?.({ waveLabelColor: v })} />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>{waveLabelColor}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Label Font</div>
        <div>
          <Slider
            min={10}
            max={72}
            step={1}
            value={waveLabelFontPx}
            onChange={(v) => onPatch?.({ waveLabelFontPx: v })}
          />
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{waveLabelFontPx}px</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Line Color</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ColorInput value={waveLineColor} onChange={(v) => onPatch?.({ waveLineColor: v })} />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>{waveLineColor}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
          gap: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Line Width</div>
        <div>
          <Slider
            min={1}
            max={12}
            step={0.5}
            value={waveLineWidth}
            onChange={(v) => onPatch?.({ waveLineWidth: v })}
          />
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{waveLineWidth}px</div>
        </div>
      </div>
    </div>
  );
}

function FibRow({ label, enabled, styleObj, onToggle, onStylePatch }) {
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

export default function IndicatorsToolbar({
  showEma = true,
  ema10 = true,
  ema20 = true,
  ema50 = true,
  ema200 = true,
  volume = true,

  institutionalZonesAuto = false,
  smzShelvesAuto = false,

  fibPrimary = false,
  fibIntermediate = false,
  fibMinor = false,
  fibMinute = false,

  fibPrimaryStyle,
  fibIntermediateStyle,
  fibMinorStyle,
  fibMinuteStyle,

  engine17Overlay = true,
  engine17Timeline = true,
  engine17Badges = true,
  engine17StateOverlay = true,
  engine17Signals = true,
  engine17TriggerLine = true,
  engine17DebugPanel = false,

  showPremarketFibs = false,

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
        minWidth: 420,
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
                <label>
                  <input
                    type="checkbox"
                    checked={!!ema200}
                    onChange={(e) => onChange?.({ ema200: e.target.checked })}
                 />{" "}
                 EMA 200
               </label>
              </div>

              {divider}

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

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>SMZ Overlays</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!institutionalZonesAuto}
                    onChange={(e) => {
                      const v = e.target.checked;
                      onChange?.({ institutionalZonesAuto: v, smzShelvesAuto: v });
                    }}
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

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                Engine 17 — Snapshot Truth
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17Overlay}
                    onChange={(e) => onChange?.({ engine17Overlay: e.target.checked })}
                  />{" "}
                  Enable Engine 17
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17StateOverlay}
                    onChange={(e) => onChange?.({ engine17StateOverlay: e.target.checked })}
                  />{" "}
                  State Overlay
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17Timeline}
                    onChange={(e) => onChange?.({ engine17Timeline: e.target.checked })}
                  />{" "}
                  Decision Timeline
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17Badges}
                    onChange={(e) => onChange?.({ engine17Badges: e.target.checked })}
                  />{" "}
                  Top-Right Pills
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17Signals}
                    onChange={(e) => onChange?.({ engine17Signals: e.target.checked })}
                  />{" "}
                  Signal Markers
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17TriggerLine}
                    onChange={(e) => onChange?.({ engine17TriggerLine: e.target.checked })}
                  />{" "}
                  Trigger Line
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17DebugPanel}
                    onChange={(e) => onChange?.({ engine17DebugPanel: e.target.checked })}
                  />{" "}
                  Debug Panel (Raw vs Composed)
                </label>
              </div>

              {divider}

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                Premarket Fibs
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!showPremarketFibs}
                    onChange={(e) => onChange?.({ showPremarketFibs: e.target.checked })}
                  />{" "}
                  Premarket Fibs (raw E16)
                </label>
              </div>

              {divider}

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                Engine 2 (Fib) — Multi-Degree
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <FibRow
                  label="Fib (Primary)"
                  enabled={fibPrimary}
                  styleObj={fibPrimaryStyle}
                  onToggle={(v) => onChange?.({ fibPrimary: v })}
                  onStylePatch={(patch) =>
                    onChange?.({ fibPrimaryStyle: { ...(fibPrimaryStyle || {}), ...patch } })
                  }
                />

                <FibRow
                  label="Fib (Intermediate)"
                  enabled={fibIntermediate}
                  styleObj={fibIntermediateStyle}
                  onToggle={(v) => onChange?.({ fibIntermediate: v })}
                  onStylePatch={(patch) =>
                    onChange?.({ fibIntermediateStyle: { ...(fibIntermediateStyle || {}), ...patch } })
                  }
                />

                <FibRow
                  label="Fib (Minor)"
                  enabled={fibMinor}
                  styleObj={fibMinorStyle}
                  onToggle={(v) => onChange?.({ fibMinor: v })}
                  onStylePatch={(patch) =>
                    onChange?.({ fibMinorStyle: { ...(fibMinorStyle || {}), ...patch } })
                  }
                />

                <FibRow
                  label="Fib (Minute)"
                  enabled={fibMinute}
                  styleObj={fibMinuteStyle}
                  onToggle={(v) => onChange?.({ fibMinute: v })}
                  onStylePatch={(patch) =>
                    onChange?.({ fibMinuteStyle: { ...(fibMinuteStyle || {}), ...patch } })
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
                title="Reset to defaults"
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
