// src/pages/rows/RowStrategies/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import { getAlignmentLatest } from "../../../services/signalsService";

/**
 * RowStrategies — Compact + LIVE pill + tiny 7-tab symbol bar
 * - Fonts & paddings reduced to keep Row 5 short (protects Row 6 chart height)
 * - Alignment card shows LIVE/MOCK pill + Triggered/On Deck/Flat
 * - Bottom micro-tabs for SPY, QQQ, IWM, MDY, SPX, NDX, DJI (VIX excluded)
 * - Clicking a tab updates global selection (timeframe=10m) without layout changes
 */

export default function RowStrategies() {
  const { setSelection } = useSelection();
  const [align, setAlign] = useState({ loading: true, status: "mock", signal: null });

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const res = await getAlignmentLatest();
      if (!alive) return;
      setAlign({ loading: false, ...res });
    };
    pull();
    const id = setInterval(pull, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const alignmentView = useMemo(() => {
    const s = align.signal;
    if (!s) {
      return {
        statusText: align.loading ? "Loading…" : "Flat",
        tone: "muted",
        score: 0,
        last: "—",
        failing: [],
        liveStatus: align.status === "live" ? "LIVE" : "MOCK",
      };
    }
    const direction = s.direction || "none";
    const tone = direction === "long" ? "ok" : direction === "short" ? "warn" : "muted";
    const statusText = direction === "none" ? "Flat" : s.streak_bars >= 2 ? "Triggered" : "On Deck";
    const last = `${direction === "none" ? "—" : direction.toUpperCase()} • ${fmtTime(s.timestamp)}`;
    const score = Math.round(Math.max(0, Math.min(100, Number(s.confidence || 0))));
    const failing = Array.isArray(s.failing) ? s.failing : [];
    return { statusText, tone, score, last, failing, liveStatus: align.status === "live" ? "LIVE" : "MOCK" };
  }, [align]);

  const load = (symbol, timeframe = "10m", strategy = "alignment") =>
    setSelection({ symbol, timeframe, strategy });

  return (
    <div style={S.wrap}>
      {/* Alignment Scalper */}
      <Card
        title="SPY/QQQ Index-Alignment Scalper"
        timeframe="10m"
        // Two small pills: LIVE/MOCK + Triggered/On Deck/Flat
        rightPills={[
          { text: alignmentView.liveStatus, tone: alignmentView.liveStatus === "LIVE" ? "live" : "muted" },
          { text: alignmentView.statusText, tone: alignmentView.tone },
        ]}
        score={alignmentView.score}
        last={alignmentView.last}
        pl="—"
        footNote={alignmentView.failing.length ? `Failing: ${alignmentView.failing.join(", ")}` : ""}
        actions={[
          { label: "Load SPY (10m)", onClick: () => load("SPY", "10m", "alignment") },
          { label: "Load QQQ (10m)", onClick: () => load("QQQ", "10m", "alignment") },
        ]}
        // tiny tab bar at bottom (7 tabs, very small)
        bottomTabs={[
          { k: "SPY", on: () => load("SPY", "10m", "alignment") },
          { k: "QQQ", on: () => load("QQQ", "10m", "alignment") },
          { k: "IWM", on: () => load("IWM", "10m", "alignment") },
          { k: "MDY", on: () => load("MDY", "10m", "alignment") },
          { k: "SPX", on: () => load("SPX", "10m", "alignment") }, // assumes symbolBridge maps indices
          { k: "NDX", on: () => load("NDX", "10m", "alignment") },
          { k: "DJI", on: () => load("DJI", "10m", "alignment") },
        ]}
      />

      {/* Wave 3 (Daily) — compact placeholder */}
      <Card
        title="Wave 3 Breakout"
        timeframe="Daily"
        rightPills={[{ text: "Flat", tone: "muted" }]}
        score={64}
        last="On deck candidate"
        pl="—"
        actions={[
          { label: "Top Candidate (Daily)", onClick: () => setSelection({ symbol: "SPY", timeframe: "1d", strategy: "wave3" }) },
        ]}
      />

      {/* Flagpole (Daily) — compact placeholder */}
      <Card
        title="Flagpole Breakout"
        timeframe="Daily"
        rightPills={[{ text: "Caution", tone: "warn" }]}
        score={58}
        last="Tight flag forming"
        pl="—"
        actions={[
          { label: "Top Candidate (Daily)", onClick: () => setSelection({ symbol: "SPY", timeframe: "1d", strategy: "flag" }) },
        ]}
      />
    </div>
  );
}

/* ---------- Compact Card ---------- */
function Card({
  title,
  timeframe,
  rightPills = [],
  score = 0,
  last,
  pl,
  actions = [],
  footNote = "",
  bottomTabs = [],
}) {
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={S.title}>{title}</div>
          <span style={S.badge}>{timeframe}</span>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {rightPills.map((p, i) => (
            <span key={i} style={{ ...S.pill, ...toneStyles(p.tone).pill }}>{p.text}</span>
          ))}
        </div>
      </div>

      <div style={S.scoreRow}>
        <div style={S.scoreLabel}>Score</div>
        <div style={S.progress}><div style={{ ...S.progressFill, width: `${pct}%` }} /></div>
        <div style={S.scoreVal}>{pct}</div>
      </div>

      <div style={S.metaRow}>
        <div><span style={S.metaKey}>Last:</span> {last}</div>
        <div><span style={S.metaKey}>P/L Today:</span> {pl}</div>
      </div>

      {footNote ? <div style={S.foot}>{footNote}</div> : null}

      <div style={S.ctaRow}>
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} style={S.btnSm}>{a.label}</button>
        ))}
      </div>

      {bottomTabs.length ? (
        <div style={S.tabRow}>
          {bottomTabs.map((t) => (
            <button key={t.k} onClick={t.on} style={S.tab}>
              {t.k}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Helpers & Styles ---------- */
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  } catch { return "—"; }
}

const S = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  card: {
    background: "#101010",
    border: "1px solid #262626",
    borderRadius: 10,
    padding: 10,
    color: "#e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 110, // compact
  },
  head: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  title: { fontWeight: 700, fontSize: 14, lineHeight: "16px" },
  badge: {
    background: "#0b0b0b",
    border: "1px solid #2b2b2b",
    color: "#9ca3af",
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 999,
    fontWeight: 700,
  },
  pill: {
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #2b2b2b",
    fontWeight: 700,
    lineHeight: "14px",
  },
  scoreRow: {
    display: "grid",
    gridTemplateColumns: "44px 1fr 28px",
    alignItems: "center",
    gap: 6,
  },
  scoreLabel: { color: "#9ca3af", fontSize: 10 },
  progress: {
    background: "#1f2937",
    borderRadius: 6,
    height: 6,
    overflow: "hidden",
    border: "1px solid #334155",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #22c55e 0%, #84cc16 40%, #f59e0b 70%, #ef4444 100%)",
  },
  scoreVal: { textAlign: "right", fontWeight: 700, fontSize: 12 },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 6,
    fontSize: 11,
    color: "#cbd5e1",
  },
  metaKey: { color: "#9ca3af", marginRight: 4, fontWeight: 600 },
  foot: { fontSize: 10, color: "#94a3b8" },
  ctaRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  btnSm: {
    background: "#0b0b0b",
    color: "#e5e7eb",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "4px 8px",
    fontWeight: 700,
    fontSize: 11,
    cursor: "pointer",
  },
  tabRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 },
  tab: {
    background: "#141414",
    color: "#cbd5e1",
    border: "1px solid #2a2a2a",
    borderRadius: 7,
    padding: "3px 6px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
};

function toneStyles(kind) {
  switch (kind) {
    case "live":
      return { pill: { background: "#06220f", color: "#86efac", borderColor: "#166534" } };
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
