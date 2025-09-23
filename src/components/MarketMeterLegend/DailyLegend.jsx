// src/components/MarketMeterLegend/DailyLegend.jsx
import React from "react";

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

/** Daily legend (right panel) */
export default function DailyLegend() {
  return (
    <div>
      <div style={{ color: "#f9fafb", fontSize: 16, fontWeight: 900, marginBottom: 10 }}>
        Market Meter — Daily Legend
      </div>

      {/* Daily Trend (emaSlope) */}
      <Row
        label="Daily Trend (composite, emaSlope)"
        bullets={[
          { range: "< −5",   chips: [{ tone: "weak", text: "Downtrend" }] },
          { range: "−5..+5", chips: [{ tone: "neutral", text: "Flat / Neutral" }] },
          { range: "> +5",   chips: [{ tone: "strong", text: "Uptrend" }] },
        ]}
      />

      {/* Participation */}
      <Row
        label="Participation (% sectors above MA)"
        bullets={[
          { range: "0–34%",  chips: [{ tone: "weak", text: "Weak" }] },
          { range: "35–59%", chips: [{ tone: "neutral", text: "Neutral" }] },
          { range: "60–100%",chips: [{ tone: "strong", text: "Strong" }] },
        ]}
      />

      {/* Daily Squeeze (Lux PSI; inverted) */}
      <Row
        label="Daily Squeeze (Lux PSI; higher = tighter)"
        bullets={[
          { range: "0–79",   chips: [{ tone: "strong", text: "Expanded" }] },
          { range: "80–84",  chips: [{ tone: "neutral", text: "Tightening" }] },
          { range: "≥85",    chips: [{ tone: "weak", text: "Critical" }] },
        ]}
      />

      {/* Volatility Regime */}
      <Row
        label="Volatility Regime (band)"
        bullets={[
          { range: "Calm",      chips: [{ tone: "strong", text: "Calm" }] },
          { range: "Elevated",  chips: [{ tone: "neutral", text: "Elevated" }] },
          { range: "High",      chips: [{ tone: "weak", text: "High" }] },
        ]}
      />

      {/* Liquidity Regime */}
      <Row
        label="Liquidity Regime (band)"
        bullets={[
          { range: "Good",   chips: [{ tone: "strong", text: "Good" }] },
          { range: "Normal", chips: [{ tone: "neutral", text: "Normal" }] },
          { range: "Light/Thin", chips: [{ tone: "weak", text: "Light/Thin" }] },
        ]}
      />

      {/* Risk-On Daily */}
      <Row
        label="Risk On (Daily)"
        bullets={[
          { range: "<45",    chips: [{ tone: "weak", text: "Risk-Off" }] },
          { range: "45–59",  chips: [{ tone: "neutral", text: "Mixed" }] },
          { range: "≥60",    chips: [{ tone: "strong", text: "Risk-On" }] },
        ]}
      />
    </div>
  );
}
