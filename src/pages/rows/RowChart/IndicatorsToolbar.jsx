// Simple indicators dropdown — for now only EMA toggle; others are placeholders
export default function IndicatorsToolbar({
  showEma,
  ema10 = true,
  ema20 = true,
  ema50 = true,
  onChange,
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 12px", borderBottom: "1px solid #2b2b2b", background: "#0f0f0f"
    }}>
      <label style={{ color: "#9ca3af", fontWeight: 600 }}>Indicators</label>

      <div style={{ position: "relative" }}>
        <details>
          <summary style={{
            listStyle: "none", cursor: "pointer",
            color: "#e5e7eb", background: "#0b0b0b", border: "1px solid #2b2b2b",
            padding: "6px 10px", borderRadius: 8
          }}>
            {showEma ? "EMA (on)" : "EMA (off)"} ▾
          </summary>
          <div style={{
            position: "absolute", zIndex: 5, marginTop: 6,
            background: "#111", border: "1px solid #2b2b2b", borderRadius: 8,
            padding: 10, minWidth: 180
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input type="checkbox" checked={showEma} onChange={(e)=>onChange({ showEma: e.target.checked })}/>
              <span style={{ color: "#e5e7eb" }}>Enable EMA</span>
            </div>

            <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>Lines</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, color: "#e5e7eb" }}>
              <label><input type="checkbox" checked={ema10} onChange={(e)=>onChange({ ema10: e.target.checked })}/> EMA 10</label>
              <label><input type="checkbox" checked={ema20} onChange={(e)=>onChange({ ema20: e.target.checked })}/> EMA 20</label>
              <label><input type="checkbox" checked={ema50} onChange={(e)=>onChange({ ema50: e.target.checked })}/> EMA 50</label>
            </div>

            <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 10, opacity: 0.6 }}>
              (Volume, SMI, SR coming next)
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
