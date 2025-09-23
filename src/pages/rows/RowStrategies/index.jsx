// src/pages/rows/RowStrategies/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";

export default function RowStrategies() {
  const { selection, setSelection } = useSelection();
  const [res, setRes] = useState({ status: "mock", signal: null, apiBase: "" });

  // Backend base (env → fallback to your Render backend URL → same-origin)
  function getApiBase() {
    try {
      var envBase =
        (typeof process !== "undefined" &&
          process.env &&
          process.env.REACT_APP_API_BASE) ||
        "";
      if (envBase && typeof envBase === "string") return envBase.replace(/\/$/, "");
    } catch (e) {}
    // HARD BACKUP: your backend Render URL (prevents accidental MOCK)
    return "https://frye-market-backend-1.onrender.com";
  }

  useEffect(function () {
    var alive = true;
    var base = getApiBase();

    async function pull() {
      var url = base + "/api/signals?strategy=alignment&limit=1&t=" + Date.now();
      try {
        var resHttp = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        if (!resHttp.ok) throw new Error("HTTP " + resHttp.status);
        var data = await resHttp.json();

        var status = data && data.status ? String(data.status) : "live";
        var sig = null;
        if (data && data.items && data.items.length) sig = data.items[0];
        else if (data && data.signal) sig = data.signal;

        if (!sig || typeof sig !== "object") {
          if (alive)
            setRes({
              status: "mock(empty)",
              signal: {
                direction: "none",
                streak_bars: 0,
                confidence: 0,
                timestamp: null,
                failing: [],
              },
              apiBase: base,
            });
          return;
        }

        var direction = String(sig.direction || "none");
        var streak_bars = Number(sig.streak_bars || 0);
        var confidenceNum = Number(sig.confidence || 0);
        if (!(confidenceNum >= 0)) confidenceNum = 0;
        if (confidenceNum > 100) confidenceNum = 100;
        var ts = sig.timestamp || null;
        var failing = sig.failing && sig.failing.slice ? sig.failing.slice(0) : [];

        if (alive)
          setRes({
            status: status,
            signal: {
              direction: direction,
              streak_bars: streak_bars,
              confidence: confidenceNum,
              timestamp: ts,
              failing: failing,
            },
            apiBase: base,
          });
      } catch (err) {
        if (alive)
          setRes({
            status: "mock(error)",
            signal: {
              direction: "long",
              streak_bars: 2,
              confidence: 93,
              timestamp: new Date(
                Math.floor(Date.now() / (10 * 60 * 1000)) * 10 * 60 * 1000
              ).toISOString(),
              failing: ["I:NDX"],
            },
            apiBase: base,
          });
      }
    }

    pull();
    var id = setInterval(pull, 30000);
    return function () {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const view = useMemo(function () {
    var status = res && res.status ? res.status : "mock";
    var s = res && res.signal ? res.signal : null;
    if (!s) {
      return {
        key: "mock-no-ts",
        livePill: status === "live" ? "LIVE" : "MOCK",
        statePill: "Flat",
        tone: "muted",
        score: 0,
        last: "—",
        failing: [],
      };
    }
    var dir = s.direction || "none";
    var statePill = dir === "none" ? "Flat" : s.streak_bars >= 2 ? "Triggered" : "On Deck";
    var tone = dir === "long" ? "ok" : dir === "short" ? "warn" : "muted";
    var score = Math.round(s.confidence >= 0 ? (s.confidence <= 100 ? s.confidence : 100) : 0);
    var last = dir === "none" ? "—" : dir.toUpperCase() + " • " + fmtTime(s.timestamp);
    var failing = s.failing && s.failing.slice ? s.failing.slice(0) : [];
    return {
      key: status + "-" + (s.timestamp || "no-ts"),
      livePill: status === "live" ? "LIVE" : "MOCK",
      statePill: statePill,
      tone: tone,
      score: score,
      last: last,
      failing: failing,
    };
  }, [res]);

  const tabs = [
    { k: "SPY", sym: "SPY" },
    { k: "QQQ", sym: "QQQ" },
    { k: "IWM", sym: "IWM" },
    { k: "MDY", sym: "MDY" },
    { k: "SPX", sym: "I:SPX" },
    { k: "NDX", sym: "I:NDX" },
    { k: "DJI", sym: "I:DJI" },
  ];
  function load(sym) {
    setSelection({ symbol: sym, timeframe: "10m", strategy: "alignment" });
  }

  return (
    <div key={view.key} style={S.wrap}>
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
        footNote={view.failing.length ? "Failing: " + view.failing.join(", ") : ""}
        actions={[
          { label: "Load SPY (10m)", onClick: function () { load("SPY"); } },
          { label: "Load QQQ (10m)", onClick: function () { load("QQQ"); } },
        ]}
      >
        <div style={S.selRow}>
          <span style={S.selKey}>Selected:</span>
          <span style={S.selVal}>
            {(selection && selection.symbol) || "—"} • {(selection && selection.timeframe) || "—"}
          </span>
        </div>

        <div style={S.tabRow}>
          {tabs.map(function (t) {
            var active =
              selection && selection.symbol === t.sym && selection.timeframe === "10m";
            return (
              <button
                key={t.k}
                type="button"
                onClick={function () { load(t.sym); }}
                style={Object.assign({}, S.tab, active ? S.tabActive : null)}
                aria-pressed={!!active}
                title={"Load " + t.k + " (10m)"}
              >
                {t.k}
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title="Wave 3 Breakout"
        timeframe="Daily"
        rightPills={[{ text: "Flat", tone: "muted" }]}
        score={64}
        last="On deck candidate"
        pl="—"
        actions={[
          { label: "Top Candidate (Daily)", onClick: function () { setSelection({ symbol: "SPY", timeframe: "1d", strategy: "wave3" }); } },
        ]}
      />

      <Card
        title="Flagpole Breakout"
        timeframe="Daily"
        rightPills={[{ text: "Caution", tone: "warn" }]}
        score={58}
        last="Tight flag forming"
        pl="—"
        actions={[
          { label: "Top Candidate (Daily)", onClick: function () { setSelection({ symbol: "SPY", timeframe: "1d", strategy: "flag" }); } },
        ]}
      />
    </div>
  );
}

/* ---------- Card & Styles ---------- */
function Card(props) {
  var pct = Math.max(0, Math.min(100, props.score || 0));
  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={S.title}>{props.title}</div>
          <span style={S.badge}>{props.timeframe}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {props.rightPills.map(function (p, i) {
            var tone = toneStyles(p.tone);
            return <span key={i} style={Object.assign({}, S.pill, tone.pill)}>{p.text}</span>;
          })}
        </div>
      </div>

      <div style={S.scoreRow}>
        <div style={S.scoreLabel}>Score</div>
        <div style={S.progress}><div style={Object.assign({}, S.progressFill, { width: pct + "%" })} /></div>
        <div style={S.scoreVal}>{pct}</div>
      </div>

      <div style={S.metaRow}>
        <div><span style={S.metaKey}>Last:</span> {props.last}</div>
        <div><span style={S.metaKey}>P/L Today:</span> {props.pl}</div>
      </div>

      {props.footNote ? <div style={S.foot}>{props.footNote}</div> : null}

      <div style={S.ctaRow}>
        {props.actions.map(function (a, i) {
          return <button key={i} type="button" onClick={a.onClick} style={S.btnSm}>{a.label}</button>;
        })}
      </div>

      {props.children}
    </div>
  );
}

function fmtTime(iso) {
  try {
    if (!iso) return "—";
    var d = new Date(iso);
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  } catch (e) { return "—"; }
}

var S = {
  wrap: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 },
  card: { background: "#101010", border: "1px solid #262626", borderRadius: 10, padding: 10, color: "#e5e7eb", display: "flex", flexDirection: "column", gap: 8, minHeight: 110 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  title: { fontWeight: 700, fontSize: 14, lineHeight: "16px" },
  badge: { background: "#0b0b0b", border: "1px solid #2b2b2b", color: "#9ca3af", fontSize: 10, padding: "1px 6px", borderRadius: 999, fontWeight: 700 },
  pill: { fontSize: 10, padding: "2px 8px", borderRadius: 999, border: "1px solid #2b2b2b", fontWeight: 700, lineHeight: "14px" },
  scoreRow: { display: "grid", gridTemplateColumns: "44px 1fr 28px", alignItems: "center", gap: 6 },
  scoreLabel: { color: "#9ca3af", fontSize: 10 },
  progress: { background: "#1f2937", borderRadius: 6, height: 6, overflow: "hidden", border: "1px solid #334155" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #22c55e 0%, #84cc16 40%, #f59e0b 70%, #ef4444 100%)" },
  scoreVal: { textAlign: "right", fontWeight: 700, fontSize: 12 },
  metaRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 6, fontSize: 11, color: "#cbd5e1" },
  metaKey: { color: "#9ca3af", marginRight: 4, fontWeight: 600 },
  foot: { fontSize: 10, color: "#94a3b8" },
  ctaRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  btnSm: { background: "#0b0b0b", color: "#e5e7eb", border: "1px solid #2b2b2b", borderRadius: 8, padding: "4px 8px", fontWeight: 700, fontSize: 11, cursor: "pointer" },
  selRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: 11 },
  selKey: { color: "#9ca3af" },
  selVal: { fontWeight: 700 },
  tabRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 },
  tab: { background: "#141414", color: "#cbd5e1", border: "1px solid #2a2a2a", borderRadius: 7, padding: "3px 6px", fontSize: 10, fontWeight: 700, cursor: "pointer" },
  tabActive: { background: "#1f2937", color: "#e5e7eb", border: "1px solid #3b82f6", boxShadow: "0 0 0 1px #3b82f6 inset" }
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
