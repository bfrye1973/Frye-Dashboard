// src/pages/rows/RowStrategies/index.jsx
// CRA-safe Strategy Row (Alignment, Wave3, Flagpole)
// Alignment card: 5-of-7 immediate trigger (no debounce), NDX removed, DJI→DIA.
// Fetches backend directly with cache-buster; never crashes if backend unavailable.

import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";

export default function RowStrategies() {
  const { selection, setSelection } = useSelection();
  const [res, setRes] = useState({ status: "mock", data: null, apiBase: "" });

  // --- Config (universe & threshold) ---
  // Canonical 7 (NDX removed, DIA used instead of DJI)
  const CANON = ["SPY", "I:SPX", "QQQ", "IWM", "MDY", "DIA", "I:VIX"];
  const THRESHOLD = 5; // 5-of-7 immediate trigger

  // Build backend base (CRA-safe)
  function getApiBase() {
    try {
      if (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) {
        return String(process.env.REACT_APP_API_BASE).replace(/\/+$/, "");
      }
    } catch {}
    // Hard fallback so we don't accidentally hit the frontend origin:
    return "https://frye-market-backend-1.onrender.com";
  }

  // Poll backend alignment feed (but we derive our own 5-of-7 view)
  useEffect(function () {
    let alive = true;
    const base = getApiBase();

    async function pull() {
      const url = `${base}/api/signals?strategy=alignment&limit=1&t=${Date.now()}`;
      try {
        const r = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-store" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json(); // may be {items:[...]}, {signal:...}, or a single signal
        if (!alive) return;
        setRes({ status: String(data?.status ?? "live"), data, apiBase: base });
      } catch (e) {
        if (!alive) return;
        // Safe mock (so UI never blanks)
        setRes({
          status: "mock(error)",
          data: {
            signal: {
              // mock members with one laggard, to verify UI wiring
              members: {
                SPY: { ok: true }, "I:SPX": { ok: true }, QQQ: { ok: true },
                IWM: { ok: true }, MDY: { ok: true }, DIA: { ok: false },
                "I:VIX": { ok: true } // backend already inverts VIX; we trust "ok"
              },
              timestamp: new Date(Math.floor(Date.now() / 600000) * 600000).toISOString()
            }
          },
          apiBase: base
        });
      }
    }

    pull();
    const id = setInterval(pull, 30000);
    return function () { alive = false; clearInterval(id); };
  }, []);

  // Normalize backend payload to a single "signal" object (accept items[] or signal)
  function extractSignal(data) {
    if (!data) return null;
    if (Array.isArray(data?.items) && data.items.length) return data.items[0];
    if (data?.signal) return data.signal;
    if (data?.direction || data?.members) return data; // single-object style
    return null;
  }

  // 5-of-7 immediate evaluation (front-end derived) over the canonical set
  const view = useMemo(() => {
    const status = res.status || "mock";
    const sig = extractSignal(res.data);
    const members = (sig && sig.members) ? sig.members : {};
    const ts = sig && sig.timestamp ? sig.timestamp : null;

    // Accept both DIA and legacy I:DJI (until backend swap completes)
    const effective = {
      SPY: members["SPY"],
      "I:SPX": members["I:SPX"] || members["SPX"],
      QQQ: members["QQQ"],
      IWM: members["IWM"],
      MDY: members["MDY"],
      DIA: members["DIA"] || members["I:DJI"], // prefer DIA; fallback to I:DJI if DIA not present
      "I:VIX": members["I:VIX"] || members["VIX"],
    };

    // Count ok's across the 7 canonical keys (missing counts as false)
    let confirm = 0;
    const failing = [];
    CANON.forEach((k) => {
      const m = effective[k];
      const ok = !!(m && m.ok === true);
      if (ok) confirm += 1;
      else failing.push(k);
    });

    // 5-of-7 immediate trigger (no debounce)
    const triggered = confirm >= THRESHOLD;
    const statePill = triggered ? "Triggered" : "Flat";
    const tone = triggered ? "ok" : "muted";
    const confidence = Math.round((confirm / CANON.length) * 100); // simple confidence 0..100

    return {
      key: `${status}-${ts || "no-ts"}-${confirm}`,
      livePill: status === "live" ? "LIVE" : "MOCK",
      statePill,
      tone,
      score: confidence,
      last: triggered ? `LONG • ${fmtTime(ts)}` : (ts ? `— • ${fmtTime(ts)}` : "—"),
      failing: triggered ? [] : failing, // only show failing when not triggered
      confirm,
      total: CANON.length
    };
  }, [res]);

  // --- Tabs & actions (wired to chart via global selection) ---
  const tabs = [
    { k: "SPY", sym: "SPY" },
    { k: "QQQ", sym: "QQQ" },
    { k: "IWM", sym: "IWM" },
    { k: "MDY", sym: "MDY" },
    { k: "SPX", sym: "I:SPX" },
    { k: "DIA", sym: "DIA" },
  ];
  function load(sym) {
    setSelection({ symbol: sym, timeframe: "10m", strategy: "alignment" });
  }

  return (
    <div key={view.key} style={S.wrap}>
      {/* Alignment Scalper — 5-of-7 immediate */}
      <Card
        title="SPY/QQQ Index-Alignment Scalper"
        timeframe="10m"
        rightPills={[
          { text: view.livePill, tone: view.livePill === "LIVE" ? "live" : "muted" },
          { text: `${view.statePill} (${view.confirm}/${view.total})`, tone: view.tone },
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
        {/* Selected readout + tiny tabs */}
        <div style={S.selRow}>
          <span style={S.selKey}>Selected:</span>
          <span style={S.selVal}>
            {(selection && selection.symbol) || "—"} • {(selection && selection.timeframe) || "—"}
          </span>
        </div>

        <div style={S.tabRow}>
          {tabs.map(function (t) {
            const active = selection && selection.symbol === t.sym && selection.timeframe === "10m";
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

      {/* Wave 3 (Daily) — placeholder */}
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

      {/* Flagpole (Daily) — placeholder */}
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
