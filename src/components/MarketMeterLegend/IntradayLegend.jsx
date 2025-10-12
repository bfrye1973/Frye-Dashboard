// src/components/MarketMeterLegend/IntradayLegend.jsx
import React from "react";

/** Small color chip used in rows */
function Chip({ tone = "neutral", text }) {
  const map = {
    strong:  { bg: "#22c55e", fg: "#0b1220", bd: "#16a34a" }, // green
    weak:    { bg: "#ef4444", fg: "#fee2e2", bd: "#b91c1c" }, // red
    neutral: { bg: "#facc15", fg: "#111827", bd: "#ca8a04" }, // yellow
    warn:    { bg: "#fb923c", fg: "#111827", bd: "#ea580c" }, // orange
  }[tone] || { bg: "#0b0f17", fg: "#e5e7eb", bd: "#1f2937" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bd}`,
      }}
    >
      {text}
    </span>
  );
}

/** Row with bullet, range label and chip(s) */
function Row({ label, bullets }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#f9fafb", fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 16, color: "#e5e7eb", lineHeight: 1.5 }}>
        {bullets.map((b, idx) => (
          <li key={idx} style={{ marginBottom: 2 }}>
            <span style={{ marginRight: 8 }}>{b.range}</span>
            {b.chips?.map((c, i) => (
              <Chip key={i} tone={c.tone} text={c.text} />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Intraday legend (left panel) */
export default function IntradayLegend() {
  return (
    <div>
      <div style={{ color: "#f9fafb", fontSize: 16, fontWeight: 900, marginBottom: 10 }}>
        Market Meter — Intraday Legend
      </div>

      {/* NEW — Overall composite */}
      <Row
        label="Overall (10m)"
        bullets={[
          { range: "0–44%",  chips: [{ tone: "weak",    text: "Weak / risk-off" }] },
          { range: "45–64%", chips: [{ tone: "neutral", text: "Neutral / mixed" }] },
          { range: "≥ 65%",  chips: [{ tone: "strong",  text: "Strong / risk-on" }] },
        ]}
      />

      {/* Breadth */}
      <Row
        label="Breadth (NH/(NH+NL)%)"
        bullets={[
          { range: "0–34%",  chips: [{ tone: "weak", text: "Weak" }] },
          { range: "35–64%", chips: [{ tone: "neutral", text: "Neutral" }] },
          { range: "65–84%", chips: [{ tone: "strong", text: "Strong" }] },
          { range: "85–100%", chips: [{ tone: "weak", text: "Extreme" }] },
        ]}
      />

      {/* Momentum */}
      <Row
        label="Momentum (3U/(3U+3D)%)"
        bullets={[
          { range: "0–34%",  chips: [{ tone: "weak", text: "Bearish" }] },
          { range: "35–64%", chips: [{ tone: "neutral", text: "Neutral" }] },
          { range: "65–84%", chips: [{ tone: "strong", text: "Bullish" }] },
          { range: "85–100%", chips: [{ tone: "weak", text: "Extreme" }] },
        ]}
      />

      {/* Intraday Squeeze (inverted) */}
      <Row
        label="Intraday Squeeze (0..100; higher = tighter)"
        bullets={[
          { range: "0–34%",  chips: [{ tone: "strong", text: "Expanded" }] },
          { range: "35–64%", chips: [{ tone: "neutral", text: "Normal" }] },
          { range: "65–84%", chips: [{ tone: "warn",   text: "Tight" }] },
          { range: "85–100%", chips: [{ tone: "weak",   text: "Critical" }] },
        ]}
      />

      {/* Volatility */}
      <Row
        label="Volatility (%ATR)"
        bullets={[
          { range: "< 30%",  chips: [{ tone: "strong",  text: "Calm" }] },
          { range: "30–60%", chips: [{ tone: "neutral", text: "Elevated" }] },
          { range: "> 60%",  chips: [{ tone: "weak",    text: "High" }] },
        ]}
      />

      {/* Liquidity */}
      <Row
        label="Liquidity (PSI)"
        bullets={[
          { range: "≥ 60",   chips: [{ tone: "strong",  text: "Good" }] },
          { range: "40–59",  chips: [{ tone: "neutral", text: "Normal" }] },
          { range: "< 40",   chips: [{ tone: "weak",    text: "Thin" }] },
        ]}
      />

      {/* Direction & Risk-On (text helpers) */}
      <div style={{ color: "#e5e7eb", fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
        <div><b>Sector Direction (10m)</b>: Green ≥ 60% sectors rising; Yellow 45–59%; Red &lt;45%.</div>
        <div><b>Risk On (10m)</b>: Green ≥ 60; Yellow 45–59; Red &lt;45.</div>
      </div>
    </div>
  );
}
