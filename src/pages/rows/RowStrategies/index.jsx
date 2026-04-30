// src/pages/rows/RowStrategies/index.jsx
// Row 5 — Strategies (compact decision interface)
// PART 1 OF 2

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
  micro: 13,
  tiny: 14,
  small: 15,
  body: 16,
  section: 13,
  subtitle: 14,
  title: 18,
  button: 14,
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
    padding: "7px 11px",
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

function CompactSection({ title, children, subtle = false }) {
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
        gridTemplateColumns: "102px 1fr",
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
// PART 2 OF 2

function TwoCol({ left, right, wideLeft = true }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: wideLeft ? "1.3fr 0.7fr" : "1fr 1fr",
        gap: 8,
        alignItems: "start",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          borderRight: "1px solid #1f2937",
          paddingRight: 8,
        }}
      >
        {left}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {right}
      </div>
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

function getWaveMode(engine16) {
  const waveState = upper(engine16?.waveState || engine16?.waveContext?.waveState || "", "");
  if (waveState.includes("CORRECTION") || waveState.includes("C")) return "CORRECTIVE";
  if (waveState.includes("IMPULSE") || waveState.includes("W3")) return "IMPULSE";
  return "STRUCTURE";
}

function LifecycleStrip({ node }) {
  const lc = getLifecycle(node);

  return (
    <CompactSection title="POSITION STATUS" subtle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 6,
        }}
      >
        <KV label="TP1" value={<Badge text={lc.tp1Open ? "OPEN" : "OFF"} tone={yesNoTone(lc.tp1Open)} />} />
        <KV label="TP2" value={<Badge text={lc.tp2Open ? "OPEN" : "OFF"} tone={yesNoTone(lc.tp2Open)} />} />
        <KV label="Runner" value={<Badge text={lc.runnerOn ? "ON" : "OFF"} tone={yesNoTone(lc.runnerOn)} />} />
        <KV label="State" value={prettyEnum(lc.state)} />

        <KV label="Signal" value={lc.signalPrice == null ? "0.00" : fmt2(lc.signalPrice)} />
        <KV label="Current" value={lc.currentPrice == null ? "0.00" : fmt2(lc.currentPrice)} />
        <KV label="Remain" value={pct(lc.remainingPct)} />
        <KV label="Next" value={prettyEnum(lc.nextFocus)} />

        <KV label="Progress" value={pct(lc.progressPct)} />
        <KV label="Move" value={lc.movePts == null ? "—" : fmt2(lc.movePts)} />
      </div>
    </CompactSection>
  );
}

function TriggerStateFull({ engine16 }) {
  return (
    <CompactSection title="TRIGGER STATE" subtle>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 900, color: "#fca5a5" }}>SHORT</div>
        <CompactBool label="Watch Prep" value={engine16?.waveShortPrep === true} />
        <CompactBool label="Continuation" value={engine16?.continuationTriggerShort === true} />
        <CompactBool label="Exhaustion" value={engine16?.exhaustionTriggerShort === true} />

        <div style={{ fontWeight: 900, color: "#86efac", marginTop: 4 }}>LONG</div>
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
      left={
        <CompactSection title="NOT READY BECAUSE" subtle>
          {reasons.length ? (
            reasons.map((r, i) => (
              <div
                key={`${r}-${i}`}
                style={{ fontWeight: 600, color: "#9ca3af", fontSize: FS.small, lineHeight: 1.2 }}
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
          <KV label="Market" value={marketLine(snapshot)} />
          <KV label="Summary" value={summary} />
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
          gap: 6,
        }}
      >
        <KV label="Context" value={prettyEnum(context)} />
        <KV label="State" value={prettyEnum(state)} />
        <KV label="Phase" value={prettyEnum(phase)} />
        <KV label="Macro Bias" value={prettyEnum(macroBias)} />
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
          gap: 6,
        }}
      >
        <KV label="Primary" value={prettyEnum(primaryPhase)} />
        <KV label="Intermed." value={prettyEnum(intermediatePhase)} />
        <KV label="Phase" value={prettyEnum(phase)} />
        <KV label="Macro Bias" value={prettyEnum(macroBias)} />
      </div>
    </CompactSection>
  );
}

function ScalpCompactCard({ 
  node, 
  snapshot, 
  liveStatus, 
  liveTip, 
  activeGlow,
  title = "Scalp",
  timeframe = "10m",
  summaryOverride,
}) {
  const engine16 = node?.engine16 || {};
  const engine22 = node?.engine22Scalp || null;
  const permission = node?.permission || {};

  const readiness = getReadiness(node);
  const action = getAction(node);
  const bias = getBias(node);
  const nextFocus = getLifecycle(node).nextFocus;
  const executionBias = getExecutionBias(node);
  const freshEntry = getFreshEntry(node);
  const permissionText = upper(permission?.permission || "UNKNOWN");
  const summary = summaryOverride || scalpSummary(node);
  
  return (
    <div
      style={{
        background: "#101010",
        border: "1px solid #262626",
        borderRadius: 14,
        padding: 7,
        color: "#e5e7eb",
        boxShadow: activeGlow,
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <TopReadinessBar readiness={readiness} bias={bias} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.title }}>{title}</div>
          <div style={{ color: "#9ca3af", fontSize: FS.subtitle, fontWeight: 800 }}>{timeframe}</div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Badge text={upper(readiness)} tone={readinessTone(readiness)} large />
          <Badge text={upper(action)} tone={actionTone(action)} />
          <Badge text={bias} tone={biasTone(bias)} />
          <LiveDot status={liveStatus} tip={liveTip} />
        </div>
      </div>

      <LifecycleStrip node={node} />
      <StructureCoreScalp engine16={engine16} />

      <TwoCol
        left={
          <CompactSection title="DECISION" subtle>
            <KV label="Next Focus" value={prettyEnum(nextFocus)} />
            <KV label="Trigger" value={prettyEnum(scalpTriggerCondition(engine16))} />
            <KV
              label="Fresh Entry"
              value={<Badge text={freshEntry ? "YES" : "NO"} tone={yesNoTone(freshEntry)} />}
            />
            <KV label="Exec Bias" value={prettyEnum(executionBias)} />
            <KV
              label="Permission"
              value={<Badge text={permissionText} tone={permissionTone(permissionText)} />}
            />
          </CompactSection>
        }
        right={<TriggerStateFull engine16={engine16} />}
      />
      {engine22 && (
        <CompactSection title="FAST SCALP SIGNAL">

          {/* 🔥 MAIN SIGNAL LINE (BIG) */}
          <div
            style={{
            fontWeight: 1000,
            fontSize: 16,
            color: "#60a5fa",
            marginBottom: 4,
          }}
        >
          {engine22.status === "ENTRY_LONG" && "ENTRY LONG — EXHAUSTION BOUNCE"}
          {engine22.status === "PROBE_LONG" && "PROBE LONG — FORMING"}
          {engine22.status === "NO_SCALP" && "NO SCALP OPPORTUNITY"}
        </div>

        {/* 📊 SUPPORTING DATA */}
        <KV
          label="Confidence"
          value={
            engine22.confidence != null
              ? `${engine22.confidence}%`
              : "—"
         }
       />

       <KV
         label="Target"
         value={
           engine22.targetMove != null
             ? `$${engine22.targetMove}`
             : "—"
        }
      />

      <KV
        label="Mode"
        value={engine22.mode || "—"}
     />

     {/* ⚠️ CONTEXT WARNING */}
     {engine22.reasonCodes?.includes("SCALP_ONLY_COUNTERTREND") && (
       <div
         style={{
           marginTop: 6,
           fontSize: 12,
           fontWeight: 900,
           color: "#f59e0b",
         }}
       >
         ⚠️ COUNTERTREND SCALP
       </div>
     )}

   </CompactSection>
 )}
      <NotReadySummaryBlock node={node} snapshot={snapshot} summary={summary} />
    </div>
  );
}

function IntermediateCompactCard({ node, snapshot, activeGlow }) {
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
    <div
      style={{
        background: "#0f1117",
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 7,
        color: "#e5e7eb",
        boxShadow: activeGlow,
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <TopReadinessBar readiness={readiness} bias={bias} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.title }}>Intermediate Swing</div>
          <div style={{ color: "#9ca3af", fontSize: FS.subtitle, fontWeight: 800 }}>1h</div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge text={upper(readiness)} tone={readinessTone(readiness)} />
          <Badge text={upper(action)} tone={actionTone(action)} />
          <Badge text={bias} tone={biasTone(bias)} />
        </div>
      </div>

      <LifecycleStrip node={node} />
      <StructureCoreIntermediate engine16={engine16} />

      <CompactSection title="DECISION" subtle>
        <KV label="Next Focus" value={prettyEnum(nextFocus)} />
        <KV label="Trigger" value={prettyEnum(intermediateTriggerCondition(engine16, readiness))} />
        <KV
          label="Fresh Entry"
          value={<Badge text={getFreshEntry(node) ? "YES" : "NO"} tone={yesNoTone(getFreshEntry(node))} />}
        />
        <KV label="Exec Bias" value={prettyEnum(getExecutionBias(node))} />
        <KV
          label="Permission"
          value={<Badge text={permissionText} tone={permissionTone(permissionText)} />}
        />
      </CompactSection>

      <CompactSection title="STRUCTURE STATUS" subtle>
        <KV
          label="Wave Prep"
          value={<Badge text={engine16?.wavePrep === true ? "YES" : "NO"} tone={yesNoTone(engine16?.wavePrep === true)} />}
        />
        <KV label="Correction Dir." value={prettyEnum(engine16?.correctionDirection || "—")} />
        <KV label="Wave Mode" value={prettyEnum(waveMode)} />
        <KV label="Execution Eng." value={prettyEnum(executionEngine)} />
      </CompactSection>

      <NotReadySummaryBlock node={node} snapshot={snapshot} summary={summary} />
    </div>
  );
}

function PassiveMiniCard({ node, snapshot }) {
  const readiness = getReadiness(node);
  const action = getAction(node);
  const bias = getBias(node);
  const nextFocus = getLifecycle(node).nextFocus;

  return (
    <div
      style={{
        background: "#0d1016",
        border: "1px solid #1c2533",
        borderRadius: 14,
        padding: 7,
        color: "#e5e7eb",
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <TopReadinessBar readiness={readiness} bias={bias} />

      <div style={{ fontWeight: 1000, fontSize: FS.title }}>Longer-Term</div>
      <div style={{ color: "#9ca3af", fontSize: FS.subtitle, fontWeight: 800 }}>4h</div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Badge text={upper(readiness)} tone={readinessTone(readiness)} />
        <Badge text={upper(action)} tone={actionTone(action)} />
        <Badge text={bias} tone={biasTone(bias)} />
      </div>

      <CompactSection title="PASSIVE" subtle>
        <KV label="Next Focus" value={prettyEnum(nextFocus)} />
        <KV label="Market" value={marketLine(snapshot)} />
      </CompactSection>
    </div>
  );
}

export default function RowStrategies() {
  const STRATS = useMemo(
    () => [{ id: "SCALP" }, { id: "MINOR" }, { id: "INTERMEDIATE" }],
    []
  );

  const [active, setActive] = useState("SCALP");

  const {
    data: snapshot,
    err,
    lastFetch,
    refreshing,
    hasData,
  } = useDashboardSnapshot("SPY", {
    pollMs: POLL_MS,
    timeoutMs: TIMEOUT_MS,
    includeContext: 1,
  });

  const fresh = minutesAgo(lastFetch) <= 1.5;
  const liveStatus = err ? "red" : fresh ? "green" : "yellow";
  const liveTip = err
    ? `Error: ${err}`
    : `Last snapshot: ${lastFetch ? toAZ(lastFetch, true) : "—"}`;

  return (
    <section id="row-5" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title" style={{ fontSize: 16, fontWeight: 1000 }}>
          Strategies — Decision Interface
        </div>

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
                fontSize: FS.micro,
                cursor: "pointer",
              }}
            >
              {s.id}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <div
          style={{
            color: "#9ca3af",
            fontSize: FS.tiny,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span>
            Poll: <b>{Math.round(POLL_MS / 1000)}s</b>
          </span>
          <span>
            Frontend fetch: <b style={{ marginLeft: 4 }}>{lastFetch ? toAZ(lastFetch, true) : "—"}</b>
            {refreshing ? (
              <span style={{ marginLeft: 6, color: "#fbbf24", fontWeight: 1000 }}>
                refreshing…
              </span>
            ) : null}
          </span>
          <span>
            Backend snapshot: <b style={{ marginLeft: 4 }}>{snapshotTime(snapshot)}</b>
          </span>
          <span>
            Build: <b style={{ marginLeft: 4 }}>{toAZ(BUILD_STAMP, true)}</b>
          </span>
          <button
            onClick={() => openFullStrategies("SPY")}
            style={btn()}
            title="Open full strategies in a new window"
          >
            Open Full Strategies
          </button>
        </div>
      </div>

      {err && !hasData && (
        <div style={{ marginTop: 8, color: "#fca5a5", fontWeight: 1000, fontSize: FS.small }}>
          Strategy snapshot error: {err}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 8,
          marginTop: 10,
          alignItems: "stretch",
        }}
      >
        {STRATS.map((s) => {
          const stratKey = STRATEGY_ID_MAP[s.id];
          const node = snapshot?.strategies?.[stratKey] || null;

          const activeGlow =
            active === s.id
              ? "0 0 0 2px rgba(59,130,246,.45) inset, 0 8px 24px rgba(0,0,0,.22)"
              : "0 8px 24px rgba(0,0,0,.18)";

          if (s.id === "SCALP") {
            return (
              <ScalpCompactCard
                key={s.id}
                node={node}
                snapshot={snapshot}
                liveStatus={liveStatus}
                liveTip={liveTip}
                activeGlow={activeGlow}
              />
            );
          }

         if (s.id === "MINOR") {
           return (
            <ScalpCompactCard
              key={s.id}
              node={node}
              snapshot={snapshot}
              liveStatus={liveStatus}
              liveTip={liveTip}
              activeGlow={activeGlow}
              title="Intermediate Swing"
              timeframe="1h"
              summaryOverride={intermediateSummary(node)}
            />
          );
         }

          return <PassiveMiniCard key={s.id} node={node} snapshot={snapshot} />;
        })}
      </div>
    </section>
  );
}
