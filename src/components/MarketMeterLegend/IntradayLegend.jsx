import React from "react";

/* ------------------------------- UI chips ------------------------------- */
function Chip({ tone = "neutral", text }) {
  const map =
    {
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

function Row({ label, sub, bullets }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: "#f9fafb", fontWeight: 900, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ color: "#a3a3a3", fontSize: 12, marginBottom: 6 }}>{sub}</div>}
      <ul style={{ margin: 0, paddingLeft: 16, color: "#e5e7eb", lineHeight: 1.5 }}>
        {bullets.map((b, idx) => (
          <li key={idx} style={{ marginBottom: 3 }}>
            <span style={{ marginRight: 8 }}>{b.range}</span>
            {b.chips?.map((c, i) => <Chip key={i} tone={c.tone} text={c.text} />)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------- Intraday Legend --------------------------- */
export default function IntradayLegend() {
  return (
    <div>
      <div style={{ color: "#f9fafb", fontSize: 16, fontWeight: 900, marginBottom: 12 }}>
        Market Meter — Intraday Legend
      </div>

      {/* Overall (10m) from weighted components: EMA 40 / Momentum 25 / Breadth 10 / Squeeze 10 / Liquidity 10 / Risk-On 5 */}
      <Row
        label="Overall (10m)"
        sub="Composite: EMA 40, Momentum 25, Breadth 10, Squeeze 10, Liquidity 10, Risk-On 5"
        bullets={[
          { range: "0–44%",  chips: [{ tone: "weak",    text: "Weak / risk-off bias" }] },
          { range: "45–64%", chips: [{ tone: "neutral", text: "Neutral / mixed" }] },
          { range: "≥ 65%",  chips: [{ tone: "strong",  text: "Strong / risk-on bias" }] },
        ]}
      />

      {/* Breadth = ΣNH / (ΣNH + ΣNL) */}
      <Row
        label="Breadth"
        sub="Formula: Breadth% = ΣNH / (ΣNH + ΣNL)"
        bullets={[
          { range: "0–34%",  chips: [{ tone: "weak",    text: "Weak" }] },
          { range: "35–64%", chips: [{ tone: "neutral", text: "Neutral" }] },
          { range: "65–84%", chips: [{ tone: "strong",  text: "Strong" }] },
          { range: "85–100%",chips: [{ tone: "warn",    text: "Extreme / overextended" }] },
        ]}
      />

      {/* Momentum = ΣUp / (ΣUp + ΣDown) */}
      <Row
        label="Momentum"
        sub="Formula: Momentum% = ΣUp / (ΣUp + ΣDown)"
        bullets={[
          { range: "0–34%",  chips: [{ tone: "weak",    text: "Bearish" }] },
          { range: "35–64%", chips: [{ tone: "neutral", text: "Neutral" }] },
          { range: "65–84%", chips: [{ tone: "strong",  text: "Bullish" }] },
          { range: "85–100%",chips: [{ tone: "warn",    text: "Extreme / blow-off risk" }] },
        ]}
      />

      {/* Intraday Squeeze (BB/KC over last ~6 x 10m bars; higher = tighter) */}
      <Row
        label="Intraday Squeeze (Expansion %)"
        bullets={[
          { range: "0–34%",  chips: [{ tone: "weak", text: "Tight / compressed" }] },
          { range: "35–64%", chips: [{ tone: "neutral", text: "Normal" }] },
          { range: "65–84%", chips: [{ tone: "strong", text: "Expanding" }] },
          { range: "85–100%", chips: [{ tone: "strong", text: "Breakout / trending" }] },
        ]}
      />


      {/* Volatility = 100 * EMA(TR,3) / Close — raw 10m; scaled≈ ×6.25 for daily feel */}
      <Row
        label="Volatility (10-minute ATR%)"
        sub="Raw: 100 × EMA(TR, 3) ÷ Close on 10-minute bars. For display, daily-scaled ≈ ×6.25."
        bullets={[
          { range: "< 0.40%",  chips: [{ tone: "strong",  text: "Calm" }] },
          { range: "0.40–1.00%", chips: [{ tone: "neutral", text: "Normal" }] },
          { range: "> 1.00%",   chips: [{ tone: "weak",    text: "High / expanding" }] },
        ]}
      />

      {/* Liquidity = 100 * EMA(Vol,3)/EMA(Vol,12); PSI 0..200 (floored at 0) */}
      <Row
        label="Liquidity (PSI)"
        sub="Formula: 100 × EMA(Vol, 3) ÷ EMA(Vol, 12); floored at 0, typical range 0–120"
        bullets={[
          { range: "≥ 60",   chips: [{ tone: "strong",  text: "Good" }] },
          { range: "40–59",  chips: [{ tone: "neutral", text: "Normal" }] },
          { range: "< 40",   chips: [{ tone: "weak",    text: "Thin" }] },
        ]}
      />

      {/* Sector Direction (Rising%) and Risk-On (10m) */}
      <Row
        label="Sector Direction (10m)"
        sub="Rising% = % of sectors with Breadth% > 50"
        bullets={[
          { range: "< 45",   chips: [{ tone: "weak",    text: "Few rising" }] },
          { range: "45–59",  chips: [{ tone: "neutral", text: "Mixed" }] },
          { range: "≥ 60",   chips: [{ tone: "strong",  text: "Broadly rising" }] },
        ]}
      />

      <Row
        label="Risk-On (10m)"
        sub="(# offensive sectors > 50) + (# defensive sectors < 50) normalized over considered"
        bullets={[
          { range: "< 45",   chips: [{ tone: "weak",    text: "Risk-off" }] },
          { range: "45–59",  chips: [{ tone: "neutral", text: "Neutral" }] },
          { range: "≥ 60",   chips: [{ tone: "strong",  text: "Risk-on" }] },
        ]}
      />
    </div>
  );
}
