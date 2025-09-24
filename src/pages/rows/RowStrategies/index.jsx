// src/pages/rows/RowStrategies/index.jsx
// Alignment Scalper — 3-check card (Alignment 5/7, Liquidity ✓, Δ Accel ✓)
// CRA-safe (no import.meta), compact UI, wired tabs. Two pulls:
//   1) Alignment feed (backend)
//   2) Sandbox deltas (optional; hide if missing or stale)

import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";

/* =========================
   Safe env helpers (CRA)
   ========================= */
function getEnv(name, fallback = "") {
  try {
    if (typeof process !== "undefined" && process.env && name in process.env) {
      return String(process.env[name] || "").trim();
    }
  } catch {}
  return fallback;
}
function getBackendBase() {
  const envBase = getEnv("REACT_APP_API_BASE", "");
  return (envBase || "https://frye-market-backend-1.onrender.com").replace(/\/+$/, "");
}
function getSandboxUrl() {
  // Example: https://raw.githubusercontent.com/<org>/<repo>/data-live-10min-sandbox/data/outlook_intraday.json
  return getEnv("REACT_APP_INTRADAY_SANDBOX_URL", "");
}
function nowIso() { return new Date().toISOString(); }

/* =========================
   Config / thresholds
   ========================= */
const CANON = ["SPY", "I:SPX", "QQQ", "IWM", "MDY", "DIA", "I:VIX"]; // NDX removed; DJI→DIA
const ALIGN_THRESHOLD = 5; // 5-of-7 immediate trigger

// Δ pills color rules
const GREEN_TH = +1.0;
const RED_TH   = -1.0;
// staleness
const STALE_MINUTES = 12;

/* =========================
   Component
   ========================= */
export default function RowStrategies() {
  const { selection, setSelection } = useSelection();

  // alignment pull
  const [alignRes, setAlignRes] = useState({ status: "mock", data: null, base: "" });
  // sandbox deltas pull
  const [deltaRes, setDeltaRes] = useState({ ok: false, stale: true, market: null, at: null, url: "" });

  /* -------- Poll Alignment backend -------- */
  useEffect(() => {
    let alive = true;
    const base = getBackendBase();

    async function pull() {
      const url = `${base}/api/signals?strategy=alignment&limit=1&t=${Date.now()}`;
      try {
        const r = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-store" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        if (!alive) return;
        setAlignRes({ status: String(data?.status ?? "live"), data, base });
        // eslint-disable-next-line no-console
        console.log("[Alignment] pull", data?.status ?? "live", data);
      } catch (e) {
        if (!alive) return;
        // harmless mock (never crash UI)
        const ts = new Date(Math.floor(Date.now() / 600000) * 600000).toISOString();
        setAlignRes({
          status: "mock(error)",
          data: {
            signal: {
              members: {
                SPY: { ok: true }, "I:SPX": { ok: true }, QQQ: { ok: true },
                IWM: { ok: true }, MDY: { ok: false }, DIA: { ok: true }, "I:VIX": { ok: true }
              },
              liquidity_ok: false,
              timestamp: ts
            }
          },
          base
        });
        // eslint-disable-next-line no-console
        console.warn("[Alignment] pull error:", e?.message || e);
      }
    }

    pull();
    const id = setInterval(pull, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  /* -------- Poll Sandbox deltas (optional) -------- */
  useEffect(() => {
    let alive = true;
    const url = getSandboxUrl();
    if (!url) { setDeltaRes({ ok: false, stale: true, market: null, at: null, url: "" }); return; }

    async function pull() {
      try {
        const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
          cache: "no-store", headers: { "Cache-Control": "no-store" }
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();

        const at = j?.deltasUpdatedAt || j?.updated_at || null;
        const market = j?.deltas?.market || null;

        const stale = (() => {
          if (!at) return true;
          const diffMin = (Date.now() - new Date(at).getTime()) / 60000;
          return !(diffMin >= 0) || diffMin > STALE_MINUTES;
        })();

        if (!alive) return;
        setDeltaRes({ ok: !!market, stale, market, at, url });
        // eslint-disable-next-line no-console
        console.log("[SandboxΔ] pull", { stale, at, market });
      } catch (e) {
        if (!alive) return;
        setDeltaRes({ ok: false, stale: true, market: null, at: null, url });
        // eslint-disable-next-line no-console
        console.warn("[SandboxΔ] error:", e?.message || e);
      }
    }

    pull();
    const id = setInterval(pull, 300000); // every ~5m
    return () => { alive = false; clearInterval(id); };
  }, []);

  /* -------- Normalize alignment signal -------- */
  const view = useMemo(() => {
    const status = alignRes.status || "mock";
    const data = alignRes.data;

    // accept {items:[signal]}, {signal}, or single object
    let sig = null;
    if (Array.isArray(data?.items) && data.items.length) sig = data.items[0];
    else if (data?.signal) sig = data.signal;
    else if (data?.direction || data?.members) sig = data;

    const members = (sig && sig.members) ? sig.members : {};
    const ts = sig?.timestamp || null;

    // accept both DIA and legacy I:DJI for transition
    const effective = {
      SPY: members["SPY"],
      "I:SPX": members["I:SPX"] || members["SPX"],
      QQQ: members["QQQ"],
      IWM: members["IWM"],
      MDY: members["MDY"],
      DIA: members["DIA"] || members["I:DJI"],
      "I:VIX": members["I:VIX"] || members["VIX"],
    };

    // 5-of-7 count
    let confirm = 0;
    const failing = [];
    CANON.forEach(k => {
      const ok = !!(effective[k] && effective[k].ok === true);
      if (ok) confirm += 1; else failing.push(k);
    });

    // Liquidity flag from backend (if provided)
    const liquidityOk = !!(sig && (sig.liquidity_ok === true));

    // Δ Acceleration from sandbox
    const dm = deltaRes.market;
    const accelOk = !!(deltaRes.ok && !deltaRes.stale &&
      typeof dm?.dBreadthPct === "number" &&
      typeof dm?.dMomentumPct === "number" &&
      dm.dBreadthPct >= GREEN_TH &&
      dm.dMomentumPct >= GREEN_TH);

    // Confidence = alignment (0..100) + Liquidity ( +10 ) + Δ ( +20 ), clamped
    const baseScore = Math.round((confirm / CANON.length) * 100);
    const conf = Math.max(0, Math.min(100,
      baseScore + (liquidityOk ? 10 : 0) + (accelOk ? 20 : 0)
    ));

    // State pill: Triggered if ≥5; else Flat
    const triggered = confirm >= ALIGN_THRESHOLD;
    const statePill = triggered ? "Triggered" : "Flat";
    const tone = triggered ? "ok" : "muted";
    const last = ts ? (triggered ? `LONG • ${fmtHHMM(ts)}` : `— • ${fmtHHMM(ts)}`) : "—";

    return {
      key: `${status}-${ts || nowIso()}-${confirm}-${liquidityOk ? 1 : 0}-${accelOk ? 1 : 0}`,
      status, confirm, total: CANON.length,
      liquidityOk, accelOk,
      score: conf, tone, statePill, last,
      failing: triggered ? [] : failing
    };
  }, [alignRes, deltaRes]);

  /* -------- Tabs (wired) -------- */
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

  /* -------- UI -------- */
  return (
    <div key={view.key} style={S.wrap}>
      <Card
        title="SPY/QQQ Index-Alignment Scalper"
        timeframe="10m"
        // two pills: LIVE/MOCK + Triggered/Flat (X/7)
        rightPills={[
          { text: alignRes.status === "live" ? "LIVE" : "MOCK", tone: alignRes.status === "live" ? "live" : "muted" },
          { text: `${view.statePill} (${view.confirm}/${view.total})`, tone: view.tone },
        ]}
        score={view.score}
        last={view.last}
        pl="—"
        footNote={view.failing.length ? ("Failing: " + view.failing.join(", ")) : ""}
      >
        {/* 3 checks row */}
        <div style={S.checks}>
          <Check ok={view.confirm >= ALIGN_THRESHOLD} label="Alignment ≥5/7" />
          <Check ok={view.liquidityOk} label="Liquidity Grab" />
          <Check ok={view.accelOk} label="Δ Accel (5m)" tip={deltaRes.stale ? "stale" : ""} />
        </div>

        {/* Selected readout */}
        <div style={S.selRow}>
          <span style={S.selKey}>Selected:</span>
          <span style={S.selVal}>
            {(selection && selection.symbol) || "—"} • {(selection && selection.timeframe) || "—"}
          </span>
        </div>

        {/* Tiny tabs */}
        <div style={S.tabRow}>
          {tabs.map(t => {
            const active = selection && selection.symbol === t.sym && selection.timeframe === "10m";
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => load(t.sym)}
                style={{ ...S.tab, ...(active ? S.tabActive : null) }}
                aria-pressed={!!active}
                title={`Load ${t.k} (10m)`}
              >
                {t.k}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Small pieces ---------- */
function Check({ ok, label, tip }) {
  const style = ok ? S.chkOk : S.chkNo;
  return (
    <div style={S.chk}>
      <span style={style}>{ok ? "✓" : "•"}</span>
      <span>{label}{tip ? ` — ${tip}` : ""}</span>
    </div>
  );
}

function Card(props) {
  const pct = Math.max(0, Math.min(100, props.score || 0));
  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={S.title}>{props.title}</div>
          <span style={S.badge}>{props.timeframe}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {props.rightPills.map((p, i) => (
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
        <div><span style={S.metaKey}>Last:</span> {props.last}</div>
        <div><span style={S.metaKey}>P/L Today:</span> {props.pl}</div>
      </div>

      {props.footNote ? <div style={S.foot}>{props.footNote}</div> : null}
      {props.children}
    </div>
  );
}

/* ---------- Utils & Styles ---------- */
function fmtHHMM(iso) {
  try {
    if (!iso) return "—";
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch { return "—"; }
}

const S = {
  wrap: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 },

  card: { background: "#101010", border: "1px solid #262626", borderRadius: 10, padding: 10, color: "#e5e7eb",
          display: "flex", flexDirection: "column", gap: 8, minHeight: 110 },

  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  title: { fontWeight: 700, fontSize: 14, lineHeight: "16px" },
  badge: { background: "#0b0b0b", border: "1px solid #2b2b2b", color: "#9ca3af", fontSize: 10, padding: "1px 6px",
           borderRadius: 999, fontWeight: 700 },
  pill: { fontSize: 10, padding: "2px 8px", borderRadius: 999, border: "1px solid #2b2b2b", fontWeight: 700, lineHeight: "14px" },

  scoreRow: { display: "grid", gridTemplateColumns: "44px 1fr 28px", alignItems: "center", gap: 6 },
  scoreLabel: { color: "#9ca3af", fontSize: 10 },
  progress: { background: "#1f2937", borderRadius: 6, height: 6, overflow: "hidden", border: "1px solid #334155" },
  progressFill: { height: "100%", background: "linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)" },
  scoreVal: { textAlign: "right", fontWeight: 700, fontSize: 12 },

  metaRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 6, fontSize: 11, color: "#cbd5e1" },
  metaKey: { color: "#9ca3af", marginRight: 4, fontWeight: 600 },
  foot: { fontSize: 10, color: "#94a3b8" },

  // checks (compact)
  checks: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 },
  chk: { display: "flex", alignItems: "center", gap: 6, fontSize: 11 },
  chkOk: { color: "#86efac", fontWeight: 900 },
  chkNo: { color: "#94a3b8", fontWeight: 900 },

  // selection + tabs
  selRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: 11 },
  selKey: { color: "#9ca3af" },
  selVal: { fontWeight: 700 },

  tabRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 },
  tab: { background: "#141414", color: "#cbd5e1", border: "1px solid #2a2a2a", borderRadius: 7,
         padding: "3px 6px", fontSize: 10, fontWeight: 700, cursor: "pointer" },
  tabActive: { background: "#1f2937", color: "#e5e7eb", border: "1px solid #3b82f6", boxShadow: "0 0 0 1px #3b82f6 inset" },
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
