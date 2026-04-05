// src/pages/rows/RowStrategies/index.jsx
// Row 5 — Strategies
// Scalp card rebuilt to new backend architecture (v1)
// Intermediate + Longer-Term kept passive/minimal for safety
// Canonical source: /api/v1/dashboard-snapshot?symbol=SPY
// IMPORTANT: main card truth comes from Engine15 / Engine15Decision / Engine16 normalized fields

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
  micro: 11,
  tiny: 12,
  small: 13,
  body: 14,
  section: 12,
  subtitle: 13,
  title: 16,
  button: 12,
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

function clamp100(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
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

function boolTxt(x) {
  return x === true ? "YES" : "NO";
}

function titleText(id) {
  if (id === "SCALP") return "Scalp";
  if (id === "MINOR") return "Intermediate Swing";
  return "Longer-Term";
}

function tfText(id) {
  if (id === "SCALP") return "10m";
  if (id === "MINOR") return "1h";
  return "4h";
}

function biasBadgeTextScalp(engine16) {
  const shortPrep = engine16?.waveShortPrep === true;
  const longPrep = engine16?.waveLongPrep === true;
  const macroBias = upper(engine16?.waveContext?.macroBias || engine16?.macroBias || "NONE");

  if (shortPrep || macroBias.includes("SHORT")) return "SHORT BIAS";
  if (longPrep || macroBias.includes("LONG")) return "LONG BIAS";
  return "NEUTRAL";
}

function biasBadgeTextIntermediate(engine16) {
  const macroBias = upper(engine16?.macroBias || engine16?.waveContext?.macroBias || "NONE");
  if (macroBias.includes("SHORT")) return "SHORT BIAS";
  if (macroBias.includes("LONG")) return "LONG BIAS";
  return "NEUTRAL";
}

function biasTone(text) {
  const s = upper(text, "NEUTRAL");
  if (s.includes("SHORT")) return "short";
  if (s.includes("LONG")) return "long";
  return "neutral";
}

function readinessTone(readiness) {
  const s = upper(readiness, "WAIT");
  if (["CONFIRMED", "TRIGGERED", "READY"].includes(s)) return "ready";
  if (["ARMING"].includes(s)) return "arming";
  if (["WATCH", "PREP"].includes(s)) return "watch";
  if (["STAND_DOWN", "BLOCKED"].includes(s)) return "blocked";
  return "wait";
}

function actionTone(action) {
  const s = upper(action, "NO_ACTION");
  if (s === "ENTER_OK") return "ready";
  if (s === "REDUCE_OK") return "arming";
  if (s === "WATCH") return "watch";
  if (s === "BLOCKED") return "blocked";
  return "wait";
}

function permissionTone(permission) {
  const s = upper(permission, "UNKNOWN");
  if (s === "ALLOW") return "ready";
  if (s === "REDUCE") return "arming";
  if (s === "STAND_DOWN") return "blocked";
  return "wait";
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

function Badge({ text, tone = "wait", large = false, title = "" }) {
  const p = pillPalette(tone);
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: large ? 30 : 28,
        padding: large ? "7px 12px" : "6px 10px",
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        border: p.bd,
        fontSize: large ? FS.small : FS.tiny,
        fontWeight: 1000,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function Section({ title, children, subtle = false }) {
  return (
    <div
      style={{
        border: subtle ? "1px solid #18212e" : "1px solid #1f2937",
        borderRadius: 12,
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

function KV({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 8,
        alignItems: "start",
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: FS.tiny, fontWeight: 900 }}>
        {label}
      </div>
      <div
        style={{
          color: "#e5e7eb",
          fontSize: FS.small,
          fontWeight: 900,
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniBoolRow({ label, value }) {
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
      <Badge text={boolTxt(value)} tone={value ? "ready" : "wait"} />
    </div>
  );
}

function CompactList({ items = [], empty = "—" }) {
  const arr = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!arr.length) {
    return <div style={{ color: "#94a3b8", fontSize: FS.small }}>{empty}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {arr.map((item, idx) => (
        <div
          key={`${item}-${idx}`}
          style={{
            color: "#e5e7eb",
            fontSize: FS.small,
            fontWeight: 800,
            lineHeight: 1.3,
          }}
        >
          • {prettyEnum(item)}
        </div>
      ))}
    </div>
  );
}

function marketLine(snapshot) {
  const regime = upper(snapshot?.marketRegime?.regime || "—");
  const directionBias = upper(snapshot?.marketRegime?.directionBias || "—");
  return `Market: ${regime} / ${directionBias}`;
}

function scalpTriggerCondition(engine16, decision) {
  if (engine16?.waveShortPrep === true && engine16?.continuationTriggerShort !== true && engine16?.exhaustionTriggerShort !== true) {
    return "rejection + break";
  }
  if (engine16?.exhaustionEarlyShort === true) return "exhaustion confirm";
  if (engine16?.continuationWatchShort === true) return "continuation breakdown";
  return "await trigger";
}

function intermediateTriggerCondition(engine16, readiness) {
  if (engine16?.wavePrep === true && upper(engine16?.intermediatePhase, "") === "IN_C") {
    return "C exhaustion + W3 trigger";
  }
  if (upper(readiness, "") === "WAIT") return "wait for structure";
  return "await confirmation";
}

function scalpSummary(node, snapshot) {
  const e16 = node?.engine16 || {};
  const shortPrep = e16?.waveShortPrep === true;
  if (shortPrep) {
    return "Scalp is watching the active C-leg for a possible short trigger, but no entry is valid yet.";
  }
  return "Scalp is monitoring intraday structure and waiting for a valid trigger sequence.";
}

function intermediateSummary(node, snapshot) {
  return "Intermediate Swing is in prep mode, waiting for the W3 trigger after the C leg completes.";
}

function PassiveCard({ title, tf, node, snapshot }) {
  const readiness =
    node?.engine15?.readiness ||
    node?.engine15Decision?.readinessLabel ||
    node?.engine16?.readinessLabel ||
    "NO_ACTION";

  const action = node?.engine15Decision?.action || "NO_ACTION";
  const bias = biasBadgeTextIntermediate(node?.engine16 || {});
  const nextFocus = node?.engine15Decision?.lifecycle?.nextFocus || "WAIT";
  const summary = "Longer-term structure card kept passive for now.";

  return (
    <div
      style={{
        background: "#0f1117",
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.title, color: "#e5e7eb" }}>
            {title}
          </div>
          <div style={{ color: "#9ca3af", fontSize: FS.subtitle, fontWeight: 800 }}>
            {tf}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge text={upper(readiness)} tone={readinessTone(readiness)} />
          <Badge text={upper(action)} tone={actionTone(action)} />
          <Badge text={bias} tone={biasTone(bias)} />
        </div>
      </div>

      <Section title="PASSIVE SUMMARY" subtle>
        <KV label="Next Focus" value={prettyEnum(nextFocus)} />
        <KV label="Summary" value={summary} />
        <KV label="Market" value={marketLine(snapshot)} />
      </Section>
    </div>
  );
}

/* -------------------- Scalp v1 card -------------------- */
function ScalpV1Card({ node, snapshot, liveStatus, liveTip, activeGlow }) {
  const engine15 = node?.engine15 || {};
  const decision = node?.engine15Decision || {};
  const engine16 = node?.engine16 || {};
  const permission = node?.permission || {};

  const readiness =
    engine15?.readiness ||
    decision?.readinessLabel ||
    engine16?.readinessLabel ||
    "WAIT";

  const action = decision?.action || "NO_ACTION";
  const bias = biasBadgeTextScalp(engine16);

  const nextFocus = decision?.lifecycle?.nextFocus || "WAIT_FOR_TRIGGER";
  const freshEntryNow = decision?.freshEntryNow === true;
  const executionBias = decision?.executionBias || "NONE";

  const qualityBand = decision?.qualityBand || "WATCH";
  const qualityScore = Number.isFinite(Number(decision?.qualityScore))
    ? Number(decision.qualityScore)
    : null;
  const qualityGrade = decision?.qualityGrade || "—";

  const market = marketLine(snapshot);
  const summary = scalpSummary(node, snapshot);

  const reasonCodes = Array.isArray(engine16?.waveReasonCodes)
    ? engine16.waveReasonCodes
    : Array.isArray(decision?.reasonCodes)
    ? decision.reasonCodes
    : [];

  const blockers = Array.isArray(decision?.blockers) ? decision.blockers : [];
  const setupChain = Array.isArray(decision?.setupChain) ? decision.setupChain : [];

  const context = engine16?.context || "—";
  const state = engine16?.state || "—";
  const phase = engine16?.waveContext?.waveState || engine16?.waveState || "—";
  const macroBias = engine16?.waveContext?.macroBias || engine16?.macroBias || "NONE";

  const triggerCondition = scalpTriggerCondition(engine16, decision);

  return (
    <div
      style={{
        background: "#101010",
        border: "1px solid #262626",
        borderRadius: 14,
        padding: 12,
        color: "#e5e7eb",
        boxShadow: activeGlow,
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
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
          <div style={{ fontWeight: 1000, fontSize: FS.title, color: "#e5e7eb" }}>
            Scalp
          </div>
          <div style={{ color: "#9ca3af", fontSize: FS.subtitle, fontWeight: 800 }}>
            10m
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Badge text={upper(readiness)} tone={readinessTone(readiness)} large />
          <Badge text={upper(action)} tone={actionTone(action)} large />
          <Badge text={bias} tone={biasTone(bias)} large />
          <LiveDot status={liveStatus} tip={liveTip} />
        </div>
      </div>

      {/* Structure core */}
      <Section title="STRUCTURE CORE">
        <KV label="Context" value={prettyEnum(context)} />
        <KV label="State" value={prettyEnum(state)} />
        <KV label="Phase" value={prettyEnum(phase)} />
        <KV label="Macro Bias" value={prettyEnum(macroBias)} />
      </Section>

      {/* Decision */}
      <Section title="DECISION">
        <KV label="Next Focus" value={prettyEnum(nextFocus)} />
        <KV label="Trigger Condition" value={prettyEnum(triggerCondition)} />
        <KV label="Fresh Entry Now" value={freshEntryNow ? "YES" : "NO"} />
        <KV label="Permission" value={upper(permission?.permission || "UNKNOWN")} />
        <KV label="Execution Bias" value={prettyEnum(executionBias)} />
      </Section>

      {/* Trigger path */}
      <Section title="TRIGGER PATH" subtle>
        <MiniBoolRow label="Watch Short Prep" value={engine16?.waveShortPrep === true} />
        <MiniBoolRow
          label="Watch Long Prep"
          value={engine16?.waveLongPrep === true}
        />
        <MiniBoolRow
          label="Continuation Watch Short"
          value={engine16?.continuationWatchShort === true}
        />
        <MiniBoolRow
          label="Continuation Trigger Short"
          value={engine16?.continuationTriggerShort === true}
        />
        <MiniBoolRow
          label="Exhaustion Early Short"
          value={engine16?.exhaustionEarlyShort === true}
        />
        <MiniBoolRow
          label="Exhaustion Trigger Short"
          value={engine16?.exhaustionTriggerShort === true}
        />
      </Section>

      {/* Quality */}
      <Section title="QUALITY" subtle>
        <KV label="Band" value={upper(qualityBand)} />
        <KV label="Score" value={qualityScore == null ? "—" : String(Math.round(qualityScore))} />
        <KV label="Grade" value={upper(qualityGrade)} />
      </Section>

      {/* Why */}
      <Section title="WHY THIS STATE">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <div style={{ color: "#9ca3af", fontSize: FS.tiny, fontWeight: 1000, marginBottom: 4 }}>
              REASON CODES
            </div>
            <CompactList items={reasonCodes} />
          </div>

          <div>
            <div style={{ color: "#9ca3af", fontSize: FS.tiny, fontWeight: 1000, marginBottom: 4 }}>
              NOT READY BECAUSE
            </div>
            <CompactList items={blockers} empty="—" />
          </div>

          <div>
            <div style={{ color: "#9ca3af", fontSize: FS.tiny, fontWeight: 1000, marginBottom: 4 }}>
              SETUP CHAIN
            </div>
            <CompactList items={setupChain} empty="—" />
          </div>
        </div>
      </Section>

      {/* Footer */}
      <Section title="SUMMARY" subtle>
        <KV label="Market" value={market} />
        <KV label="Summary" value={summary} />
        <KV label="Horizon" value="intraday / execution" />
      </Section>
    </div>
  );
}

/* -------------------- Intermediate passive v1 -------------------- */
function IntermediateV1Card({ node, snapshot, activeGlow }) {
  const engine15 = node?.engine15 || {};
  const decision = node?.engine15Decision || {};
  const engine16 = node?.engine16 || {};
  const permission = node?.permission || {};

  const readiness =
    engine15?.readiness ||
    decision?.readinessLabel ||
    engine16?.readinessLabel ||
    "WAIT";

  const action = decision?.action || "NO_ACTION";
  const bias = biasBadgeTextIntermediate(engine16);

  const primaryPhase = engine16?.primaryPhase || engine16?.waveContext?.primaryPhase || "—";
  const intermediatePhase =
    engine16?.intermediatePhase || engine16?.waveContext?.intermediatePhase || "—";
  const phase = engine16?.waveState || engine16?.waveContext?.waveState || "—";
  const macroBias = engine16?.macroBias || engine16?.waveContext?.macroBias || "NONE";

  const nextFocus = decision?.lifecycle?.nextFocus || "WAIT";
  const triggerCondition = intermediateTriggerCondition(engine16, readiness);
  const summary = intermediateSummary(node, snapshot);
  const market = marketLine(snapshot);

  return (
    <div
      style={{
        background: "#0f1117",
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 12,
        color: "#e5e7eb",
        boxShadow: activeGlow,
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.title }}>Intermediate Swing</div>
          <div style={{ color: "#9ca3af", fontSize: FS.subtitle, fontWeight: 800 }}>
            1h
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge text={upper(readiness)} tone={readinessTone(readiness)} />
          <Badge text={upper(action)} tone={actionTone(action)} />
          <Badge text={bias} tone={biasTone(bias)} />
        </div>
      </div>

      <Section title="STRUCTURE CORE" subtle>
        <KV label="Primary Phase" value={prettyEnum(primaryPhase)} />
        <KV label="Intermediate Phase" value={prettyEnum(intermediatePhase)} />
        <KV label="Phase" value={prettyEnum(phase)} />
        <KV label="Macro Bias" value={prettyEnum(macroBias)} />
      </Section>

      <Section title="DECISION" subtle>
        <KV label="Next Focus" value={prettyEnum(nextFocus)} />
        <KV label="Trigger Condition" value={prettyEnum(triggerCondition)} />
        <KV label="Permission" value={upper(permission?.permission || "UNKNOWN")} />
      </Section>

      <Section title="SUMMARY" subtle>
        <KV label="Market" value={market} />
        <KV label="Summary" value={summary} />
        <KV label="Horizon" value="multi-bar / swing" />
      </Section>
    </div>
  );
}

/* ===================== Main Component ===================== */
export default function RowStrategies() {
  const STRATS = useMemo(
    () => [
      { id: "SCALP" },
      { id: "MINOR" },
      { id: "INTERMEDIATE" },
    ],
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
        <div className="panel-title">Strategies — Decision Interface</div>

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
          gap: 10,
          marginTop: 10,
        }}
      >
        {STRATS.map((s) => {
          const stratKey = STRATEGY_ID_MAP[s.id];
          const node = snapshot?.strategies?.[stratKey] || null;

          const activeGlow =
            active === s.id
              ? "0 0 0 2px rgba(59,130,246,.65) inset, 0 10px 30px rgba(0,0,0,.25)"
              : "0 10px 30px rgba(0,0,0,.25)";

          if (s.id === "SCALP") {
            return (
              <ScalpV1Card
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
              <IntermediateV1Card
                key={s.id}
                node={node}
                snapshot={snapshot}
                activeGlow={activeGlow}
              />
            );
          }

          return (
            <PassiveCard
              key={s.id}
              title="Longer-Term"
              tf="4h"
              node={node}
              snapshot={snapshot}
            />
          );
        })}
      </div>
    </section>
  );
}
