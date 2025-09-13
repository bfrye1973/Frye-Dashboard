// src/pages/rows/RowMarketOverview.jsx
import React from "react";

/**
 * RowMarketOverview
 *
 * Props (all optional; defaults prevent "not defined" errors):
 * - breadthPct: number (0..100)
 * - breadthDelta: number (change % or pts)
 * - momentumPct: number (0..100)
 * - momentumDelta: number
 * - squeezePct: number (0..100)
 * - squeezeDelta: number
 *
 * Example:
 * <RowMarketOverview
 *   breadthPct={69}   breadthDelta={+19}
 *   momentumPct={74}  momentumDelta={+24}
 *   squeezePct={82.4} squeezeDelta={+12.4}
 * />
 */

export default function RowMarketOverview(props) {
  // Safe defaults so ESLint doesn't complain and build never fails
  const breadthPct    = toNum(props.breadthPct, 0);
  const breadthDelta  = toNum(props.breadthDelta, 0);
  const momentumPct   = toNum(props.momentumPct, 0);
  const momentumDelta = toNum(props.momentumDelta, 0);
  const squeezePct    = toNum(props.squeezePct, 0);
  const squeezeDelta  = toNum(props.squeezeDelta, 0);

  return (
    <section
      style={{
        border: "1px solid #2b2b2b",
        borderRadius: 12,
        background: "#0b0b0c",
        padding: 12,
      }}
    >
      <header
        style={{
          color: "#e5e7eb",
          fontWeight: 700,
          marginBottom: 8,
          fontSize: 14,
        }}
      >
        Market Meter — Stoplights
      </header>

      {/* Outer wrapper keeps the row centered */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {/* Inner wrapper limits width so the three buttons aren't too wide */}
        <div
          style={{
            display: "flex",
            alignItems: "left",
            justifyContent: "space-between",
            gap: 16,
            width: "100%",
            maxWidth: 420, // 👉 tweak 360–520 to taste
          }}
        >
          <Stoplight
            label="Breadth"
            value={breadthPct}
            delta={breadthDelta}
            color="#22c55e"
          />
          <Stoplight
            label="Momentum"
            value={momentumPct}
            delta={momentumDelta}
            color="#22c55e"
          />
          <Stoplight
            label="Intraday Squeeze"
            value={squeezePct}
            delta={squeezeDelta}
            color="#22c55e"
          />
        </div>
      </div>
    </section>
  );
}

/* -------------------- Small helpers & subcomponents -------------------- */

function toNum(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function Stoplight({ label, value, delta, color = "#22c55e" }) {
  const formattedValue =
    Number.isFinite(value) ? `${round(value, 1)}%` : "—";
  const formattedDelta =
    Number.isFinite(delta) ? `${delta >= 0 ? "↑" : "↓"} ${round(Math.abs(delta), 1)}%` : "—";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        border: "1px solid #2b2b2b",
        borderRadius: 12,
        background: "#0f1113",
        minWidth: 120,
        justifyContent: "center",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: "9999px",
          background: color,
          boxShadow: `0 0 12px 2px ${color}66`,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <div style={{ color: "#e5e7eb", fontSize: 12, opacity: 0.9 }}>{label}</div>
        <div style={{ color: "#e5e7eb", fontWeight: 700 }}>{formattedValue}</div>
        <div
          style={{
            color: delta >= 0 ? "#22c55e" : "#ef4444",
            fontSize: 12,
          }}
        >
          {formattedDelta}
        </div>
      </div>
    </div>
  );
}

function round(n, dp = 2) {
  const p = Math.pow(10, dp);
  return Math.round(n * p) / p;
}
