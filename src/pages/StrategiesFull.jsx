// src/pages/StrategiesFull.jsx
// Full strategies page
// PART 1 OF 2

import React, { useMemo, useState } from "react";
import { useDashboardSnapshot } from "../hooks/useDashboardSnapshot";

/* -------------------- constants -------------------- */
const AZ_TZ = "America/Phoenix";
const POLL_MS = 20000;
const TIMEOUT_MS = 20000;

const FS = {
  micro: 13,
  tiny: 14,
  small: 15,
  body: 16,
  section: 13,
  subtitle: 14,
  title: 22,
  button: 14,
};

const STRATEGY_ID_MAP = {
  SCALP: "intraday_scalp@10m",
  MINOR: "minor_swing@1h",
  INTERMEDIATE: "intermediate_long@4h",
};

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

function fmt2(x) {
  return Number.isFinite(Number(x)) ? Number(x).toFixed(2) : "—";
}

function pct(x) {
  return Number.isFinite(Number(x)) ? `${Math.round(Number(x))}%` : "—";
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

function marketLine(snapshot) {
  const regime = upper(snapshot?.marketRegime?.regime || "—");
  const directionBias = upper(snapshot?.marketRegime?.directionBias || "—");
  return `${regime} / ${directionBias}`;
}

function openFullChart(symbol = "SPY", tf = "10m") {
  const url = `/chart?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function btn() {
  return {
    background: "#141414",
    color: "#e5e7eb",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "8px 12px",
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
    tp1Open: lifecycle?.tp1Open === true,
    tp2Open: lifecycle?.tp2Open === true,
    runnerOn: lifecycle?.runnerOn === true,
    signalPrice: Number.isFinite(Number(lifecycle?.signalPrice))
      ? Number(lifecycle.signalPrice)
      : null,
    currentPrice: Number.isFinite(Number(lifecycle?.currentPrice))
      ? Number(lifecycle.currentPrice)
      : null,
    progressPct: Number.isFinite(Number(lifecycle?.progressPct))
      ? Number(lifecycle.progressPct)
      : null,
    remainingPct: Number.isFinite(Number(lifecycle?.remainingPct))
      ? Number(lifecycle.remainingPct)
      : null,
    movePts: Number.isFinite(Number(lifecycle?.movePts))
      ? Number(lifecycle.movePts)
      : null,
    state:
      lifecycle?.state ||
      node?.engine15Decision?.lifecycleState ||
      node?.engine15?.readiness ||
      "WATCH",
    nextFocus: lifecycle?.nextFocus || "WAIT_FOR_TRIGGER",
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

  return out.slice(0, 8);
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
        minHeight: large ? 30 : 24,
        padding: large ? "6px 12px" : "4px 9px",
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
        height: 10,
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

function CardShell({ children, activeGlow, subtle = false }) {
  return (
    <div
      style={{
        background: subtle ? "#0f1117" : "#101010",
        border: subtle ? "1px solid #1f2937" : "1px solid #262626",
        borderRadius: 16,
        padding: 10,
        color: "#e5e7eb",
        boxShadow: activeGlow,
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function CompactSection({ title, children, subtle = false }) {
  return (
    <div
      style={{
        border: subtle ? "1px solid #18212e" : "1px solid #1f2937",
        borderRadius: 14,
        padding: 10,
        background: subtle ? "#0a0f18" : "#0b0b0b",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 1000, color: "#93c5fd", fontSize: FS.section }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value, compact = false }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "100px 1fr" : "120px 1fr",
        gap: 8,
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
        gap: 8,
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

function TwoCol({ left, right, ratio = "1.3fr 0.7fr" }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: ratio,
        gap: 10,
        alignItems: "start",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderRight: "1px solid #1f2937",
          paddingRight: 10,
        }}
      >
        {left}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {right}
      </div>
    </div>
  );
}

/* -------------------- shared logic blocks -------------------- */
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
  if (engine16?.continuationWatchShort === true || engine16?.continuationWatchLong === true) {
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

function longerTermSummary(node) {
  const readiness = getReadiness(node);
  const nextFocus = getLifecycle(node).nextFocus;
  return `Longer-term is ${prettyEnum(readiness).toLowerCase()}. Waiting for ${prettyEnum(
    nextFocus
  ).toLowerCase()}.`;
}

function getWaveMode(engine16) {
  const waveState = upper(engine16?.waveState || engine16?.waveContext?.waveState || "", "");
  if (waveState.includes("CORRECTION") || waveState.includes("C")) return "CORRECTIVE";
  if (waveState.includes("IMPULSE") || waveState.includes("W3")) return "IMPULSE";
  return "STRUCTURE";
}
// PART 2 OF 2

function LifecycleStrip({ node }) {
  const lc = getLifecycle(node);

  return (
    <CompactSection title="POSITION STATUS" subtle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 8,
        }}
      >
        <KV
          label="TP1"
          value={<Badge text={lc.tp1Open ? "OPEN" : "OFF"} tone={yesNoTone(lc.tp1Open)} />}
          compact
        />
        <KV
          label="TP2"
          value={<Badge text={lc.tp2Open ? "OPEN" : "OFF"} tone={yesNoTone(lc.tp2Open)} />}
          compact
        />
        <KV
          label="Runner"
          value={<Badge text={lc.runnerOn ? "ON" : "OFF"} tone={yesNoTone(lc.runnerOn)} />}
          compact
        />
        <KV label="State" value={prettyEnum(lc.state)} compact />

        <KV label="Signal" value={lc.signalPrice == null ? "0.00" : fmt2(lc.signalPrice)} compact />
        <KV label="Current" value={lc.currentPrice == null ? "0.00" : fmt2(lc.currentPrice)} compact />
        <KV label="Remain" value={pct(lc.remainingPct)} compact />
        <KV label="Next" value={prettyEnum(lc.nextFocus)} compact />

        <KV label="Progress" value={pct(lc.progressPct)} compact />
        <KV label="Move" value={lc.movePts == null ? "—" : fmt2(lc.movePts)} compact />
      </div>
    </CompactSection>
  );
}

function TriggerStateFull({ engine16 }) {
  return (
    <CompactSection title="TRIGGER STATE" subtle>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 900, color: "#fca5a5" }}>SHORT</div>
        <CompactBool label="Watch Prep" value={engine16?.waveShortPrep === true} />
        <CompactBool label="Continuation" value={engine16?.continuationTriggerShort === true} />
        <CompactBool label="Exhaustion" value={engine16?.exhaustionTriggerShort === true} />

        <div style={{ fontWeight: 900, color: "#86efac", marginTop: 6 }}>LONG</div>
        <CompactBool label="Watch Prep" value={engine16?.waveLongPrep === true} />
        <CompactBool label="Continuation" value={engine16?.continuationTriggerLong === true} />
        <CompactBool label="Exhaustion" value={engine16?.exhaustionTriggerLong === true} />
      </div>
    </CompactSection>
  );
}

function NotReadySummaryBlock({ node, snapshot, summary }) {
  const reasons = getNotReadyReasons(node);

  return (
    <TwoCol
      ratio="1.1fr 0.9fr"
      left={
        <CompactSection title="NOT READY BECAUSE" subtle>
          {reasons.length ? (
            reasons.map((r, i) => (
              <div
                key={`${r}-${i}`}
                style={{
                  fontWeight: 600,
                  color: "#9ca3af",
                  fontSize: FS.small,
                  lineHeight: 1.25,
                }}
              >
                • {prettyEnum(r)}
              </div>
            ))
          ) : (
            <div style={{ color: "#9ca3af" }}>—</div>
          )}
        </CompactSection>
      }
      right={
        <CompactSection title="SUMMARY" subtle>
          <KV label="Market" value={marketLine(snapshot)} compact />
          <KV label="Summary" value={summary} compact />
        </CompactSection>
      }
    />
  );
}

function StructureCoreScalp({ engine16 }) {
  const context = engine16?.context || "—";
  const state = engine16?.state || "—";
  const phase = engine16?.waveContext?.waveState || engine16?.waveState || "—";
  const macroBias = engine16?.macroBias || "NONE";

  return (
    <CompactSection title="STRUCTURE CORE">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          gap: 8,
        }}
      >
        <KV label="Context" value={prettyEnum(context)} compact />
        <KV label="State" value={prettyEnum(state)} compact />
        <KV label="Phase" value={prettyEnum(phase)} compact />
        <KV label="Macro Bias" value={prettyEnum(macroBias)} compact />
      </div>
    </CompactSection>
  );
}

function StructureCoreIntermediate({ engine16 }) {
  const primaryPhase = engine16?.primaryPhase || "—";
  const intermediatePhase = engine16?.intermediatePhase || "—";
  const phase = engine16?.waveState || "—";
  const macroBias = engine16?.macroBias || "NONE";

  return (
    <CompactSection title="STRUCTURE CORE" subtle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          gap: 8,
        }}
      >
        <KV label="Primary" value={prettyEnum(primaryPhase)} compact />
        <KV label="Intermed." value={prettyEnum(intermediatePhase)} compact />
        <KV label="Phase" value={prettyEnum(phase)} compact />
        <KV label="Macro Bias" value={prettyEnum(macroBias)} compact />
      </div>
    </CompactSection>
  );
}

function StrategyHeader({ title, tf, readiness, action, bias, extraActions = null }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontWeight: 1000, fontSize: FS.title }}>{title}</div>
        <div style={{ color: "#9ca3af", fontSize: FS.subtitle, fontWeight: 800 }}>{tf}</div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Badge text={upper(readiness)} tone={readinessTone(readiness)} large />
        <Badge text={upper(action)} tone={actionTone(action)} />
        <Badge text={bias} tone={biasTone(bias)} />
        {extraActions}
      </div>
    </div>
  );
}

function ScalpFullCard({ node, snapshot, activeGlow, symbol }) {
  const engine16 = node?.engine16 || {};
  const permission = node?.permission || {};

  const readiness = getReadiness(node);
  const action = getAction(node);
  const bias = getBias(node);
  const nextFocus = getLifecycle(node).nextFocus;
  const executionBias = getExecutionBias(node);
  const freshEntry = getFreshEntry(node);
  const permissionText = upper(permission?.permission || "UNKNOWN");
  const summary = scalpSummary(node);

  return (
    <CardShell activeGlow={activeGlow}>
      <TopReadinessBar readiness={readiness} bias={bias} />

      <StrategyHeader
        title="Scalp"
        tf="10m"
        readiness={readiness}
        action={action}
        bias={bias}
        extraActions={
          <button onClick={() => openFullChart(symbol, "10m")} style={btn()}>
            Open Chart
          </button>
        }
      />

      <LifecycleStrip node={node} />
      <StructureCoreScalp engine16={engine16} />

      <TwoCol
        left={
          <CompactSection title="DECISION" subtle>
            <KV label="Next Focus" value={prettyEnum(nextFocus)} compact />
            <KV label="Trigger" value={prettyEnum(scalpTriggerCondition(engine16))} compact />
            <KV
              label="Fresh Entry"
              value={<Badge text={freshEntry ? "YES" : "NO"} tone={yesNoTone(freshEntry)} />}
              compact
            />
            <KV label="Exec Bias" value={prettyEnum(executionBias)} compact />
            <KV
              label="Permission"
              value={<Badge text={permissionText} tone={permissionTone(permissionText)} />}
              compact
            />
          </CompactSection>
        }
        right={<TriggerStateFull engine16={engine16} />}
      />

      <NotReadySummaryBlock node={node} snapshot={snapshot} summary={summary} />
    </CardShell>
  );
}

function IntermediateFullCard({ node, snapshot, activeGlow, symbol }) {
  const engine16 = node?.engine16 || {};
  const permission = node?.permission || {};

  const readiness = getReadiness(node);
  const action = getAction(node);
  const bias = getBias(node);
  const nextFocus = getLifecycle(node).nextFocus;
  const permissionText = upper(permission?.permission || "UNKNOWN");
  const summary = intermediateSummary(node);
  const executionEngine = engine16?.skipped === true ? "STRUCTURE MODE" : "ACTIVE";
  const waveMode = getWaveMode(engine16);

  return (
    <CardShell activeGlow={activeGlow} subtle>
      <TopReadinessBar readiness={readiness} bias={bias} />

      <StrategyHeader
        title="Intermediate Swing"
        tf="1h"
        readiness={readiness}
        action={action}
        bias={bias}
        extraActions={
          <button onClick={() => openFullChart(symbol, "1h")} style={btn()}>
            Open Chart
          </button>
        }
      />

      <LifecycleStrip node={node} />
      <StructureCoreIntermediate engine16={engine16} />

      <CompactSection title="DECISION" subtle>
        <KV label="Next Focus" value={prettyEnum(nextFocus)} compact />
        <KV label="Trigger" value={prettyEnum(intermediateTriggerCondition(engine16, readiness))} compact />
        <KV
          label="Fresh Entry"
          value={<Badge text={getFreshEntry(node) ? "YES" : "NO"} tone={yesNoTone(getFreshEntry(node))} />}
          compact
        />
        <KV label="Exec Bias" value={prettyEnum(getExecutionBias(node))} compact />
        <KV
          label="Permission"
          value={<Badge text={permissionText} tone={permissionTone(permissionText)} />}
          compact
        />
      </CompactSection>

      <CompactSection title="STRUCTURE STATUS" subtle>
        <KV
          label="Wave Prep"
          value={<Badge text={engine16?.wavePrep === true ? "YES" : "NO"} tone={yesNoTone(engine16?.wavePrep === true)} />}
          compact
        />
        <KV label="Correction Dir." value={prettyEnum(engine16?.correctionDirection || "—")} compact />
        <KV label="Wave Mode" value={prettyEnum(waveMode)} compact />
        <KV label="Execution Eng." value={prettyEnum(executionEngine)} compact />
      </CompactSection>

      <NotReadySummaryBlock node={node} snapshot={snapshot} summary={summary} />
    </CardShell>
  );
}

function PassiveMiniCard({ node, snapshot, activeGlow, symbol }) {
  const readiness = getReadiness(node);
  const action = getAction(node);
  const bias = getBias(node);
  const nextFocus = getLifecycle(node).nextFocus;
  const summary = longerTermSummary(node);

  return (
    <CardShell activeGlow={activeGlow} subtle>
      <TopReadinessBar readiness={readiness} bias={bias} />

      <StrategyHeader
        title="Longer-Term"
        tf="4h"
        readiness={readiness}
        action={action}
        bias={bias}
        extraActions={
          <button onClick={() => openFullChart(symbol, "4h")} style={btn()}>
            Open Chart
          </button>
        }
      />

      <CompactSection title="PASSIVE" subtle>
        <KV label="Next Focus" value={prettyEnum(nextFocus)} compact />
        <KV label="Market" value={marketLine(snapshot)} compact />
        <KV label="Summary" value={summary} compact />
      </CompactSection>
    </CardShell>
  );
}

function DiagnosticsPanel({ snapshot }) {
  return (
    <CompactSection title="DIAGNOSTICS" subtle>
      <div
        style={{
          background: "#07111e",
          border: "1px solid #1f2937",
          borderRadius: 12,
          padding: 10,
          overflow: "auto",
          maxHeight: 380,
        }}
      >
        <pre
          style={{
            margin: 0,
            color: "#cbd5e1",
            fontSize: 12,
            lineHeight: 1.35,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </div>
    </CompactSection>
  );
}

export default function StrategiesFull() {
  const qs = useMemo(() => new URLSearchParams(window.location.search), []);
  const symbol = (qs.get("symbol") || "SPY").toUpperCase();

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const {
    data: snapshot,
    err,
    lastFetch,
    refreshNow,
    refreshing,
    hasData,
  } = useDashboardSnapshot(symbol, {
    pollMs: POLL_MS,
    timeoutMs: TIMEOUT_MS,
    includeContext: 1,
  });

  const scalpNode = snapshot?.strategies?.[STRATEGY_ID_MAP.SCALP] || null;
  const minorNode = snapshot?.strategies?.[STRATEGY_ID_MAP.MINOR] || null;
  const longerNode = snapshot?.strategies?.[STRATEGY_ID_MAP.INTERMEDIATE] || null;

  return (
    <div style={{ background: "#05070b", minHeight: "100vh", padding: 14, color: "#e5e7eb" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#05070b",
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: "1px solid #1f2937",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 1000, fontSize: 24 }}>
            Full Strategies — {symbol}
          </div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            Frontend fetch: <b>{lastFetch ? toAZ(lastFetch, true) : "—"}</b>
            {refreshing ? (
              <span style={{ marginLeft: 8, color: "#fbbf24", fontWeight: 1000 }}>
                refreshing…
              </span>
            ) : null}
            <span style={{ marginLeft: 12 }}>
              Backend snapshot: <b>{snapshotTime(snapshot)}</b>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={refreshNow} style={btn()}>
            Refresh
          </button>
          <button onClick={() => setShowDiagnostics((v) => !v)} style={btn()}>
            {showDiagnostics ? "Hide Diagnostics" : "Show Diagnostics"}
          </button>
          <button onClick={() => window.close()} style={btn()}>
            Close Tab
          </button>
        </div>
      </div>

      {err && !hasData && (
        <div style={{ marginBottom: 12, color: "#fca5a5", fontWeight: 1000 }}>
          Strategy snapshot error: {err}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1.1fr 0.7fr",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        <ScalpFullCard
          node={scalpNode}
          snapshot={snapshot}
          activeGlow="0 8px 26px rgba(0,0,0,.22)"
          symbol={symbol}
        />

        <IntermediateFullCard
          node={minorNode}
          snapshot={snapshot}
          activeGlow="0 8px 26px rgba(0,0,0,.22)"
          symbol={symbol}
        />

        <PassiveMiniCard
          node={longerNode}
          snapshot={snapshot}
          activeGlow="0 8px 26px rgba(0,0,0,.18)"
          symbol={symbol}
        />
      </div>

      {showDiagnostics && (
        <div style={{ marginTop: 14 }}>
          <DiagnosticsPanel snapshot={snapshot} />
        </div>
      )}
    </div>
  );
}
