// src/pages/rows/RowStrategies/index.jsx
// RowStrategies — SMZ Setup Scoring (Engine 1 + Engine 2)
// Replaces old Alignment Scalper card with:
// - SMZ Strength (0–80)
// - Fib Confluence (0–20)
// - Hard gate: Fib invalidated (74%) => score 0
//
// Primary symbol: SPY (v1). QQQ tab loads chart but score remains SPY until QQQ is enabled backend-side.

import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import LiveDot from "../../../components/LiveDot";

/* -------------------- env helpers (CRA-safe) -------------------- */
function env(name, fb = "") {
  try {
    if (typeof process !== "undefined" && process.env && name in process.env) {
      return String(process.env[name] || "").trim();
    }
  } catch {}
  return fb;
}
const API_BASE = env("REACT_APP_API_BASE", "https://frye-market-backend-1.onrender.com");
const AZ_TZ = "America/Phoenix";

/* -------------------- endpoints -------------------- */
const SMZ_URL = `${API_BASE}/api/v1/smz-levels?symbol=SPY`;
const FIB_URL = `${API_BASE}/api/v1/fib-levels?symbol=SPY&tf=1h`;

/* -------------------- utils -------------------- */
const nowIso = () => new Date().toISOString();
function toAZ(iso, withSeconds = false) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
      timeZone: AZ_TZ,
    }) + " AZ";
  } catch {
    return "—";
  }
}
function minutesAgo(iso) {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 60000;
}
function clamp100(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}
function fmt2(x) {
  return Number.isFinite(x) ? Number(x).toFixed(2) : "—";
}
function inRange(p, lo, hi) {
  if (!Number.isFinite(p) || !Number.isFinite(lo) || !Number.isFinite(hi)) return false;
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return p >= a && p <= b;
}
function mid(lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return (Number(lo) + Number(hi)) / 2;
}
function distToRange(p, lo, hi) {
  if (!Number.isFinite(p) || !Number.isFinite(lo) || !Number.isFinite(hi)) return Infinity;
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  if (p < a) return a - p;
  if (p > b) return p - b;
  return 0;
}

/* -------------------- SMZ zone selection (Rule C) --------------------
   1) If price inside any sticky structure -> pick highest score
   2) Else nearest sticky structure BELOW price
   3) Else nearest sticky structure overall
--------------------------------------------------------------------- */
function pickRelevantStickyStructure({ structuresSticky = [], price }) {
  const list = (Array.isArray(structuresSticky) ? structuresSticky : [])
    .map((z) => {
      // normalize range
      const hi = Number(z?.priceRange?.[0] ?? z?.hi ?? z?.high ?? z?.top);
      const lo = Number(z?.priceRange?.[1] ?? z?.lo ?? z?.low ?? z?.bottom);
      const score = Number(
        z?.score ??
          z?.institutionalScore ??
          z?.strength ??
          z?.rubricScore ??
          z?.scoreTotal ??
          0
      );
      return {
        raw: z,
        hi,
        lo,
        score: Number.isFinite(score) ? score : 0,
        mid: mid(lo, hi),
        inside: inRange(price, lo, hi),
      };
    })
    .filter((z) => Number.isFinite(z.hi) && Number.isFinite(z.lo));

  if (!list.length) return null;

  // 1) inside -> highest score
  const inside = list.filter((z) => z.inside);
  if (inside.length) {
    inside.sort((a, b) => b.score - a.score);
    return inside[0];
  }

  // 2) nearest below price (structure whose hi <= price, closest distance)
  const below = list
    .filter((z) => Number.isFinite(price) && z.hi <= price)
    .sort((a, b) => (price - a.hi) - (price - b.hi));
  if (below.length) return below[0];

  // 3) nearest overall
  list.sort((a, b) => distToRange(price, a.lo, a.hi) - distToRange(price, b.lo, b.hi));
  return list[0];
}

/* -------------------- Scoring (Engine 1 + Engine 2) --------------------
   SMZ contributes up to 80 points (score * 0.8)
   Fib contributes up to 20 points (+10 inRetraceZone, +10 near50)
   Hard gate: fib invalidated -> score=0 invalid
--------------------------------------------------------------------- */
function scoreSmzFib({ smzScore, fib }) {
  // Hard invalidations
  if (!fib || fib.ok !== true) {
    return {
      invalid: true,
      total: 0,
      reasons: ["FIB_NO_DATA"],
      smzPart: 0,
      fibBoost: 0,
    };
  }
  if (fib?.signals?.invalidated) {
    return {
      invalid: true,
      total: 0,
      reasons: ["FIB_INVALIDATION_74"],
      smzPart: 0,
      fibBoost: 0,
    };
  }

  const smzPart = clamp100(Number(smzScore)) * 0.8;

  let fibBoost = 0;
  if (fib?.signals?.inRetraceZone) fibBoost += 10;
  if (fib?.signals?.near50) fibBoost += 10;

  // Optional: if context W4, cap boost
  if (fib?.anchors?.context === "W4") fibBoost = Math.min(fibBoost, 10);

  const total = clamp100(smzPart + fibBoost);

  const reasons = [];
  if (!fib?.signals?.inRetraceZone) reasons.push("FIB_OUTSIDE_RETRACE_ZONE");

  return { invalid: false, total, reasons, smzPart, fibBoost };
}

/* -------------------- component -------------------- */
export default function RowStrategies() {
  const { selection, setSelection } = useSelection();

  const [smzRes, setSmzRes] = useState({ ok: false, data: null, err: null, lastFetch: null });
  const [fibRes, setFibRes] = useState({ ok: false, data: null, err: null, lastFetch: null });

  // Poll SMZ + Fib (30s)
  useEffect(() => {
    let alive = true;

    async function pull() {
      try {
        const [smzR, fibR] = await Promise.all([
          fetch(`${SMZ_URL}&t=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-store" } }),
          fetch(`${FIB_URL}&t=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-store" } }),
        ]);

        const smzJ = await smzR.json();
        const fibJ = await fibR.json();
        if (!alive) return;

        setSmzRes({ ok: true, data: smzJ, err: null, lastFetch: nowIso() });
        setFibRes({ ok: true, data: fibJ, err: null, lastFetch: nowIso() });
      } catch (e) {
        if (!alive) return;
        const msg = String(e?.message || e);
        setSmzRes((s) => ({ ...s, err: msg, lastFetch: nowIso() }));
        setFibRes((s) => ({ ...s, err: msg, lastFetch: nowIso() }));
      }
    }

    pull();
    const id = setInterval(pull, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const view = useMemo(() => {
    const smz = smzRes.data;
    const fib = fibRes.data;

    // Determine a "current price" for zone relevance.
    // Preferred: fib.diagnostics.price (it’s computed from latest close on 1h bars).
    const price = Number(fib?.diagnostics?.price);
    const priceOk = Number.isFinite(price) ? price : null;

    // Sticky structures are authoritative (manual + auto)
    const structuresSticky = smz?.structures_sticky || smz?.structuresSticky || [];
    const chosen = pickRelevantStickyStructure({ structuresSticky, price: priceOk });

    const smzScore = chosen ? chosen.score : 0;

    const scored = scoreSmzFib({ smzScore, fib });

    // Live dot
    const smzFresh = minutesAgo(smzRes.lastFetch) <= 2;
    const fibFresh = minutesAgo(fibRes.lastFetch) <= 2;
    const liveStatus =
      smzRes.err || fibRes.err ? "red" : (!smzFresh || !fibFresh ? "yellow" : "green");
    const liveTip =
      `SMZ fetch: ${smzRes.lastFetch ? toAZ(smzRes.lastFetch, true) : "—"} • ` +
      `FIB fetch: ${fibRes.lastFetch ? toAZ(fibRes.lastFetch, true) : "—"} • ` +
      `Price (1h): ${priceOk ? fmt2(priceOk) : "—"}`;

    // Pills
    const fibInvalid = fib?.signals?.invalidated === true;
    const fibInZone = fib?.signals?.inRetraceZone === true;
    const fibNear50 = fib?.signals?.near50 === true;

    return {
      price: priceOk,
      chosen,
      smzScore,
      total: scored.total,
      invalid: scored.invalid,
      reasons: scored.reasons,
      smzPart: scored.smzPart,
      fibBoost: scored.fibBoost,

      fibInvalid,
      fibInZone,
      fibNear50,
      liveStatus,
      liveTip,
      context: fib?.anchors?.context || fib?.signals?.tag || null,
      anchors: fib?.anchors || null,
    };
  }, [smzRes, fibRes]);

  function load(sym) {
    // Chart load helper
    setSelection({ symbol: sym, timeframe: "10m", strategy: "smz" });
  }

  const rightPills = [
    { text: view.invalid ? "INVALID" : "LIVE", tone: view.invalid ? "warn" : "live" },
    { text: view.context ? `CTX ${view.context}` : "CTX —", tone: view.context ? "info" : "muted" },
    { text: view.fibInvalid ? "Fib Invalid" : view.fibInZone ? "Fib In Zone" : "Fib Outside", tone: view.fibInvalid ? "warn" : view.fibInZone ? "ok" : "muted" },
  ];

  // Mini breakdown bar: SMZ (0–80) + Fib (0–20)
  const smzPct = clamp100((view.smzPart / 80) * 100); // normalize to bucket
  const fibPct = clamp100((view.fibBoost / 20) * 100);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
      <Card
        title="SMZ Confluence Score (Engine 1 + Engine 2)"
        timeframe="10m"
        rightPills={rightPills}
        score={view.total}
        last={smzRes.lastFetch ? toAZ(smzRes.lastFetch) : "—"}
        extraRight={<LiveDot status={view.liveStatus} tip={view.liveTip} />}
      >
        {/* Quick summary */}
        <div style={{ display: "grid", gap: 6, marginTop: 2 }}>
          <div style={{ fontSize: 12, color: "#cbd5e1" }}>
            <b>Price (1h):</b> {view.price ? fmt2(view.price) : "—"}{" "}
            <span style={{ color: "#94a3b8" }}>
              • Anchors {view.anchors?.low ? fmt2(view.anchors.low) : "—"} → {view.anchors?.high ? fmt2(view.anchors.high) : "—"}
            </span>
          </div>

          <div style={{ fontSize: 12, color: "#cbd5e1" }}>
            <b>Chosen Structure:</b>{" "}
            {view.chosen ? (
              <>
                {fmt2(view.chosen.lo)}–{fmt2(view.chosen.hi)}{" "}
                <span style={{ color: "#94a3b8" }}>
                  • SMZ Strength {clamp100(view.smzScore).toFixed(0)}/100
                </span>
              </>
            ) : (
              <span style={{ color: "#94a3b8" }}>— (no sticky structures found)</span>
            )}
          </div>

          {/* Breakdown bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MiniBar
              label="SMZ (0–80)"
              value={`${Math.round(view.smzPart)}`}
              pct={smzPct}
              tone="smz"
            />
            <MiniBar
              label="Fib (0–20)"
              value={`${view.fibBoost}`}
              pct={fibPct}
              tone="fib"
            />
          </div>

          {/* Gate chips */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2, fontSize: 11 }}>
            <Check ok={!view.invalid} label="Fib Valid (74% gate)" />
            <Check ok={view.fibInZone} label="In Retrace Zone" />
            <Check ok={view.fibNear50} label="Near 50% (gravity)" />
          </div>

          {/* Reasons */}
          {view.reasons?.length ? (
            <div style={{ marginTop: 2, fontSize: 11, color: "#94a3b8" }}>
              Reasons: {view.reasons.join(" • ")}
            </div>
          ) : null}

          {/* Tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11 }}>
            <span style={{ color: "#9ca3af" }}>Load chart:</span>
            <button onClick={() => load("SPY")} style={{ ...styles.tab, ...(selection?.symbol === "SPY" ? styles.tabActive : null) }}>
              SPY
            </button>
            <button onClick={() => load("QQQ")} style={{ ...styles.tab, ...(selection?.symbol === "QQQ" ? styles.tabActive : null) }}>
              QQQ
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* -------------------- subcomponents & styles -------------------- */

function Check({ ok, label }) {
  const style = ok ? styles.chkOk : styles.chkNo;
  return (
    <div style={styles.chk}>
      <span style={style}>{ok ? "✓" : "•"}</span>
      <span>{label}</span>
    </div>
  );
}

function MiniBar({ label, value, pct, tone }) {
  const fill = tone === "fib"
    ? "linear-gradient(90deg,#60a5fa 0%,#38bdf8 40%,#fbbf24 100%)"
    : "linear-gradient(90deg,#22c55e 0%,#84cc16 45%,#f59e0b 100%)";

  return (
    <div style={{ background: "#0b0b0b", border: "1px solid #2b2b2b", borderRadius: 10, padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>{label}</div>
        <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 900 }}>{value}</div>
      </div>
      <div style={{ marginTop: 6, background: "#1f2937", borderRadius: 8, height: 8, overflow: "hidden", border: "1px solid #334155" }}>
        <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: fill }} />
      </div>
    </div>
  );
}

function Card({ title, timeframe, rightPills = [], score = 0, last = "—", children, extraRight = null }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={styles.title}>{title}</div>
          <span style={styles.badge}>{timeframe}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {rightPills.map((p, i) => (
            <span key={i} style={{ ...styles.pill, ...toneStyles(p.tone).pill }}>{p.text}</span>
          ))}
          {extraRight}
        </div>
      </div>

      <div style={styles.scoreRow}>
        <div style={styles.scoreLabel}>Score</div>
        <div style={styles.progress}><div style={{ ...styles.progressFill, width: `${pct}%` }} /></div>
        <div style={styles.scoreVal}>{pct}</div>
      </div>

      <div style={styles.metaRow}>
        <div><span style={styles.metaKey}>Last:</span> {last}</div>
        <div><span style={styles.metaKey}>Status:</span> Engine 2 gate + boost</div>
      </div>

      {children}
    </div>
  );
}

const styles = {
  card: {
    background: "#101010",
    border: "1px solid #262626",
    borderRadius: 10,
    padding: 10,
    color: "#e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 140,
  },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  title: { fontWeight: 800, fontSize: 14, lineHeight: "16px" },
  badge: { background: "#0b0b0b", border: "1px solid #2b2b2b", color: "#9ca3af", fontSize: 10, padding: "1px 6px", borderRadius: 999, fontWeight: 800 },
  pill: { fontSize: 10, padding: "2px 8px", borderRadius: 999, border: "1px solid #2b2b2b", fontWeight: 800, lineHeight: "14px" },

  scoreRow: { display: "grid", gridTemplateColumns: "44px 1fr 28px", alignItems: "center", gap: 6 },
  scoreLabel: { color: "#9ca3af", fontSize: 10 },
  progress: { background: "#1f2937", borderRadius: 6, height: 6, overflow: "hidden", border: "1px solid #334155" },
  progressFill: { height: "100%", background: "linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)" },
  scoreVal: { textAlign: "right", fontWeight: 900, fontSize: 12 },

  metaRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 6, fontSize: 11, color: "#cbd5e1" },
  metaKey: { color: "#9ca3af", marginRight: 4, fontWeight: 700 },

  chk: { display: "flex", alignItems: "center", gap: 6, fontSize: 11 },
  chkOk: { color: "#86efac", fontWeight: 900 },
  chkNo: { color: "#94a3b8", fontWeight: 900 },

  tab: { background: "#141414", color: "#cbd5e1", border: "1px solid #2a2a2a", borderRadius: 7, padding: "3px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
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
