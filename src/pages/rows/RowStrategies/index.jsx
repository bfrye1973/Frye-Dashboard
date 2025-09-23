// src/pages/rows/RowStrategies/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import { getAlignmentLatest } from "../../../services/signalsService";

/**
 * RowStrategies — compact cards + LIVE/MOCK, Triggered/Flat/On Deck
 * - Polls backend directly (no /dynamic), 30s with cache-buster
 * - Accepts items[] or signal shape
 * - Keys repaint by status+timestamp to avoid stale DOM
 * - Clear "mock/unavailable" state (no ghost values)
 */

export default function RowStrategies() {
  const { selection, setSelection } = useSelection();
  const [res, setRes] = useState({ status: "mock", signal: null, apiBase: "" });

  useEffect(() => {
    let alive = true;

    async function pull() {
      const r = await getAlignmentLatest();
      if (!alive) return;
      setRes(r);

      // Console beacon for QA
      const s = r.signal;
      const dbg = s
        ? `dir=${s.direction} streak=${s.streak_bars} conf=${s.confidence} ts=${s.timestamp}`
        : "no-signal";
      // eslint-disable-next-line no-console
      console.log("[RowStrategies] alignment", r.status, dbg);
    }

    pull();
    const id = setInterval(pull, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const view = useMemo(() => {
    const status = res.status ?? "mock";
    const s = res.signal;

    if (!s) {
      return {
        key: `mock-no-ts`,
        livePill: status === "live" ? "LIVE" : "MOCK",
        statePill: "Flat",
        tone: "muted",
        score: 0,
        last: "—",
        failing: [],
      };
    }

    const dir = s.direction || "none";
    const statePill =
      dir === "none" ? "Flat" : (s.streak_bars ?? 0) >= 2 ? "Triggered" : "On Deck";
    const tone = dir === "long" ? "ok" : dir === "short" ? "warn" : "muted";
    const score = Math.round(Math.max(0, Math.min(100, Number(s.confidence || 0))));
    const last = dir === "none" ? "—" : `${dir.toUpperCase()} • ${fmtTime(s.timestamp)}`;
    const failing = Array.isArray(s.failing) ? s.failing : [];

    return {
      key: `${status}-${s.timestamp || "no-ts"}`,
      livePill: status === "live" ? "LIVE" : "MOCK",
      statePill,
      tone,
      score,
      last,
      failing,
    };
  }, [res]);

  // Alignment mini-tabs → set selection to 10m alignment
  const tabs = [
    { k: "SPY", sym: "SPY" },
    { k: "QQQ", sym: "QQQ" },
    { k: "IWM", sym: "IWM" },
    { k: "MDY", sym: "MDY" },
    { k: "SPX", sym: "I:SPX" },
    { k: "NDX", sym: "I:NDX" },
    { k: "DJI", sym: "I:DJI" },
  ];
  const load = (sym) => setSelection({ symbol: sym, timeframe: "10m", strategy: "alignment" });

  return (
    <div key={view.key} style={S.wrap}>
      {/* Alignment Scalper */}
      <Card
        title="SPY/QQQ Index-Alignment Scalper"
        timeframe="10m"
        rightPills={[
          { text: view.livePill, tone: view.livePill === "LIVE" ? "live" : "muted" },
          { text: view.statePill, tone: view.tone },
        ]}
        score={view.score}
        last={view.last}
        pl="—"
        footNote={view.failing.length ? `Failing: ${view.failing.join(", ")}` : ""}
        actions={[
          { label: "Load SPY (10m)", onClick: () => load("SPY") },
          { label: "Load QQQ (10m)", onClick: () => load("QQQ") },
        ]}
      >
        {/* Selection readout */}
        <div style={S.selRow}>
          <span style={S.selKey}>Selected:</span>
          <span style={S.selVal}>
            {selection?.symbol || "—"} • {selection?.timeframe || "—"}
          </span>
        </div>

        {/* Mini tabs */}
        <div style={S.tabRow}>
          {tabs.map(({ k, sym }) => {
            const active =
              selection?.symbol === sym && selection?.timeframe === "10m";
            return (
              <button
                key={k}
                type="button"
                onClick={() => load(sym)}
                style={{ ...S.tab, ...(active ? S.tabActive : null) }}
                aria-pressed={active}
                title={`Load ${k} (10m)`}
              >
                {k}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Wave 3 (Daily) */}
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

      {/* Flagpole (Daily) */}
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

/* ---------- Card ---------- */
function Card({
  title,
  timeframe,
  rightPills = [],
  score = 0,
  last,
  pl,
  actions = [],
  footNote = "",
  children = null,
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
            <span key={i} style={{ ...S.pill, ...toneStyles(p.tone).pill }}>
              {p.text}
            </span>
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
          <button key={i} type="button" onClick={a.onClick} style={S.btnSm}>
            {a.label}
          </button>
        ))}
      </div>

      {children}
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
    minHeight: 110,
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
  selRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: 11 },
  selKey: { color: "#9ca3af" },
  selVal: { fontWeight: 700 },
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
  tabActive: {
    background: "#1f2937",
    color: "#e5e7eb",
    border: "1px solid #3b82f6",
    boxShadow: "0 0 0 1px #3b82f6 inset",
  },
};

function toneStyles(kind) {
  switch (kind) {
    case "live": return { pill: { background: "#06220f", color: "#86efac", borderColor: "#166534" } };
    case "info": return { pill: { background: "#0b1220", color: "#93c5fd", borderColor: "#1e3a8a" } };
    case "warn": return { pill: { background: "#1b1409", color: "#fbbf24", borderColor: "#92400e" } };
    case "ok":   return { pill: { background: "#07140d", color: "#86efac", borderColor: "#166534" } };
    default:     return { pill: { background: "#0b0b0b", color: "#94a3b8", borderColor: "#2b2b2b" } };
  }
}
