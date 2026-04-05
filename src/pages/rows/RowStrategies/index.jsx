// src/pages/rows/RowStrategies/index.jsx
// Row 5 — Strategies (compact decision interface)
// Backend is source of truth.
// Full strategies page remains separate for now.

import React, { useMemo, useState } from "react";
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

/* -------------------- constants -------------------- */
const AZ_TZ = "America/Phoenix";
const POLL_MS = 20000;
const TIMEOUT_MS = 20000;

const FS = {
  micro: 15,
  tiny: 16,
  small: 17,
  body: 18,
  section: 15,
  subtitle: 16,
  title: 20,
  button: 16,
};

const STRATEGY_ID_MAP = {
  SCALP: "intraday_scalp@10m",
  MINOR: "minor_swing@1h",
  INTERMEDIATE: "intermediate_long@4h",
};

const BUILD_STAMP =
  env("REACT_APP_BUILD_STAMP", "") ||
  env("REACT_APP_COMMIT_SHA", "") ||
  new Date().toISOString();

/* -------------------- helpers -------------------- */
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

function fmt2(x) {
  return Number.isFinite(Number(x)) ? Number(x).toFixed(2) : "—";
}

function upper(x, fb = "—") {
  const s = String(x ?? "").trim();
  return s ? s.toUpperCase() : fb;
}

function prettyEnum(x, fb = "—") {
  const s = upper(x, "");
  if (!s) return fb;
  return s.replaceAll("_", " ");
}

function openFullStrategies(symbol = "SPY") {
  const url = `/strategies-full?symbol=${encodeURIComponent(symbol)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function btn() {
  return {
    background: "#141414",
    color: "#e5e7eb",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "7px 12px",
    fontSize: FS.button,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

/* -------------------- field contracts -------------------- */
function getReadiness(node) {
  return (
    node?.engine15?.readiness ||
    node?.engine15Decision?.readinessLabel ||
    node?.engine16?.readinessLabel ||
    "WAIT"
  );
}

function getAction(node) {
  return node?.engine15Decision?.action || "NO_ACTION";
}

function getBias(node) {
  const direction = upper(node?.engine15Decision?.direction || "", "");
  if (direction.includes("SHORT")) return "SHORT BIAS";
  if (direction.includes("LONG")) return "LONG BIAS";

  const executionBias = upper(node?.engine15Decision?.executionBias || "", "");
  if (executionBias.includes("SHORT")) return "SHORT BIAS";
  if (executionBias.includes("LONG")) return "LONG BIAS";

  const macroBias = upper(node?.engine16?.macroBias || "", "");
  if (macroBias.includes("SHORT")) return "SHORT BIAS";
  if (macroBias.includes("LONG")) return "LONG BIAS";

  if (node?.engine16?.waveShortPrep === true) return "SHORT BIAS";
  if (node?.engine16?.waveLongPrep === true) return "LONG BIAS";

  return "NEUTRAL";
}

function getExecutionBias(node) {
  return (
    node?.engine15Decision?.executionBias ||
    node?.engine15Decision?.direction ||
    node?.engine16?.macroBias ||
    "NONE"
  );
}

function getFreshEntry(node) {
  return node?.engine15Decision?.freshEntryNow ?? false;
}

function getLifecycle(node) {
  const lifecycle = node?.engine15Decision?.lifecycle || {};
  return {
    state:
      lifecycle?.state ||
      node?.engine15Decision?.lifecycleState ||
      node?.engine15?.readiness ||
      "WATCH",
    nextFocus: lifecycle?.nextFocus || "WAIT",
    signalPrice: Number.isFinite(Number(lifecycle?.signalPrice))
      ? Number(lifecycle.signalPrice)
      : null,
    currentPrice: Number.isFinite(Number(lifecycle?.currentPrice))
      ? Number(lifecycle.currentPrice)
      : null,
  };
}

function getNotReadyReasons(node) {
  const primary = Array.isArray(node?.engine15Decision?.reasonCodes)
    ? node.engine15Decision.reasonCodes
    : [];
  const secondary = Array.isArray(node?.permission?.reasonCodes)
    ? node.permission.reasonCodes
    : [];

  const out = [];
  const seen = new Set();

  [...primary, ...secondary].forEach((item) => {
    const key = String(item || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });

  return out.slice(0, 4);
}

/* -------------------- tones -------------------- */
function readinessTone(readiness) {
  const s = upper(readiness, "WAIT");
  if (["CONFIRMED", "TRIGGERED", "READY"].includes(s)) return "ready";
  if (["ARMING", "PREP"].includes(s)) return "arming";
  if (["WATCH"].includes(s)) return "watch";
  if (["STAND_DOWN", "BLOCKED"].includes(s)) return "blocked";
  return "wait";
}

function actionTone(action) {
  const s = upper(action, "NO_ACTION");
  if (["GO", "ENTER_OK", "ACTIVE"].includes(s)) return "ready";
  if (["REDUCE_OK", "MANAGE"].includes(s)) return "arming";
  if (["WATCH"].includes(s)) return "watch";
  if (["BLOCKED"].includes(s)) return "blocked";
  return "wait";
}

function permissionTone(permission) {
  const s = upper(permission, "UNKNOWN");
  if (s === "ALLOW") return "ready";
  if (s === "REDUCE") return "arming";
  if (s === "STAND_DOWN") return "blocked";
  return "wait";
}

function biasTone(text) {
  const s = upper(text, "NEUTRAL");
  if (s.includes("SHORT")) return "short";
  if (s.includes("LONG")) return "long";
  return "neutral";
}

function yesNoTone(v) {
  return v ? "ready" : "wait";
}

function pillPalette(tone) {
  if (tone === "ready") {
    return {
      bg: "linear-gradient(135deg,#22c55e,#16a34a)",
      fg: "#07110a",
      bd: "1px solid rgba(255,255,255,.18)",
    };
  }
  if (tone === "arming") {
    return {
      bg: "linear-gradient(135deg,#fbbf24,#f59e0b)",
      fg: "#0b1220",
      bd: "1px solid rgba(255,255,255,.18)",
    };
  }
  if (tone === "watch") {
    return {
      bg: "linear-gradient(135deg,#60a5fa,#3b82f6)",
      fg: "#071423",
      bd: "1px solid rgba(255,255,255,.18)",
    };
  }
  if (tone === "blocked") {
    return {
      bg: "linear-gradient(135deg,#ef4444,#b91c1c)",
      fg: "#fff7f7",
      bd: "1px solid rgba(255,255,255,.18)",
    };
  }
  if (tone === "short") {
    return {
      bg: "#2b0b0b",
      fg: "#fca5a5",
      bd: "1px solid #7f1d1d",
    };
  }
  if (tone === "long") {
    return {
      bg: "#06220f",
      fg: "#86efac",
      bd: "1px solid #166534",
    };
  }
  return {
    bg: "#111827",
    fg: "#e5e7eb",
    bd: "1px solid #334155",
  };
}

function readinessBarColors(readiness, bias) {
  const readinessMap = {
    ready: "#22c55e",
    arming: "#fbbf24",
    watch: "#3b82f6",
    blocked: "#ef4444",
    wait: "#64748b",
  };

  const biasMap = {
    short: "#ef4444",
    long: "#22c55e",
    neutral: "#64748b",
  };

  return {
    base: readinessMap[readinessTone(readiness)] || "#64748b",
    accent: biasMap[biasTone(bias)] || "#64748b",
  };
}

/* -------------------- UI atoms -------------------- */
function Badge({ text, tone = "wait", large = false, title = "" }) {
  const p = pillPalette(tone);
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: large ? 26 : 22,
        padding: large ? "5px 10px" : "4px 8px",
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        border: p.bd,
        fontSize: large ? FS.tiny : FS.micro,
        fontWeight: 1000,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function TopReadinessBar({ readiness, bias }) {
  const colors = readinessBarColors(readiness, bias);

  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: colors.base,
        position: "relative",
        overflow: "hidden",
        boxShadow: `0 0 12px ${colors.base}66`,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "28%",
          background: colors.accent,
          opacity: 0.75,
        }}
      />
    </div>
  );
}

function CompactSection({ title, children, subtle = false, fill = false }) {
  return (
    <div
      style={{
        border: subtle ? "1px solid #18212e" : "1px solid #1f2937",
        borderRadius: 12,
        padding: 7,
        background: subtle ? "#0a0f18" : "#0b0b0b",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: fill ? "100%" : undefined,
      }}
    >
      <div style={{ fontWeight: 1000, color: "#93c5fd", fontSize: FS.section }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "105px 1fr",
        gap: 6,
        alignItems: "start",
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: FS.micro, fontWeight: 900 }}>
        {label}
      </div>
      <div
        style={{
          color: "#e5e7eb",
          fontSize: FS.small,
          fontWeight: 900,
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CompactBool({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 6,
        alignItems: "center",
      }}
    >
      <div style={{ color: "#cbd5e1", fontSize: FS.small, fontWeight: 800 }}>
        {label}
      </div>
      <Badge text={value ? "YES" : "NO"} tone={yesNoTone(value)} />
    </div>
  );
}

function marketLine(snapshot) {
  const regime = upper(snapshot?.marketRegime?.regime || "—");
  const directionBias = upper(snapshot?.marketRegime?.directionBias || "—");
  return `${regime} / ${directionBias}`;
}

function scalpTriggerCondition(engine16) {
  if (
    engine16?.waveShortPrep === true &&
    engine16?.continuationTriggerShort !== true &&
    engine16?.exhaustionTriggerShort !== true
  ) {
    return "rejection + break";
  }

  if (
    engine16?.waveLongPrep === true &&
    engine16?.continuationTriggerLong !== true &&
    engine16?.exhaustionTriggerLong !== true
  ) {
    return "support hold + break";
  }

  if (engine16?.exhaustionEarlyShort === true || engine16?.exhaustionEarlyLong === true) {
    return "exhaustion confirm";
  }

  if (
    engine16?.continuationWatchShort === true ||
    engine16?.continuationWatchLong === true
  ) {
    return "continuation trigger";
  }

  return "await trigger";
}

function intermediateTriggerCondition(engine16, readiness) {
  if (engine16?.wavePrep === true && upper(engine16?.intermediatePhase, "") === "IN_C") {
    return "C exhaustion + W3 trigger";
  }
  if (upper(readiness, "") === "WAIT") return "wait for structure";
  return "await confirmation";
}

function scalpSummary(node) {
  const readiness = getReadiness(node);
  const bias = getBias(node);
  const nextFocus = getLifecycle(node).nextFocus;

  return `Scalp is ${prettyEnum(readiness).toLowerCase()} with ${bias.toLowerCase()}. Focus: ${prettyEnum(
    nextFocus
  ).toLowerCase()}.`;
}

function intermediateSummary(node) {
  const readiness = getReadiness(node);
  const nextFocus = getLifecycle(node).nextFocus;

  return `Intermediate is ${prettyEnum(readiness).toLowerCase()}. Waiting for ${prettyEnum(
    nextFocus
  ).toLowerCase()}.`;
}

function getWaveMode(engine16) {
  const waveState = upper(engine16?.waveState || engine16?.waveContext?.waveState || "", "");
  if (waveState.includes("CORRECTION") || waveState.includes("C")) return "CORRECTIVE";
  if (waveState.includes("IMPULSE") || waveState.includes("W3")) return "IMPULSE";
  return "STRUCTURE";
}

function LifecycleStrip({ node }) {
  const lc =
