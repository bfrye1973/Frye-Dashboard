// src/pages/rows/RowStrategies/index.jsx
// Strategy Scoring (Phase 1) — Engine 1 (Hierarchy) + Engine 2 (Fib)
// LOCKED SPEC (per latest teammate guidance):
// - SMZ selection MUST use /api/v1/smz-hierarchy (reducer truth), not raw sticky lists
// - SMZ contributes 0–80: inst.strength * 0.80
// - Fib contributes 0–20: +10 inRetraceZone +10 near50
// - Hard gates (score=0, invalid=true):
//    * FIB_INVALIDATION_74
//    * NO_INSTITUTIONAL_CONTEXT (no institutional zone selected)
//    * ZONE_ARCHIVED_OR_EXITED (behavioral invalidation evidence; no single boolean exists)
// - Pockets: optional if available; do not penalize if missing (Phase 1 shows status only)
// - Display labels (display-only):
//    A+ ≥ 90, A 80–89, B 70–79, C 60–69, <60 IGNORE
// - Poll every 30s, but skip polling when tab hidden
//
// UPDATED (per user request):
// - Render 3 equal-size strategy cards in this row:
//    1) Scalp (Minor Intraday)
//    2) Minor (Swing)
//    3) Intermediate (Long)
// - Add Entry Target (zone midpoint) above score
// - Show Exit Targets (Hi/Lo) using selected active institutional zone
// - Keep all existing logic intact; no deletions

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
const HIER_URL = `${API_BASE}/api/v1/smz-hierarchy?symbol=SPY`;

// Per strategy fib TF (gate / mapping)
// - Scalp: 10m primary, 1h gate -> use fib 1h
// - Minor Swing: 1h primary -> use fib 1h
// - Intermediate: 4h primary -> use fib 4h
const FIB_1H_URL = `${API_BASE}/api/v1/fib-levels?symbol=SPY&tf=1h`;
const FIB_4H_URL = `${API_BASE}/api/v1/fib-levels?symbol=SPY&tf=4h`;

/* -------------------- utils -------------------- */
const nowIso = () => new Date().toISOString();

function toAZ(iso, withSeconds = false) {
  try {
    return (
      new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: withSeconds ? "2-digit" : undefined,
        timeZone: AZ_TZ,
      }) + " AZ"
    );
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

function distBelow(price, zoneHi) {
  if (!Number.isFinite(price) || !Number.isFinite(zoneHi)) return Infinity;
  if (zoneHi > price) return Infinity;
  return price - zoneHi;
}

function grade(score) {
  const s = clamp100(score);
  if (s >= 90) return "A+";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  return "IGNORE";
}

/* -------------------- Institutional selection (Hierarchy) --------------------
Rule:
- Prefer zone that CONTAINS price.
- Else closest below price.
- Else null -> NO_INSTITUTIONAL_CONTEXT
-------------------------------------------------------------------------- */
function pickInstitutionalFromHierarchy({ hierarchy, price }) {
  const inst = hierarchy?.render?.institutional;
  const list = Array.isArray(inst) ? inst : [];

  const norm = list
    .map((z, idx) => {
      const hi = Number(z?.hi ?? z?.high ?? z?.top ?? z?.priceRange?.[0]);
      const lo = Number(z?.lo ?? z?.low ?? z?.bottom ?? z?.priceRange?.[1]);
      const strength = Number(z?.strength ?? z?.score ?? z?.institutionalScore ?? 0);
      const details = z?.details || z?.debug || null;
      return {
        idx,
        raw: z,
        hi,
        lo,
        strength: Number.isFinite(strength) ? strength : 0,
        contains: inRange(price, lo, hi),
        details,
      };
    })
    .filter((z) => Number.isFinite(z.hi) && Number.isFinite(z.lo));

  if (!norm.length) return null;

  const inside = norm.filter((z) => z.contains);
  if (inside.length) {
    inside.sort((a, b) => b.strength - a.strength);
    return inside[0];
  }

  // closest below
  const below = norm
    .map((z) => ({ ...z, belowDist: distBelow(price, z.hi) }))
    .filter((z) => Number.isFinite(z.belowDist) && z.belowDist !== Infinity)
    .sort((a, b) => a.belowDist - b.belowDist);

  return below.length ? below[0] : null;
}

/* -------------------- Behavioral invalidation (no single boolean) --------------------
Hard gate: ZONE_ARCHIVED_OR_EXITED
Triggers if any strong evidence exists that zone is no longer defending:
A) sticky archived: details.facts.sticky.status === "archived" OR archivedUtc exists
B) sticky exits: distinctExitCount>=2 OR exits.length>=2
C) structure exit facts: details.facts.exitSide1h exists AND exitBars1h indicates an exit
------------------------------------------------------------------------- */
function zoneArchivedOrExited(inst) {
  const facts =
    inst?.raw?.details?.facts ||
    inst?.details?.facts ||
    inst?.raw?.facts ||
    null;

  if (!facts || typeof facts !== "object") return false;

  const sticky = facts.sticky || null;

  // A) archived
  if (sticky) {
    const st = String(sticky.status || "").toLowerCase();
    if (st === "archived") return true;
    if (sticky.archivedUtc) return true;
  }

  // B) exits evidence
  if (sticky) {
    const distinctExitCount = Number(sticky.distinctExitCount);
    if (Number.isFinite(distinctExitCount) && distinctExitCount >= 2) return true;

    const exits = Array.isArray(sticky.exits) ? sticky.exits : [];
    if (exits.length >= 2) return true;
  }

  // C) exitSide1h + exitBars1h
  const exitSide1h = facts.exitSide1h ?? null;
  const exitBars1h = facts.exitBars1h ?? null;

  // Accept several possible shapes for exitBars1h
  const exitBarsCount =
    typeof exitBars1h === "number"
      ? exitBars1h
      : typeof exitBars1h === "string"
      ? Number(exitBars1h)
      : Array.isArray(exitBars1h)
      ? exitBars1h.length
      : exitBars1h && typeof exitBars1h === "object"
      ? Number(exitBars1h.count ?? exitBars1h.n ?? exitBars1h.bars ?? 0)
      : 0;

  if (exitSide1h && Number.isFinite(exitBarsCount) && exitBarsCount > 0) return true;

  return false;
}

/* -------------------- Optional pockets (Phase 1 display only) --------------------
We try to detect whether hierarchy output includes any pockets so UI can show:
- "Pocket: Present" or "Pocket: None"
No score impact in Phase 1 (pocketScore=0 if missing).
------------------------------------------------------------------------- */
function detectPocketPresence(hierarchy) {
  const render = hierarchy?.render || {};
  const candidates = [
    render.pockets,
    render.pockets_active,
    render.executionPockets,
    hierarchy?.pockets_active,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return true;
  }
  return false;
}

/* -------------------- Scoring (Phase 1) -------------------- */
function scoreSmzFib({ inst, fib }) {
  // Gate: fib must exist + be ok
  if (!fib || fib.ok !== true) {
    return invalidResult("FIB_NO_DATA");
  }
  if (fib?.signals?.invalidated) {
    return invalidResult("FIB_INVALIDATION_74");
  }

  // Gate: must have institutional context
  if (!inst) {
    return invalidResult("NO_INSTITUTIONAL_CONTEXT");
  }

  // Gate: behavioral invalidation
  if (zoneArchivedOrExited(inst)) {
    return invalidResult("ZONE_ARCHIVED_OR_EXITED");
  }

  // Base SMZ score
  const instStrength = clamp100(Number(inst.strength));
  const smzPart = instStrength * 0.8; // 0–80

  // Fib boost (0–20)
  let fibBoost = 0;
  if (fib?.signals?.inRetraceZone) fibBoost += 10;
  if (fib?.signals?.near50) fibBoost += 10;

  // Remove W4 cap unless explicitly tagged as W4 (manual only)
  if (fib?.anchors?.context === "W4") {
    // Context is manual input. Only cap in this explicit case.
    fibBoost = Math.min(fibBoost, 10);
  }

  const total = clamp100(smzPart + fibBoost);

  const reasons = [];
  if (!fib?.signals?.inRetraceZone) reasons.push("FIB_OUTSIDE_RETRACE_ZONE");

  return {
    invalid: false,
    total,
    reasons,
    smzPart,
    fibBoost,
    instStrength,
  };
}

function invalidResult(code) {
  return {
    invalid: true,
    total: 0,
    reasons: [code],
    smzPart: 0,
    fibBoost: 0,
    instStrength: 0,
  };
}

/* -------------------- Entry/Exit Targets --------------------
Entry Target (BEFORE trade): zone midpoint
Exit Target (AFTER trade): depends on direction; Phase 1: show both edges
------------------------------------------------------------------------- */
function zoneMidpoint(lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return NaN;
  return (Number(lo) + Number(hi)) / 2;
}

/* -------------------- component -------------------- */
export default function RowStrategies() {
  const { selection, setSelection } = useSelection();

  const [hierRes, setHierRes] = useState({ data: null, err: null, lastFetch: null });
  const [fib1hRes, setFib1hRes] = useState({ data: null, err: null, lastFetch: null });
  const [fib4hRes, setFib4hRes] = useState({ data: null, err: null, lastFetch: null });

  // Poll hierarchy + fib every 30s (skip when hidden)
  useEffect(() => {
    let alive = true;

    async function pull() {
      if (typeof document !== "undefined" && document.hidden) return;

      try {
        const [hR, f1R, f4R] = await Promise.all([
          fetch(`${HIER_URL}&t=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-store" } }),
          fetch(`${FIB_1H_URL}&t=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-store" } }),
          fetch(`${FIB_4H_URL}&t=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-store" } }),
        ]);

        const hJ = await hR.json();
        const f1J = await f1R.json();
        const f4J = await f4R.json();
        if (!alive) return;

        setHierRes({ data: hJ, err: null, lastFetch: nowIso() });
        setFib1hRes({ data: f1J, err: null, lastFetch: nowIso() });
        setFib4hRes({ data: f4J, err: null, lastFetch: nowIso() });
      } catch (e) {
        if (!alive) return;
        const msg = String(e?.message || e);
        setHierRes((s) => ({ ...s, err: msg, lastFetch: nowIso() }));
        setFib1hRes((s) => ({ ...s, err: msg, lastFetch: nowIso() }));
        setFib4hRes((s) => ({ ...s, err: msg, lastFetch: nowIso() }));
      }
    }

    pull();
    const id = setInterval(pull, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const cards = useMemo(() => {
    const hierarchy = hierRes.data;

    const pocketPresent = detectPocketPresence(hierarchy);

    // Price source: prefer 1h fib diagnostics if available, else 4h fib diagnostics, else null
    const p1 = Number(fib1hRes.data?.diagnostics?.price);
    const p4 = Number(fib4hRes.data?.diagnostics?.price);
    const priceOk = Number.isFinite(p1) ? p1 : Number.isFinite(p4) ? p4 : null;

    // Institutional selection (hierarchy truth)
    const inst = pickInstitutionalFromHierarchy({ hierarchy, price: priceOk });

    function buildCard({ name, timeframeLabel, fibObj, tfBadge }) {
      const fib = fibObj;

      // Score
      const scored = scoreSmzFib({ inst, fib });

      // Live indicator (per card, but driven by shared fetch timestamps)
      const hierFresh = minutesAgo(hierRes.lastFetch) <= 2;
      const fibFresh = minutesAgo(fibObj?._lastFetch ?? null) <= 2; // not used; we set below

      const liveStatus =
        hierRes.err || (fib?.ok !== true && fib?.error)
          ? "red"
          : !hierFresh
          ? "yellow"
          : "green";

      const liveTip =
        `HIER fetch: ${hierRes.lastFetch ? toAZ(hierRes.lastFetch, true) : "—"} • ` +
        `Fib(${tfBadge}) fetch: ${tfBadge === "4h"
          ? (fib4hRes.lastFetch ? toAZ(fib4hRes.lastFetch, true) : "—")
          : (fib1hRes.lastFetch ? toAZ(fib1hRes.lastFetch, true) : "—")
        } • ` +
        `Price: ${priceOk ? fmt2(priceOk) : "—"}`;

      // Fib flags for UI
      const fibInvalid = fib?.signals?.invalidated === true;
      const fibInZone = fib?.signals?.inRetraceZone === true;
      const fibNear50 = fib?.signals?.near50 === true;

      // Permission placeholder (later Engine 6)
      const permission =
        scored.invalid
          ? "STAND DOWN"
          : (fibInZone && (inst?.contains ?? false))
          ? "FULL"
          : "REDUCED";

      // Targets
      const lo = inst ? Number(inst.lo) : NaN;
      const hi = inst ? Number(inst.hi) : NaN;
      const mid = zoneMidpoint(lo, hi);

      const entryText =
        inst
          ? (inst.contains ? `IN ZONE ✅  (mid ${fmt2(mid)})` : `ENTRY MIDPOINT: ${fmt2(mid)}`)
          : "—";

      const exitText =
        inst
          ? `EXIT HIGH: ${fmt2(hi)}  •  EXIT LOW: ${fmt2(lo)}`
          : "—";

      const label = grade(scored.total);

      const rightPills = [
        { text: scored.invalid ? "INVALID" : "LIVE", tone: scored.invalid ? "warn" : "live" },
        { text: `Label ${label}`, tone: label === "A+" ? "ok" : label === "A" ? "info" : "muted" },
        { text: permission, tone: permission === "FULL" ? "ok" : permission === "REDUCED" ? "warn" : "muted" },
      ];

      const smzPct = clamp100((scored.smzPart / 80) * 100);
      const fibPct = clamp100((scored.fibBoost / 20) * 100);

      const lastStamp =
        tfBadge === "4h"
          ? (fib4hRes.lastFetch ? toAZ(fib4hRes.lastFetch) : "—")
          : (fib1hRes.lastFetch ? toAZ(fib1hRes.lastFetch) : "—");

      return {
        name,
        timeframeLabel,
        tfBadge,
        rightPills,
        score: scored.total,
        label,
        permission,
        last: hierRes.lastFetch ? toAZ(hierRes.lastFetch) : "—",
        extraRight: <LiveDot status={liveStatus} tip={liveTip} />,

        // display fields
        price: priceOk,
        inst,
        pocketPresent,
        fibInvalid,
        fibInZone,
        fibNear50,
        reasons: scored.reasons,
        anchors: fib?.anchors || null,

        entryText,
        exitText,
        smzPct,
        fibPct,
        smzPart: scored.smzPart,
        fibBoost: scored.fibBoost,
        instStrength: scored.instStrength,

        lastStamp,
      };
    }

    const scalp = buildCard({
      name: "Scalp — Minor Intraday",
      timeframeLabel: "10m primary • 1h gate",
      fibObj: fib1hRes.data,
      tfBadge: "10m",
    });

    const minor = buildCard({
      name: "Minor — Swing",
      timeframeLabel: "1h primary • 4h confirm",
      fibObj: fib1hRes.data,
      tfBadge: "1h",
    });

    const intermediate = buildCard({
      name: "Intermediate — Long",
      timeframeLabel: "4h primary • EOD gate",
      fibObj: fib4hRes.data,
      tfBadge: "4h",
    });

    return [scalp, minor, intermediate];
  }, [hierRes, fib1hRes, fib4hRes]);

  function load(sym, tf = "10m") {
    setSelection({ symbol: sym, timeframe: tf, strategy: "smz" });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
      {cards.map((c, idx) => (
        <Card
          key={idx}
          title={c.name}
          timeframe={c.tfBadge}
          subline={c.timeframeLabel}
          rightPills={c.rightPills}
          score={c.score}
          last={c.lastStamp}
          extraRight={c.extraRight}
        >
          {/* Targets */}
          <div style={{ display: "grid", gap: 6, marginTop: 2 }}>
            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              <b>Entry Target:</b> {c.entryText}
            </div>
            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              <b>Exit Target:</b> {c.exitText}
            </div>

            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              <b>Price:</b> {c.price ? fmt2(c.price) : "—"}{" "}
              <span style={{ color: "#94a3b8" }}>
                • Anchors {c.anchors?.low ? fmt2(c.anchors.low) : "—"} → {c.anchors?.high ? fmt2(c.anchors.high) : "—"}
              </span>
            </div>

            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              <b>Active Institutional:</b>{" "}
              {c.inst ? (
                <>
                  {fmt2(c.inst.lo)}–{fmt2(c.inst.hi)}{" "}
                  <span style={{ color: "#94a3b8" }}>
                    • Strength {clamp100(c.instStrength).toFixed(0)}/100
                    {c.inst.contains ? " • (inside)" : ""}
                  </span>
                </>
              ) : (
                <span style={{ color: "#fbbf24" }}>NONE (gate will stand down)</span>
              )}
            </div>

            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              <b>Execution Pocket:</b>{" "}
              {c.pocketPresent ? (
                <span style={{ color: "#86efac" }}>Present (optional)</span>
              ) : (
                <span style={{ color: "#94a3b8" }}>None (no penalty Phase 1)</span>
              )}
            </div>

            {/* Breakdown bars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <MiniBar label="SMZ (0–80)" value={`${Math.round(c.smzPart)}`} pct={c.smzPct} tone="smz" />
              <MiniBar label="Fib (0–20)" value={`${c.fibBoost}`} pct={c.fibPct} tone="fib" />
            </div>

            {/* Gates */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2, fontSize: 11 }}>
              <Check ok={c.score > 0 && !c.rightPills?.some((p) => p.text === "INVALID")} label="Valid" />
              <Check ok={!c.fibInvalid} label="Fib Valid (74% gate)" />
              <Check ok={c.fibInZone} label="In Retrace Zone" />
              <Check ok={c.fibNear50} label="Near 50%" />
            </div>

            {/* Reasons */}
            {c.reasons?.length ? (
              <div style={{ marginTop: 2, fontSize: 11, color: "#94a3b8" }}>
                Reasons: {c.reasons.join(" • ")}
              </div>
            ) : null}

            {/* Tabs */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11 }}>
              <span style={{ color: "#9ca3af" }}>Load chart:</span>
              <button
                onClick={() => load("SPY", c.tfBadge === "4h" ? "4h" : c.tfBadge === "1h" ? "1h" : "10m")}
                style={{ ...styles.tab, ...(selection?.symbol === "SPY" ? styles.tabActive : null) }}
              >
                SPY
              </button>
              <button
                onClick={() => load("QQQ", c.tfBadge === "4h" ? "4h" : c.tfBadge === "1h" ? "1h" : "10m")}
                style={{ ...styles.tab, ...(selection?.symbol === "QQQ" ? styles.tabActive : null) }}
              >
                QQQ
              </button>
            </div>
          </div>
        </Card>
      ))}
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
  const fill =
    tone === "fib"
      ? "linear-gradient(90deg,#60a5fa 0%,#38bdf8 40%,#fbbf24 100%)"
      : "linear-gradient(90deg,#22c55e 0%,#84cc16 45%,#f59e0b 100%)";

  return (
    <div style={{ background: "#0b0b0b", border: "1px solid #2b2b2b", borderRadius: 10, padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 800 }}>{label}</div>
        <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 900 }}>{value}</div>
      </div>
      <div style={{ marginTop: 6, background: "#1f2937", borderRadius: 8, height: 8, overflow: "hidden", border: "1px solid #334155" }}>
        <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: fill }} />
      </div>
    </div>
  );
}

function Card({ title, timeframe, subline, rightPills = [], score = 0, last = "—", children, extraRight = null }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={styles.title}>{title}</div>
            <span style={styles.badge}>{timeframe}</span>
          </div>
          {subline ? (
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>{subline}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {rightPills.map((p, i) => (
            <span key={i} style={{ ...styles.pill, ...toneStyles(p.tone).pill }}>{p.text}</span>
          ))}
          {extraRight}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>
        <span style={{ color: "#9ca3af", fontWeight: 800 }}>Last:</span> {last}
      </div>

      <div style={styles.scoreRow}>
        <div style={styles.scoreLabel}>Score</div>
        <div style={styles.progress}><div style={{ ...styles.progressFill, width: `${pct}%` }} /></div>
        <div style={styles.scoreVal}>{pct}</div>
      </div>

      <div style={styles.metaRow}>
        <div><span style={styles.metaKey}>Label bands:</span> A+≥90 A≥80 B≥70 C≥60</div>
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
    minHeight: 220,
  },
  head: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
  title: { fontWeight: 900, fontSize: 14, lineHeight: "16px" },
  badge: { background: "#0b0b0b", border: "1px solid #2b2b2b", color: "#9ca3af", fontSize: 10, padding: "1px 6px", borderRadius: 999, fontWeight: 900 },
  pill: { fontSize: 10, padding: "2px 8px", borderRadius: 999, border: "1px solid #2b2b2b", fontWeight: 900, lineHeight: "14px" },

  scoreRow: { display: "grid", gridTemplateColumns: "44px 1fr 28px", alignItems: "center", gap: 6 },
  scoreLabel: { color: "#9ca3af", fontSize: 10 },
  progress: { background: "#1f2937", borderRadius: 6, height: 6, overflow: "hidden", border: "1px solid #334155" },
  progressFill: { height: "100%", background: "linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)" },
  scoreVal: { textAlign: "right", fontWeight: 900, fontSize: 12 },

  metaRow: { display: "grid", gridTemplateColumns: "1fr", gap: 6, fontSize: 11, color: "#cbd5e1" },
  metaKey: { color: "#9ca3af", marginRight: 4, fontWeight: 800 },

  chk: { display: "flex", alignItems: "center", gap: 6, fontSize: 11 },
  chkOk: { color: "#86efac", fontWeight: 900 },
  chkNo: { color: "#94a3b8", fontWeight: 900 },

  tab: { background: "#141414", color: "#cbd5e1", border: "1px solid #2a2a2a", borderRadius: 7, padding: "3px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer" },
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
