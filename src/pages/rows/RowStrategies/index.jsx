// src/pages/rows/RowStrategies/index.jsx
// Strategies — Engine 5 Score + Engine 6 Permission (SYNCED via dashboard-snapshot)
//
// ✅ One poll endpoint: /api/v1/dashboard-snapshot?symbol=SPY&includeContext=1
// ✅ Engine Stack (E1–E6) always visible on RIGHT column
// ✅ LEFT column keeps full readable info
// ✅ Buttons: (PRODUCTION) Paper Only + Open Full Strategies
//
// ✅ Stability fixes (LOCKED):
// - NEVER stops polling (even if tab hidden)  ✅ (now via shared hook)
// - hard timeout (20s) with AbortController   ✅ (shared hook)
// - 1 retry (800ms) for transient hiccups     ✅ (shared hook)
// - inFlight always released in finally       ✅ (shared hook)
// - if inFlight is true, we still schedule the next poll (prevents stall) ✅ (shared hook)
// - never wipes last good snapshot on error (keeps UI populated) ✅ (shared hook)
//
// ✅ Observability:
// - Shows Frontend fetch time + Backend snapshot time
// - Shows Build stamp so you can confirm fresh bundle
//
// ✅ FIXES IN THIS VERSION:
// - Golden Coil uses Engine5 truth: confluence.flags.goldenCoil
// - Engine Stack E3 shows stage + score + structureState
// - visibilitychange only triggers pull when tab becomes VISIBLE
// - ✅ FIXED JSX structure (actions bar is inside card, minimal buttons)
//
// ✅ UPDATE (THIS PASS):
// - Uses shared snapshot polling hook: useDashboardSnapshot
// - Adds SCALP GO badge (VERY BIG) next to GOLDEN COIL using backend-1 proxy: /api/v1/scalp-status
//
// ✅ UPDATE (ENGINE 15 READINESS):
// - Shows a BIG "READINESS" bar: WAIT / NEAR / ARMING / READY / CONFIRMED
// - Uses snapshot.engine15.byStrategy[strategyId] if present (Replay-safe)
// - Otherwise computes a safe local readiness fallback from confluence (Live-safe)
// - Shows permission overlay separately (STAND_DOWN is NO ENTRIES only)

import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import LiveDot from "../../../components/LiveDot";
import { useDashboardSnapshot } from "../../../hooks/useDashboardSnapshot";

/* -------------------- env helpers -------------------- */
function env(name, fb = "") {
  try {
    if (typeof process !== "undefined" && process.env && name in process.env) {
      return String(process.env[name] || "").trim();
    }
  } catch {}
  return fb;
}

function normalizeApiBase(x) {
  const raw = String(x || "").trim();
  if (!raw) return "https://frye-market-backend-1.onrender.com";
  let out = raw.replace(/\/+$/, "");
  out = out.replace(/\/api\/v1$/i, "");
  out = out.replace(/\/api$/i, "");
  return out;
}

const API_BASE = normalizeApiBase(env("REACT_APP_API_BASE", ""));
const AZ_TZ = "America/Phoenix";

// 🔒 Poll cadence (LOCKED)
const POLL_MS = 20000;
const TIMEOUT_MS = 20000;
const RETRY_DELAY_MS = 800;

// GO poll cadence (lightweight, scalp-only display)
const GO_POLL_MS = 2000;
const GO_TIMEOUT_MS = 6000;

// Build stamp (prefer env if you have one, else runtime stamp)
const BUILD_STAMP =
  env("REACT_APP_BUILD_STAMP", "") ||
  env("REACT_APP_COMMIT_SHA", "") ||
  new Date().toISOString();

/* -------------------- endpoints (legacy, kept) -------------------- */
const SCALP_STATUS_URL = () => `${API_BASE}/api/v1/scalp-status?t=${Date.now()}`;

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

function snapshotTime(snapshot) {
  const iso = snapshot?.now || snapshot?.ts || null;
  if (!iso) return "—";
  return toAZ(iso, true);
}

function minutesAgo(iso) {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 60000;
}

function clamp100(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function fmt2(x) {
  return Number.isFinite(x) ? Number(x).toFixed(2) : "—";
}

function top3(arr) {
  const a = Array.isArray(arr) ? arr : [];
  return a.slice(0, 3);
}

function grade(score) {
  const s = clamp100(score);
  if (s >= 90) return "A+";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  return "IGNORE";
}

/* -------------------- Golden Coil badge rule (LOCKED to Engine5 truth) -------------------- */
function showGoldenCoil(confluence) {
  return confluence?.invalid !== true && confluence?.flags?.goldenCoil === true;
}

/* -------------------- fetch helper (legacy, kept) -------------------- */
async function safeFetchJson(url, opts = {}) {
  const attempt = async () => {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "Cache-Control": "no-store",
        ...(opts.headers || {}),
      },
      ...opts,
    });

    const text = await res.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        json?.error ||
        json?.detail ||
        (typeof json === "string" ? json : null) ||
        text?.slice(0, 200) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return json;
  };

  try {
    return await attempt();
  } catch (e1) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return await attempt();
  }
}

/* -------------------- GO fetch (scalp-status) -------------------- */
async function safeFetchGo(url, { signal } = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json", "Cache-Control": "no-store" },
    signal,
  });
  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg =
      json?.error || json?.detail || text?.slice(0, 200) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function fmtTriggerType(x) {
  const s = String(x || "").trim().toUpperCase();
  if (!s) return "—";
  if (s === "PULLBACK_RECLAIM") return "PB RECLAIM";
  if (s === "BREAKOUT") return "BREAKOUT";
  if (s === "SWING_CLOSE_CONFIRM") return "SWING CLOSE";
  if (s === "LONG_CLOSE_CONFIRM") return "LONG CLOSE";
  return s;
}

function GoPillBig({ go }) {
  const signal = go?.signal === true;
  const dir = String(go?.direction || "").toUpperCase();
  const trig = fmtTriggerType(go?.triggerType);
  const line = Number(go?.triggerLine);
  const atUtc = go?.atUtc || null;
  const cooldownUntilMs = Number(go?.cooldownUntilMs || 0);
  const nowMs = Date.now();
  const inCooldown = cooldownUntilMs && nowMs < cooldownUntilMs;

  const bg = signal
    ? "linear-gradient(135deg,#22c55e,#16a34a)"
    : inCooldown
    ? "linear-gradient(135deg,#fbbf24,#f59e0b)"
    : "#111827";

  const border = signal
    ? "1px solid rgba(255,255,255,.22)"
    : "1px solid #334155";
  const color = signal ? "#07110a" : "#e5e7eb";

  const mainText = signal ? `GO ${dir || ""}`.trim() : "GO: NO";
  const sub = signal
    ? `${trig}${Number.isFinite(line) ? ` @ ${fmt2(line)}` : ""}`
    : inCooldown
    ? "COOLDOWN"
    : "WAIT";

  const tipParts = [];
  tipParts.push(`signal=${String(signal)}`);
  tipParts.push(`direction=${dir || "—"}`);
  tipParts.push(`triggerType=${trig}`);
  tipParts.push(`triggerLine=${Number.isFinite(line) ? fmt2(line) : "—"}`);
  tipParts.push(`atUtc=${atUtc || "—"}`);
  tipParts.push(`cooldownUntilMs=${cooldownUntilMs || "—"}`);
  const title = tipParts.join(" | ");

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 2,
        padding: "8px 12px",
        borderRadius: 10,
        background: bg,
        border,
        boxShadow: signal ? "0 0 14px rgba(34,197,94,.35)" : "none",
        minWidth: 140,
      }}
    >
      <span style={{ fontWeight: 900, fontSize: 14, lineHeight: "14px", color }}>
        {mainText}
      </span>
      <span
        style={{
          fontWeight: 900,
          fontSize: 10,
          lineHeight: "10px",
          opacity: 0.95,
          color,
        }}
      >
        {sub}
      </span>
    </span>
  );
}

/* -------------------- extraction helpers -------------------- */
function extractActiveZone(confluence) {
  const z = confluence?.context?.activeZone || null;
  const lo = Number(z?.lo);
  const hi = Number(z?.hi);
  const mid = Number(z?.mid);

  return {
    zoneType: z?.zoneType || z?.type || "—",
    id: z?.id || null,
    lo: Number.isFinite(lo) ? lo : NaN,
    hi: Number.isFinite(hi) ? hi : NaN,
    mid: Number.isFinite(mid) ? mid : NaN,
  };
}

function extractTargets(confluence) {
  const t = confluence?.targets || {};
  const entryTarget = Number(t?.entryTarget);
  const exitTarget = Number(t?.exitTarget);
  const exitTargetHi = Number(t?.exitTargetHi);
  const exitTargetLo = Number(t?.exitTargetLo);

  return {
    entryTarget: Number.isFinite(entryTarget) ? entryTarget : NaN,
    exitTarget: Number.isFinite(exitTarget) ? exitTarget : NaN,
    exitTargetHi: Number.isFinite(exitTargetHi) ? exitTargetHi : NaN,
    exitTargetLo: Number.isFinite(exitTargetLo) ? exitTargetLo : NaN,
  };
}

function extractCompression(confluence) {
  const c = confluence?.compression || {};
  return {
    active: c?.active === true,
    tier: c?.tier || "—",
    score: Number.isFinite(Number(c?.score)) ? Number(c?.score) : NaN,
    state: c?.state || "—",
    widthAtrRatio: Number.isFinite(Number(c?.widthAtrRatio))
      ? Number(c?.widthAtrRatio)
      : NaN,
    quiet: c?.quiet === true,
  };
}

function extractVolume(confluence) {
  const v = confluence?.volume || {};
  const volScore = Number(v?.volumeScore);
  const confirmed = v?.volumeConfirmed === true;
  const state = confluence?.volumeState || "—";

  return {
    state,
    volumeScore: Number.isFinite(volScore) ? volScore : NaN,
    volumeConfirmed: confirmed,
  };
}

function nextTriggerText(confluence) {
  const invalid = confluence?.invalid === true;
  const codes = Array.isArray(confluence?.reasonCodes) ? confluence.reasonCodes : [];
  const hasZone = !!confluence?.context?.activeZone;
  const comp = confluence?.compression;
  const volState = String(confluence?.volumeState || "");

  if (invalid) {
    if (codes.includes("NO_ZONE_NO_TRADE"))
      return "Waiting: zone context (no zone → no trade).";
    if (codes.includes("FIB_INVALIDATION_74"))
      return "Waiting: fib invalidation cleared (74% rule).";
    return "Waiting: invalid condition cleared.";
  }

  if (!hasZone)
    return "Waiting: active zone selection (negotiated/shelf/institutional).";

  if (comp?.active === true && comp?.state === "COILING") {
    if (volState === "NO_SIGNAL") return "Waiting: initiative volume / confirmation.";
    return "Waiting: breakout/launch confirmation.";
  }

  return "Waiting: stronger confluence signals.";
}

/* -------------------- permission pill styling -------------------- */
function permStyle(permission) {
  // Colors are about ENTRY STATUS, not engine status.
  if (permission === "ALLOW")
    return { background: "#22c55e", color: "#0b1220", border: "2px solid #0c1320" };
  if (permission === "REDUCE")
    return { background: "#fbbf24", color: "#0b1220", border: "2px solid #0c1320" };
  if (permission === "STAND_DOWN")
    return { background: "#ef4444", color: "#0b1220", border: "2px solid #0c1320" };
  return { background: "#0b0b0b", color: "#93c5fd", border: "1px solid #2b2b2b" };
}

/* -------------------- permission pill text (ENGINE ALWAYS ON) -------------------- */
function permLabel(permission) {
  if (permission === "ALLOW") return "ENTRIES: ALLOWED";
  if (permission === "REDUCE") return "ENTRIES: REDUCED";
  if (permission === "STAND_DOWN") return "ENTRIES: BLOCKED";
  return "ENTRIES: UNKNOWN";
}

/* -------------------- Engine 3/4 C-level helpers -------------------- */
function volRegimeFromScore(volumeScore, flags = {}) {
  const vs = Number(volumeScore);
  if (flags?.liquidityTrap) return "TRAP_RISK";
  if (!Number.isFinite(vs)) return "UNKNOWN";
  if (vs <= 3) return "QUIET";
  if (vs <= 7) return "NORMAL";
  return "EXPANDING";
}

function volPressureFromFlags(flags = {}) {
  if (flags?.liquidityTrap) return "TRAP";
  if (flags?.distributionDetected) return "BEARISH";
  if (flags?.absorptionDetected) return "ABSORB";
  if (flags?.initiativeMoveConfirmed) return "INITIATIVE";
  return "NEUTRAL";
}

function shortNextText(s = "") {
  if (!s) return "—";
  return s.length > 54 ? s.slice(0, 51) + "…" : s;
}

function e3FallbackPosition(reasonCodes = []) {
  if (Array.isArray(reasonCodes) && reasonCodes.includes("NOT_IN_ZONE")) return "OUTSIDE";
  return "IN/NEAR";
}

function e3FallbackNext(stage) {
  if (stage === "IDLE") return "Next: tighten → ARMED";
  if (stage === "ARMED") return "Next: exit zone → TRIGGERED";
  if (stage === "TRIGGERED") return "Next: score≥7 → CONFIRMED";
  if (stage === "CONFIRMED") return "Next: monitor follow-through";
  return "Next: monitor";
}

/* -------------------- buttons -------------------- */
function btn() {
  return {
    background: "#141414",
    color: "#e5e7eb",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

/* -------------------- open tabs -------------------- */
function openFullStrategies(symbol = "SPY") {
  const url = `/strategies-full?symbol=${encodeURIComponent(symbol)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// kept for compatibility (even if unused right now)
function openFullChart(symbol = "SPY", tf = "10m") {
  const url = `/chart?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/* -------------------- MiniRow -------------------- */
function MiniRow({ label, left, right, tone = "muted" }) {
  const t = (kind) => {
    switch (String(kind || "").toUpperCase()) {
      case "OK":
        return { background: "#06220f", color: "#86efac", borderColor: "#166534" };
      case "WARN":
        return { background: "#1b1409", color: "#fbbf24", borderColor: "#92400e" };
      case "DANGER":
        return { background: "#2b0b0b", color: "#fca5a5", borderColor: "#7f1d1d" };
      default:
        return { background: "#0b0b0b", color: "#94a3b8", borderColor: "#2b2b2b" };
    }
  };

  const toneMap =
    tone === "ok" ? "OK" : tone === "warn" ? "WARN" : tone === "danger" ? "DANGER" : "MUTED";
  const pill = t(toneMap);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "92px 1fr auto", gap: 8, alignItems: "center" }}>
      <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900 }}>{label}</div>
      <div
        style={{
          color: "#cbd5e1",
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {left}
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          padding: "3px 8px",
          borderRadius: 999,
          border: `1px solid ${pill.borderColor}`,
          background: pill.background,
          color: pill.color,
          whiteSpace: "nowrap",
        }}
      >
        {right}
      </span>
    </div>
  );
}

/* -------------------- UI color/icon helpers -------------------- */
function stageToIcon(stage, structureState, armed) {
  const ss = String(structureState || "").toUpperCase();
  if (ss === "FAILURE" || stage === "FAILURE") return "✖";
  if (stage === "CONFIRMED") return "🔥";
  if (stage === "TRIGGERED") return "✅";
  if (stage === "ARMED") return "⚡";
  if (stage === "IDLE") return "●";
  return armed ? "⚡" : "●";
}

function stageToColor(stage, structureState) {
  const ss = String(structureState || "").toUpperCase();
  if (ss === "FAILURE" || stage === "FAILURE") return "#fca5a5";
  if (stage === "CONFIRMED") return "#86efac";
  if (stage === "TRIGGERED") return "#bef264";
  if (stage === "ARMED") return "#fbbf24";
  return "#94a3b8";
}

/* -------------------- Engine 15 local fallback (SAFE) -------------------- */
function computeReadinessFallback({ confluence, permissionObj }) {
  // This is a SAFE fallback when snapshot.engine15 is not present.
  // It DOES NOT change Engine 3/4 math. It only provides a UI state.

  const allowed = ["NEGOTIATED", "INSTITUTIONAL"];
  const nearThresholdPts = 1.5;

  const price = typeof confluence?.price === "number" ? confluence.price : null;

  const z = confluence?.context?.activeZone || null;
  const zTypeRaw = String(z?.zoneType || z?.type || "NONE").toUpperCase();
  const zoneType = zTypeRaw === "SHELF" ? "SHELF" : zTypeRaw; // keep explicit
  const lo = Number(z?.lo);
  const hi = Number(z?.hi);

  const inRange = (p, a, b) => Number.isFinite(p) && Number.isFinite(a) && Number.isFinite(b) && p >= Math.min(a, b) && p <= Math.max(a, b);
  const distPts = (p, a, b) => {
    if (!Number.isFinite(p) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (inRange(p, a, b)) return 0;
    return Math.min(Math.abs(p - a), Math.abs(p - b));
  };

  const d = distPts(price, lo, hi);
  const allowedType = allowed.includes(zoneType);

  const inAllowedZone = Boolean(allowedType && d === 0);
  const nearAllowedZone = Boolean(allowedType && d !== null && d <= nearThresholdPts);

  const e3 = confluence?.context?.reaction || {};
  const e4 = confluence?.context?.volume || {};
  const e4Flags = e4?.flags || {};

  const e3Stage = String(e3.stage || "—").toUpperCase();
  const e3Arming = e3.armed === true || e3Stage === "ARMED" || e3Stage === "TRIGGERED";
  const e3Confirmed = e3Stage === "CONFIRMED";

  const volScore = Number(e4.volumeScore);
  const volStrong = Number.isFinite(volScore) && volScore >= 7;

  // Reason codes
  const reasonCodes = [];
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) reasonCodes.push("NO_ZONE_CONTEXT");
  else if (inAllowedZone) reasonCodes.push("IN_ALLOWED_ZONE");
  else if (nearAllowedZone) reasonCodes.push("NEAR_ALLOWED_ZONE");
  else reasonCodes.push("WAIT_NOT_NEAR_ALLOWED_ZONE");

  if (e3Confirmed) reasonCodes.push("STRUCTURE_CONFIRMED");
  else if (e3Arming) reasonCodes.push("ARMING_STRUCTURE");

  if (volStrong) reasonCodes.push("VOLUME_STRONG");
  if (e4Flags.reversalExpansion) reasonCodes.push("VOLUME_REVERSAL_EXPANSION");
  if (e4Flags.pullbackContraction) reasonCodes.push("VOLUME_PULLBACK_CONTRACTION");

  // State machine
  let state = "WAIT";
  const hasArming = e3Arming || volStrong;
  if (!nearAllowedZone && !inAllowedZone) state = "WAIT";
  else if (!inAllowedZone) state = hasArming ? "ARMING" : "NEAR";
  else state = e3Confirmed ? "CONFIRMED" : hasArming ? "READY" : "NEAR";

  const next = [];
  if (Number.isFinite(lo) && Number.isFinite(hi)) {
    next.push(`Zone: ${lo.toFixed(2)}–${hi.toFixed(2)} (${zoneType})`);
    if (!inAllowedZone) next.push("Wait for re-entry into allowed zone");
  }
  if (!e3Confirmed) next.push("E3: wait for CONFIRMED or stronger reaction");
  if (!volStrong) next.push("E4: wait for volumeScore ≥ 7 or regime shift");

  return {
    ok: true,
    mode: null,
    price,
    zone: {
      allowed,
      selected: Number.isFinite(lo) && Number.isFinite(hi) ? { id: z?.id || null, type: zoneType, lo, hi, source: z?.source || "ACTIVE" } : null,
      inAllowedZone,
      nearAllowedZone,
      distancePts: d,
    },
    engine3: e3 || null,
    engine4: e4 || null,
    permission: permissionObj || null,
    readiness: { state, reasonCodes, next },
  };
}

/* -------------------- BIG Readiness Bar (Engine 15) -------------------- */
function readinessStyle(state) {
  const s = String(state || "WAIT").toUpperCase();
  if (s === "CONFIRMED") return { bg: "linear-gradient(135deg,#22c55e,#16a34a)", fg: "#06110a", border: "1px solid rgba(255,255,255,.22)" };
  if (s === "READY") return { bg: "linear-gradient(135deg,#a3e635,#65a30d)", fg: "#0b1220", border: "1px solid rgba(255,255,255,.18)" };
  if (s === "ARMING") return { bg: "linear-gradient(135deg,#fbbf24,#f59e0b)", fg: "#0b1220", border: "1px solid rgba(255,255,255,.18)" };
  if (s === "NEAR") return { bg: "linear-gradient(135deg,#60a5fa,#3b82f6)", fg: "#071423", border: "1px solid rgba(255,255,255,.18)" };
  return { bg: "#111827", fg: "#e5e7eb", border: "1px solid #334155" };
}

function ReadinessBar({ readinessPack }) {
  const state = readinessPack?.readiness?.state || "WAIT";
  const rc = Array.isArray(readinessPack?.readiness?.reasonCodes) ? readinessPack.readiness.reasonCodes : [];
  const next = Array.isArray(readinessPack?.readiness?.next) ? readinessPack.readiness.next : [];

  const zone = readinessPack?.zone || {};
  const dist = zone?.distancePts;
  const distTxt = Number.isFinite(dist) ? `${dist.toFixed(2)} pts` : "—";

  const style = readinessStyle(state);

  return (
    <div
      style={{
        borderRadius: 12,
        padding: 10,
        background: style.bg,
        border: style.border,
        boxShadow: "0 0 18px rgba(0,0,0,.35)",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 10,
      }}
      title={[`state=${state}`, `dist=${distTxt}`, ...rc].join(" | ")}
    >
      <div style={{ fontWeight: 1000, fontSize: 12, letterSpacing: 0.6, color: style.fg }}>
        READINESS
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 1000, fontSize: 18, lineHeight: "18px", color: style.fg }}>
          {String(state).toUpperCase()}
        </div>

        <div style={{ fontWeight: 900, fontSize: 12, color: style.fg, opacity: 0.95 }}>
          dist: {distTxt}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {rc.slice(0, 4).map((c) => (
            <span
              key={c}
              style={{
                fontSize: 10,
                fontWeight: 1000,
                padding: "4px 8px",
                borderRadius: 999,
                background: "rgba(0,0,0,.25)",
                border: "1px solid rgba(255,255,255,.18)",
                color: style.fg,
                whiteSpace: "nowrap",
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "right", minWidth: 160 }}>
        <div style={{ fontSize: 10, fontWeight: 1000, color: style.fg, opacity: 0.9 }}>
          NEXT
        </div>
        <div style={{ fontSize: 11, fontWeight: 900, color: style.fg, opacity: 0.95 }}>
          {next[0] || "—"}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Engine Stack (right column) -------------------- */
function EngineStack({ confluence, permission, engine2Card }) {
  const loc = confluence?.location?.state || "—";

  // ✅ E2 (Wave Phase from dashboard-snapshot node.engine2)
  let e2Text = "NO_ANCHORS";
  let e2Color = "#cbd5e1";

  if (engine2Card && engine2Card.ok === true) {
    const degree = engine2Card.degree || "—";
    const tf = engine2Card.tf || "—";
    const phase = engine2Card.phase || "UNKNOWN";
    const fibScore = Number(engine2Card.fibScore || 0);
    const invalidated = engine2Card.invalidated === true;

    e2Text = `${degree} ${tf} — ${phase} — Fib ${fibScore}/20 — inv:${invalidated ? "true" : "false"}`;

    if (invalidated) e2Color = "#fca5a5";
    else if (fibScore >= 20) e2Color = "#86efac";
    else if (fibScore >= 10) e2Color = "#fbbf24";
    else e2Color = "#cbd5e1";
  }

  // ---------------- E3 (C-level breakdown) ----------------
  const r = confluence?.context?.reaction || {};
  const stage = String(r.stage || "—").toUpperCase();
  const armed = r.armed === true;
  const rs = Number(r.reactionScore ?? 0);
  const ss = String(r.structureState || "HOLD").toUpperCase();
  const stageIcon = stageToIcon(stage, ss, armed);
  const stageColor = stageToColor(stage, ss);

  // prefer new diagnostics fields if present
  const e3Pos = r.zonePosition ? String(r.zonePosition) : e3FallbackPosition(r.reasonCodes);
  const rejYesNo =
    r.rejectionCandidate === true ? "REJECTION: YES"
    : r.rejectionCandidate === false ? "REJECTION: no"
    : "REJECTION: —";

  const nextDown = r.nextConfirmDown ? shortNextText(r.nextConfirmDown) : null;
  const nextUp = r.nextConfirmUp ? shortNextText(r.nextConfirmUp) : null;
  const nextTxt = (nextDown || nextUp) ? `Next: ${nextDown || nextUp}` : e3FallbackNext(stage);

  const e3Text =
    `${stageIcon} ${stage}${armed && stage !== "FAILURE" ? " ⚡" : ""}` +
    ` • ${Number.isFinite(rs) ? rs.toFixed(1) : "0.0"} ${ss}` +
    ` • POS:${e3Pos}` +
    ` • ${rejYesNo}` +
    ` • ${nextTxt}`;

  // ---------------- E4 (C-level breakdown) ----------------
  const v = confluence?.context?.volume || {};
  const vf = v?.flags || {};
  const e4State = String(confluence?.volumeState || v?.state || "NO_SIGNAL").toUpperCase();
  const vs = Number(v.volumeScore ?? 0);

  const regime = volRegimeFromScore(vs, vf);
  const pressure = volPressureFromFlags(vf);

  const flow =
    `PB:${vf.pullbackContraction ? "✅" : "—"} ` +
    `REV:${vf.reversalExpansion ? "✅" : "—"} ` +
    `INIT:${vf.initiativeMoveConfirmed ? "✅" : "—"} ` +
    `DIST:${vf.distributionDetected ? "⚠️" : "—"} ` +
    `ABS:${vf.absorptionDetected ? "⚠️" : "—"} ` +
    `TRAP:${vf.liquidityTrap ? "❌" : "—"} ` +
    `DIV:${vf.volumeDivergence ? "⚠️" : "—"}`;

  const e4Text =
    `${e4State}` +
    ` • VS:${Number.isFinite(vs) ? vs : "—"}/15` +
    ` • REG:${regime}` +
    ` • PRESS:${pressure}` +
    ` • ${flow}`;

  // E5
  const score = clamp100(confluence?.scores?.total ?? 0);
  const label = confluence?.scores?.label || grade(score);
  const comp = confluence?.compression || {};
  const compState = String(comp?.state || "NONE").toUpperCase();
  const compScore = Number.isFinite(Number(comp?.score)) ? Math.round(Number(comp?.score)) : 0;
  const e5Text = `${Math.round(score)} (${label}) • ${compState} ${compScore}`;

  // E6
  const perm = permission?.permission || "—";
  const mult = Number.isFinite(Number(permission?.sizeMultiplier))
    ? Number(permission.sizeMultiplier).toFixed(2)
    : "—";
  const e6Text = `${perm} • ${mult}x`;

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 12,
        padding: 12,
        background: "#0b0b0b",
        minHeight: 260,
        width: "100%",
        height: "auto",
        display: "grid",
        gridTemplateRows: "auto repeat(6, 1fr)",
        gap: 10,
        overflow: "visible",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "#93c5fd" }}>ENGINE STACK</div>

      <StackRow k="E1" v={loc} />
      <StackRow k="E2" v={e2Text} vStyle={{ color: e2Color }} />
      <StackRow k="E3" v={e3Text} vStyle={{ color: stageColor }} />
      <StackRow k="E4" v={e4Text} />
      <StackRow k="E5" v={e5Text} />
      <StackRow k="E6" v={e6Text} />
    </div>
  );
}

function StackRow({ k, v, vStyle = {} }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "22px 1fr",
        gap: 6,
        alignItems: "center",
        minWidth: 0,
      }}
    >
      <span style={{ fontWeight: 1000, fontSize: 13, color: "#9ca3af" }}>{k}</span>
      <span
        style={{
          fontWeight: 1000,
          fontSize: 13,
          whiteSpace: "normal",
          overflow: "visible",
          textOverflow: "ellipsis",
          color: "#e5e7eb",
          ...vStyle,
        }}
        title={v}
      >
        {v}
      </span>
    </div>
  );
}

/* ===================== Main Component ===================== */
export default function RowStrategies() {
  const { setSelection } = useSelection();

  const STRATS = useMemo(
    () => [
      { id: "SCALP", name: "Scalp — Minor Intraday", tf: "10m", sub: "10m primary • 1h gate" },
      { id: "MINOR", name: "Minor — Swing", tf: "1h", sub: "1h primary • 4h confirm" },
      { id: "INTERMEDIATE", name: "Intermediate — Long", tf: "4h", sub: "4h primary • EOD gate" },
    ],
    []
  );

  const STRATEGY_ID_MAP = {
    SCALP: "intraday_scalp@10m",
    MINOR: "minor_swing@1h",
    INTERMEDIATE: "intermediate_long@4h",
  };

  const [active, setActive] = useState("SCALP");

  // ✅ Shared polling truth (single source across pages)
  const { data: snapshot, err, lastFetch } = useDashboardSnapshot("SPY", {
    pollMs: POLL_MS,
    timeoutMs: TIMEOUT_MS,
    includeContext: 1,
  });

  // ✅ Scalp GO state (read-only)
  const [scalpStatus, setScalpStatus] = useState({ data: null, err: null, last: null });

  useEffect(() => {
    let alive = true;
    let timer = null;
    let inFlight = false;

    const schedule = (ms) => {
      if (!alive) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(pull, ms);
    };

    async function pull() {
      if (!alive) return;
      if (inFlight) {
        schedule(GO_POLL_MS);
        return;
      }
      inFlight = true;

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), GO_TIMEOUT_MS);

      try {
        const j = await safeFetchGo(SCALP_STATUS_URL(), { signal: controller.signal });
        if (alive) setScalpStatus({ data: j, err: null, last: nowIso() });
      } catch (e) {
        if (alive)
          setScalpStatus((prev) => ({
            ...prev,
            err: String(e?.message || e),
            last: nowIso(),
          }));
      } finally {
        clearTimeout(t);
        inFlight = false;
        schedule(GO_POLL_MS);
      }
    }

    pull();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // kept for compatibility (even if unused right now)
  function load(sym, tf) {
    setSelection({ symbol: sym, timeframe: tf, strategy: "smz" });
  }

  const scalpGo = scalpStatus?.data?.go || null;

  return (
    <section id="row-5" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Strategies — Engine 5 Score + Engine 6 Permission</div>

        <div style={{ marginLeft: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STRATS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                background: active === s.id ? "#1f2937" : "#0b0b0b",
                color: "#e5e7eb",
                border: active === s.id ? "1px solid #3b82f6" : "1px solid #2b2b2b",
                boxShadow: active === s.id ? "0 0 0 1px #3b82f6 inset" : "none",
                borderRadius: 10,
                padding: "6px 10px",
                fontWeight: 1000,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {s.id}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <div style={{ color: "#9ca3af", fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>
            Poll: <b>{Math.round(POLL_MS / 1000)}s</b>
          </span>
          <span>
            Frontend fetch: <b style={{ marginLeft: 4 }}>{lastFetch ? toAZ(lastFetch, true) : "—"}</b>
          </span>
          <span>
            Backend snapshot: <b style={{ marginLeft: 4 }}>{snapshotTime(snapshot)}</b>
          </span>
          <span>
            Build: <b style={{ marginLeft: 4 }}>{toAZ(BUILD_STAMP, true)}</b>
          </span>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 8, color: "#fca5a5", fontWeight: 1000 }}>
          Strategy snapshot error: {err}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 10,
          marginTop: 10,
        }}
      >
        {STRATS.map((s) => {
          const stratKey = STRATEGY_ID_MAP[s.id];

          // dashboard-snapshot shape (current)
          const node = snapshot?.strategies?.[stratKey] || null;
          const confluence = node?.confluence || null;
          const permission = node?.permission || null;

          // Engine 15 preferred source (Replay snapshots or future live snapshots)
          const engine15Stored =
            node?.engine15 ||
            snapshot?.engine15?.byStrategy?.[stratKey] ||
            null;

          const readinessPack =
            engine15Stored && engine15Stored.readiness
              ? engine15Stored
              : computeReadinessFallback({ confluence, permissionObj: permission || null });

          const fresh = minutesAgo(lastFetch) <= 1.5;
          const liveStatus = err ? "red" : fresh ? "green" : "yellow";
          const liveTip = err ? `Error: ${err}` : `Last snapshot: ${lastFetch ? toAZ(lastFetch, true) : "—"}`;

          const score = clamp100(confluence?.scores?.total ?? 0);
          const label = confluence?.scores?.label || grade(score);
          const golden = showGoldenCoil(confluence);

          // keep these (not shown yet in UI) so other teammates don't break later
          const _reasonsE5 = top3(confluence?.reasonCodes || []);
          const _reasonsE6 = top3(permission?.reasonCodes || []);

          const zone = extractActiveZone(confluence);
          const targets = extractTargets(confluence);
          const compression = extractCompression(confluence);
          const volume = extractVolume(confluence);

          const entryTxt = Number.isFinite(targets.entryTarget) ? fmt2(targets.entryTarget) : "—";
          let exitTxt = "—";
          if (Number.isFinite(targets.exitTarget)) {
            exitTxt = fmt2(targets.exitTarget);
          } else {
            const hi = Number.isFinite(targets.exitTargetHi) ? `Hi ${fmt2(targets.exitTargetHi)}` : null;
            const lo = Number.isFinite(targets.exitTargetLo) ? `Lo ${fmt2(targets.exitTargetLo)}` : null;
            exitTxt = [hi, lo].filter(Boolean).join(" • ") || "—";
          }

          const perm = permission?.permission || "—";

          const activeGlow =
            active === s.id
              ? "0 0 0 2px rgba(59,130,246,.65) inset, 0 10px 30px rgba(0,0,0,.25)"
              : "0 10px 30px rgba(0,0,0,.25)";

          // ✅ Only SCALP shows intrabar GO right now
          const showGoHere = s.id === "SCALP";

          return (
            <div
              key={s.id}
              style={{
                background: "#101010",
                border: "1px solid #262626",
                borderRadius: 12,
                padding: 10,
                color: "#e5e7eb",
                boxShadow: activeGlow,
                minHeight: 360,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* ✅ BIG readiness bar at top of each card */}
              <ReadinessBar readinessPack={readinessPack} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 10, alignItems: "start" }}>
                {/* LEFT */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 1000, fontSize: 14, lineHeight: "16px" }}>{s.name}</div>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 1000,
                            padding: "4px 10px",
                            borderRadius: 999,
                            whiteSpace: "nowrap",
                            ...permStyle(perm),
                          }}
                        >
                          {permLabel(perm)}
                        </span>

                        {golden && (
                          <span
                            style={{
                              background: "linear-gradient(135deg,#ffb703,#ff8800)",
                              color: "#1a1a1a",
                              fontWeight: 1000,
                              padding: "4px 10px",
                              borderRadius: 8,
                              boxShadow: "0 0 10px rgba(255,183,3,.55)",
                              border: "1px solid rgba(255,255,255,.18)",
                            }}
                          >
                            🔥 GOLDEN COIL
                          </span>
                        )}

                        {/* ✅ BIG GO next to Golden Coil */}
                        {showGoHere && <GoPillBig go={scalpGo} />}
                      </div>

                      <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 800 }}>{s.sub}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <LiveDot status={liveStatus} tip={liveTip} />
                    </div>
                  </div>

                  {/* Score */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px 1fr 40px",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <div style={{ color: "#9ca3af", fontSize: 10, fontWeight: 1000 }}>Score</div>
                    <div
                      style={{
                        background: "#1f2937",
                        borderRadius: 8,
                        height: 8,
                        overflow: "hidden",
                        border: "1px solid #334155",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(0, Math.min(100, Math.round(score)))}%`,
                          background:
                            "linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)",
                        }}
                      />
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 1000, fontSize: 12 }}>{Math.round(score)}</div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: "#cbd5e1" }}>
                    <div>
                      <span style={{ color: "#9ca3af", fontWeight: 900 }}>Label:</span> {label || "—"}{" "}
                      <span style={{ color: "#9ca3af" }}>(A+≥90 A≥80 B≥70 C≥60)</span>
                    </div>
                    <div>
                      <span style={{ color: "#9ca3af", fontWeight: 900 }}>TF:</span> {s.tf}
                    </div>
                  </div>

                  {/* Targets */}
                  <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                      <b>Entry Target:</b> {entryTxt}
                    </div>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                      <b>Exit Target:</b> {exitTxt}
                    </div>
                  </div>

                  {/* Active Zone + Compression + Volume */}
                  <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                      <b>Active Zone:</b>{" "}
                      {zone?.zoneType ? (
                        <>
                          <span style={{ color: "#fbbf24", fontWeight: 1000 }}>{zone.zoneType}</span>{" "}
                          <span style={{ color: "#94a3b8" }}>
                            {Number.isFinite(zone.lo) ? fmt2(zone.lo) : "—"}–{Number.isFinite(zone.hi) ? fmt2(zone.hi) : "—"}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>

                    <MiniRow
                      label="Compression"
                      left={`${compression.active ? "ACTIVE" : "OFF"} • ${compression.tier} • ${compression.state}`}
                      right={`score ${Number.isFinite(compression.score) ? Math.round(compression.score) : "—"} • ATR ratio ${
                        Number.isFinite(compression.widthAtrRatio) ? compression.widthAtrRatio.toFixed(2) : "—"
                      }`}
                      tone={compression.active ? "warn" : "muted"}
                    />

                    <MiniRow
                      label="Volume"
                      left={`${volume.state || "—"} • score ${Number.isFinite(volume.volumeScore) ? Math.round(volume.volumeScore) : "—"}`}
                      right={`${volume.volumeConfirmed ? "CONFIRMED" : "unconfirmed"}`}
                      tone={volume.volumeConfirmed ? "ok" : "muted"}
                    />
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", fontWeight: 900 }}>
                    {nextTriggerText(confluence)}
                  </div>
                </div>

                {/* RIGHT */}
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  <EngineStack confluence={confluence} permission={permission} engine2Card={node?.engine2 || null} />

                  {/* Strategy Snapshot Card */}
                  <div
                    style={{
                      border: "1px solid #1f2937",
                      borderRadius: 12,
                      padding: 12,
                      background: "#0b0b0b",
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 1000, color: "#93c5fd", fontSize: 11 }}>STRATEGY SNAPSHOT</div>
                    <div><b>Wave Phase:</b> {node?.engine2?.phase || "—"}</div>
                    <div><b>Fib Score:</b> {Number.isFinite(node?.engine2?.fibScore) ? `${node.engine2.fibScore}/20` : "—"}</div>
                    <div><b>Invalidated:</b> {node?.engine2?.invalidated ? "YES ❌" : "NO"}</div>
                    <div><b>Degree:</b> {node?.engine2?.degree || "—"} {node?.engine2?.tf || ""}</div>
                  </div>
                </div>
              </div>

              {/* ACTIONS — MINIMAL */}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span
                  style={{
                    background: "#0b1220",
                    border: "1px solid #1f2937",
                    color: "#93c5fd",
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 1000,
                  }}
                >
                  PAPER ONLY
                </span>

                <button
                  onClick={() => openFullStrategies("SPY")}
                  style={btn()}
                  title="Open all strategies in a large readable view"
                >
                  Open Full Strategies
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
