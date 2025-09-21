// src/pages/rows/RowStrategies/index.jsx
import React from "react";

/**
 * RowStrategies — Compact Cards (B3.1)
 * - 3 strategy cards
 * - No long bullet lists (keeps Row 5 short)
 * - UI only, no data wiring yet
 */
export default function RowStrategies() {
  return (
    <div style={styles.wrap}>
      <StrategyCard
        title="SPY/QQQ Index-Alignment Scalper"
        timeframe="10m"
        status={{ text: "On Deck", tone: "info" }}
        score={72}
        lastSignal="Long bias • 9:50 ET"
        plToday="+$0"
        ctas={[
          { label: "Load SPY (10m)", onClick: noop },
          { label: "Load QQQ (10m)", onClick: noop },
        ]}
      />

      <StrategyCard
        title="Wave 3 Breakout"
        timeframe="Daily"
        status={{ text: "Flat", tone: "muted" }}
        score={64}
        lastSignal="On deck candidate"
        plToday="—"
        ctas={[{ label: "Top Candidate (Daily)", onClick: noop }]}
      />

      <StrategyCard
        title="Flagpole Breakout"
        timeframe="Daily"
        status={{ text: "Caution", tone: "warn" }}
        score={58}
        lastSignal="Tight flag forming"
        plToday="—"
        ctas={[{ label: "Top Candidate (Daily)", onClick: noop }]}
      />
    </div>
  );
}

function StrategyCard({
  title,
  timeframe,
  status,
  score = 0,
  lastSignal,
  plToday,
  ctas = [],
}) {
  const tone = toneStyles(status?.tone || "muted");
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={styles.title}>{title}</div>
          <span style={styles.badge}>{timeframe}</span>
        </div>
        <span style={{ ...styles.statusPill, ...tone.pill }}>{status?.text}</span>
      </div>

      <div style={styles.scoreRow}>
        <div style={styles.scoreLabel}>Score</div>
        <div style={styles.progress}>
          <div style={{ ...styles.progressFill, width: `${pct}%` }} />
        </div>
        <div style={styles.scoreValue}>{pct}</div>
      </div>

      <div style={styles.metaRow}>
        <div><span style={styles.metaKey}>Last:</span> {lastSignal}</div>
        <div><span style={styles.metaKey}>P/L Today:</span> {plToday}</div>
      </div>

      <div style={styles.ctaRow}>
        {ctas.map((c, i) => (
          <button key={i} onClick={c.onClick} style={styles.ctaBtn}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function noop() {
  console.log("RowStrategies: noop (C1 will wire this).");
}

const styles = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  card: {
    background: "#121212",
    border: "1px solid #2b2b2b",
    borderRadius: 12,
    padding: 12,
    color: "#e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 120,
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { fontWeight: 700, fontSize: 16 },
  badge: {
    background: "#0b0b0b",
    border: "1px solid #2b2b2b",
    color: "#9ca3af",
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    fontWeight: 700,
  },
  statusPill: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #2b2b2b",
    fontWeight: 700,
  },
  scoreRow: {
    display: "grid",
    gridTemplateColumns: "60px 1fr 40px",
    alignItems: "center",
    gap: 8,
  },
  scoreLabel: { color: "#9ca3af", fontSize: 12 },
  progress: {
    background: "#1f2937",
    borderRadius: 8,
    height: 8,
    overflow: "hidden",
    border: "1px solid #334155",
  },
  progressFill: {
    height: "100%",
    background:
      "linear-gradient(90deg, #22c55e 0%, #84cc16 40%, #f59e0b 70%, #ef4444 100%)",
  },
  scoreValue: { textAlign: "right", fontWeight: 700 },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    fontSize: 12,
    color: "#cbd5e1",
  },
  metaKey: { color: "#9ca3af", marginRight: 6, fontWeight: 600 },
  ctaRow: { display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" },
  ctaBtn: {
    background: "#0b0b0b",
    color: "#e5e7eb",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 700,
    cursor: "pointer",
  },
};

function toneStyles(kind) {
  switch (kind) {
    case "info":
      return { pill: { background: "#0b1220", color: "#93c5fd", borderColor: "#1e3a8a" } };
    case "warn":
      return { pill: { background: "#1b1409", color: "#fbbf24", borderColor: "#92400e" } };
    case "ok":
      return { pill: { background: "#07140d", color: "#86efac", borderColor: "#166534" } };
    default:
      return { pill: { background: "#0b0b0b", color: "#94a3b8", borderColor: "#2b2b2b" } };
  }
}
