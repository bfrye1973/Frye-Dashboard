// src/pages/rows/RowChart/Controls.jsx

export default function Controls({
  symbols = [],
  timeframes = [],
  value = {},
  onChange,
  onRange, // viewport-only (no reseed/trim)
  onTest,
}) {
  const symbol = value.symbol ?? "SPY";
  const timeframe = value.timeframe ?? "10m";
  const range = value.range ?? "ALL"; // ⟵ default to ALL
  const disabled = !!value.disabled;

  const ranges = ["ALL", 50, 100, 200];
  const fullChartHref = `/chart?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(timeframe)}`;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "10px 12px",
        borderBottom: "1px solid #2b2b2b",
        background: "#111111",
      }}
    >
      <div style={{ fontWeight: 600, color: "#e5e7eb" }}>Chart</div>

      <label style={{ color: "#9ca3af" }}>Symbol</label>
      <select
        value={symbol}
        disabled={disabled}
        onChange={(e) => onChange?.({ symbol: e.target.value })}
        style={selectStyle}
      >
        {(symbols.length ? symbols : ["SPY", "QQQ", "IWM"]).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <label style={{ color: "#9ca3af" }}>Timeframe</label>
      <select
        value={timeframe}
        disabled={disabled}
        onChange={(e) => onChange?.({ timeframe: e.target.value })}
        style={selectStyle}
      >
        {(timeframes.length ? timeframes : ["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"]).map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#9ca3af" }}>Range</span>

        {ranges.map((n) => {
          const isAll = n === "ALL";
          const active = range === n || (isAll && (range === "FULL")); // legacy support
          return (
            <button
              key={String(n)}
              disabled={disabled}
              onClick={() => {
                // Keep UI highlight
                onChange?.({ range: n });
                // Move camera
                onRange?.(n);
              }}
              style={rangeBtnStyle(active)}
              title={isAll ? "Show all data" : `Show last ${n} bars`}
            >
              {isAll ? "All" : n}
            </button>
          );
        })}

        <a href={fullChartHref} style={openBtnStyle} title="Open Full Chart">
          Open Full Chart ↗
        </a>

        {onTest && (
          <button onClick={onTest} style={testBtnStyle} title="Force a fetch and show result">
            Test Fetch
          </button>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  background: "#0b0b0b",
  color: "#e5e7eb",
  border: "1px solid #2b2b2b",
  borderRadius: 8,
  padding: "6px 8px",
  minWidth: 84,
};

const rangeBtnStyle = (active) => ({
  background: active ? "#eab308" : "#0b0b0b",
  color: active ? "#111111" : "#e5e7eb",
  border: "1px solid #2b2b2b",
  borderRadius: 8,
  padding: "6px 10px",
  fontWeight: 600,
  cursor: "pointer",
});

const openBtnStyle = {
  background: "#0b0b0b",
  color: "#e5e7eb",
  border: "1px solid #2b2b2b",
  borderRadius: 8,
  padding: "6px 10px",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
};

const testBtnStyle = {
  background: "#eab308",
  color: "#111111",
  border: "none",
  borderRadius: 8,
  padding: "6px 10px",
  fontWeight: 700,
  cursor: "pointer",
};
