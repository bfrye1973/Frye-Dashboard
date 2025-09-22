// src/pages/rows/RowStrategies/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import { getAlignmentLatest } from "../../../services/signalsService";

/**
 * RowStrategies — Section 5 (compact + live Alignment status)
 * - Shows 3 cards
 * - Alignment card pulls /api/signals?strategy=alignment&limit=1
 * - SPY/QQQ buttons set global selection (10m)
 * - Wave3/Flagpole remain placeholders for now (no network)
 * - Zero layout changes to protect Row 6 (Chart)
 */

export default function RowStrategies() {
  const { setSelection } = useSelection();
  const [align, setAlign] = useState({ loading: true, status: "mock", signal: null });

  // Fetch once on mount, then refresh on a light interval
  useEffect(() => {
    let alive = true;

    async function pull() {
      const res = await getAlignmentLatest();
      if (!alive) return;
      setAlign({ loading: false, ...res });
    }

    pull();
    const id = setInterval(pull, 30_000); // 30s soft refresh
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const alignmentView = useMemo(() => {
    const s = align.signal;
    if (!s) {
      return {
        statusText: align.loading ? "Loading…" : "No Data",
        tone: "muted",
        score: 0,
        last: "—",
        pl: "—",
        failing: [],
      };
    }
    const direction = s.direction || "none";
    const tone =
      direction === "long" ? "ok" : direction === "short" ? "warn" : "muted";
    const statusText =
      direction === "none"
        ? "Flat"
        : s.streak_bars >= 2
        ? "Triggered"
        : "On Deck";
    const last = `${direction === "none" ? "—" : direction.toUpperCase()} • ${fmtTime(s.timestamp)}`;
    const score = Math.round(Math.max(0, Math.min(100, Number(s.confidence || 0))));
    const failing = Array.isArray(s.failing) ? s.failing : [];

    return { statusText, tone, score, last, pl: "—", failing };
  }, [align]);

  const load = (symbol, timeframe = "10m", strategy = "alignment") =>
    setSelection({ symbol, timeframe, strategy });

  return (
    <div style={S.wrap}>
      {/* Card 1 — SPY/QQQ Index-Alignment Scalper (10m) */}
      <Card
        title="SPY/QQQ Index-Alignment Scalper"
        timeframe="10m"
        status={{ text: alignmentView.statusText, tone: alignmentView.tone }}
        score={alignmentView.score}
        last={alignmentView.last}
        pl={alignmentView.pl}
        footNote={alignmentView.failing.length ? `Failing: ${alignmentView.failing.join(", ")}` : ""}
        actions={[
          { label: "Load SPY (10m)", onClick: () => load("SPY", "10m", "alignment") },
          { label: "Load QQQ (10m)", onClick: () => load("QQQ", "10m", "alignment") },
        ]}
      />

      {/* Card 2 — Wave 3 Breakout (Daily) */}
      <Card
        title="Wave 3 Breakout"
        timeframe="Daily"
        status={{ text: "Flat", tone: "muted" }}
        score={64}
        last="On deck candidate"
        pl="—"
        actions={[
          {
            label: "Top Candidate (Daily)",
            onClick: () => setSelection({ symbol: "SPY", timeframe: "1d", strategy: "wave3" }),
          },
        ]}
      />

      {/* Card 3 — Flagpole Breakout (Daily) */}
      <Card
        title="Flagpole Breakout"
        timeframe="Daily"
        status={{ text: "Caution", tone: "warn" }}
        score={58}
        last="Tight flag forming"
        pl="—"
        actions={[
          {
            label: "Top Candidate (Daily)",
            onClick: () => setSelection({ symbol: "SPY", timeframe: "1d", strategy: "flag" }),
          },
        ]}
      />
    </div>
  );
}

/* ---------- Compact Card ---------- */
function Card({ title, timeframe, status, score = 0, last, pl, actions = [], footNote = "" }) {
  const pct = Math.max(0, Math.min(100, score));
  const tone = toneStyles(status?.tone || "muted");

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S.title}>{title}</div>
          <span style={S.badge}>{timeframe}</span>
        </div>
        <span style={{ ...S.pill, ...tone.pill }}>{status?.text}</span>
      </div>

      <div style={S.scoreRow}>
        <div style={S.scoreLabel}>Score</div>
        <div style={S.progress}>
          <div style={{ ...S.progressFill, width: `${pct}%` }} />
        </div>
        <div style={S.scoreVal}>{pct}</div>
      </div>

      <div style={S.metaRow}>
        <div><span style={S.metaKey}>Last:</span> {last}</div>
        <div><span style={S.metaKey}>P/L Today:</span> {pl}</div>
      </div>

      {footNote ? (
        <div style={S.foot}>{footNote}</div>
      ) : null}

      <div style={S.ctaRow}>
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} style={S.btn}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Helpers & Styles ---------- */
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    // show HH:MM (local). You can swap to ET later if desired.
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "—";
  }
}

const S = {
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
  head: {
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
  pill: {
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
  scoreVal: { textAlign: "right", fontWeight: 700 },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    fontSize: 12,
    color: "#cbd5e1",
  },
  metaKey: { color: "#9ca3af", marginRight: 6, fontWeight: 600 },
  foot: { fontSize: 11, color: "#94a3b8" },
  ctaRow: { display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" },
  btn: {
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
