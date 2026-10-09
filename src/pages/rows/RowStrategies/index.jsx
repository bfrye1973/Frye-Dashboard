// src/pages/rows/RowStrategies/index.jsx
// Row 5 — Strategies (compact decision interface)
// FULL REWRITE
//
// Engine 22 Wave Degrees:
// - Keeps the current simplified five-degree structural cards.
// - Display only. No execution. No permission.
//
// Engine 27 Trader Intelligence:
// - Keeps Engine 27A–27E as the backend intelligence owners.
// - Keeps Subminute / Intermediate / Primary on the existing generic card.
// - Minute is rendered as a dedicated Strategy 1 tactical card.
// - Minor is rendered as a dedicated parent-correction context card.
// - Structural leg, Strategy 1 direction, and expected reversal are intentionally
//   displayed as separate concepts.
// - Frontend presentation only. No backend decision logic is changed.

import React from "react";
import { useDashboardSnapshot } from "../../../hooks/useDashboardSnapshot";
import Engine22MarketStructureCard from "../RowChart/overlays/Engine22MarketStructureCard";

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

const DASHBOARD_SYMBOL = "ES";

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

/* -------------------- tones -------------------- */
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

function engine27DecisionTone(value) {
  const state = upper(value, "IDLE");

  if (["READY", "TRIGGERED", "ACTIVE"].includes(state)) return "ready";
  if (state === "ALMOST_READY") return "arming";
  if (state === "APPROACHING") return "watch";
  if (state === "INVALIDATED") return "blocked";

  return "wait";
}

function engine27DirectionTone(value) {
  const direction = upper(value, "NEUTRAL");

  if (direction === "LONG") return "long";
  if (direction === "SHORT") return "short";

  return "neutral";
}

function engine27Accent(value) {
  const state = upper(value, "IDLE");

  if (["READY", "TRIGGERED", "ACTIVE"].includes(state)) return "#22c55e";
  if (state === "ALMOST_READY") return "#fbbf24";
  if (state === "APPROACHING") return "#3b82f6";
  if (state === "INVALIDATED") return "#ef4444";

  return "#64748b";
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

/* -------------------- Engine 22 Wave Degrees -------------------- */
function getEngine22Display(snapshot) {
  return (
    snapshot?.strategies?.[STRATEGY_ID_MAP.SCALP]?.engine22WaveStrategy
      ?.engine22Display || null
  );
}

function getEngine22CurrentWavelength(snapshot) {
  return snapshot?.strategies?.[STRATEGY_ID_MAP.SCALP]?.engine22WaveStrategy?.currentWavelength || null;
}

function wavePrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function WaveDegreeRow({ snapshot }) {
  return (
    <Engine22MarketStructureCard
      engine22Display={getEngine22Display(snapshot)}
      currentWavelength={getEngine22CurrentWavelength(snapshot)}
    />
  );
}

/* -------------------- Engine 27 presentation -------------------- */
const ENGINE27_DEGREES = [
  "micro",
  "subminute",
  "minute",
  "minor",
  "intermediate",
  "primary",
];

const ENGINE27_COMPATIBILITY_PATHS = {
  micro: "subminuteToMicro",
  subminute: "minuteToSubminute",
  minute: "minorToMinute",
  minor: "intermediateToMinor",
  intermediate: "primaryToIntermediate",
};

function engine27Value(value, fallback = "—") {
  if (value == null || value === "") {
    return fallback;
  }

  const normalized =
    String(value).trim().toUpperCase();

  if (
    !normalized ||
    normalized === "UNKNOWN" ||
    normalized === "NONE"
  ) {
    return fallback;
  }

  return prettyEnum(value, fallback);
}

function engine27RawValue(value, fallback = "—") {
  return value == null || value === ""
    ? fallback
    : String(value);
}

function engine27Number(value, fallback = "—") {
  return Number.isFinite(Number(value))
    ? String(value)
    : fallback;
}

function engine27Distance(value) {
  return Number.isFinite(Number(value))
    ? `${value} pts`
    : "—";
}

function engine27Engine6Label(pipeline) {
  if (pipeline?.engine6Allowed !== true) {
    return "NONE";
  }

  const decision =
    upper(pipeline?.engine6Decision, "");

  if (
    decision === "FAST_INTRADAY_PAPER_ALLOW"
  ) {
    return "FAST PAPER";
  }

  if (decision === "PAPER_ALLOW") {
    return "PAPER";
  }

  return "NONE";
}

function engine27PlannerLabel(pipeline) {
  if (pipeline?.plannerReady === true) {
    return "Planner Ready";
  }

  if (pipeline?.available === true) {
    return "Planner Waiting";
  }

  return "Unavailable";
}

function engine27Compatibility(
  alignment,
  degree
) {
  if (degree === "micro") return "TIMING_ONLY";
  if (degree === "primary") {
    return "TOP DEGREE";
  }

  const relationshipKey =
    ENGINE27_COMPATIBILITY_PATHS[degree];

  return (
    alignment?.waveStageCompatibility?.[
      relationshipKey
    ]?.status ||
    "UNKNOWN"
  );
}

function engine27OptionalWave(value) {
  const normalized = upper(value, "");

  return normalized &&
    normalized !== "UNKNOWN"
    ? value
    : null;
}

function Engine27SummaryCell({
  label,
  children,
  wide = false,
}) {
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 12,
        background: "#0a0f18",
        padding: "10px 12px",
        minWidth: 0,
        gridColumn: wide
          ? "span 2"
          : "auto",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: FS.micro,
          fontWeight: 1000,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: "#f8fafc",
          fontSize: FS.body,
          fontWeight: 1000,
          lineHeight: 1.25,
          wordBreak: "break-word",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Engine27Metric({
  label,
  value,
  tone = "default",
}) {
  const color =
    tone === "warning"
      ? "#fbbf24"
      : tone === "danger"
      ? "#f87171"
      : tone === "long"
      ? "#86efac"
      : tone === "short"
      ? "#fca5a5"
      : "#e5e7eb";

  return (
    <div
      style={{
        minWidth: 0,
        borderRight:
          "1px solid rgba(51,65,85,.42)",
        padding: "3px 7px",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1.05,
          textTransform: "uppercase",
          letterSpacing: ".025em",
          marginBottom: 2,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color,
          fontSize: FS.small,
          fontWeight: 1000,
          lineHeight: 1.12,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Engine27InlineList({
  values,
  emptyLabel = "None",
  tone = "default",
}) {
  const items =
    Array.isArray(values)
      ? values.filter(Boolean)
      : [];

  const color =
    tone === "warning"
      ? "#fbbf24"
      : "#e5e7eb";

  return (
    <span
      style={{
        color,
        fontWeight: 900,
      }}
    >
      {items.length
        ? items.map(prettyEnum).join(" • ")
        : emptyLabel}
    </span>
  );
}

function Engine27WideRow({
  label,
  children,
  tone = "default",
}) {
  const color =
    tone === "warning"
      ? "#fbbf24"
      : tone === "danger"
      ? "#f87171"
      : "#e5e7eb";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "82px minmax(0,1fr)",
        gap: 7,
        alignItems: "start",
        padding: "4px 7px",
        borderTop:
          "1px solid rgba(51,65,85,.42)",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: ".025em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color,
          fontSize: FS.small,
          fontWeight: 1000,
          lineHeight: 1.18,
          wordBreak: "break-word",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* -------------------- Engine 27 specialized Minute/Minor cards -------------------- */
function Engine27StatusBlock({
  label,
  state,
  detail,
  tone = "default",
}) {
  const color =
    tone === "ready"
      ? "#86efac"
      : tone === "warning"
      ? "#fbbf24"
      : tone === "short"
      ? "#fca5a5"
      : tone === "long"
      ? "#86efac"
      : "#e5e7eb";

  return (
    <div
      style={{
        border:
          "1px solid rgba(51,65,85,.52)",
        borderRadius: 9,
        background: "#09111a",
        padding: "7px 8px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 1000,
          textTransform: "uppercase",
          letterSpacing: ".03em",
          marginBottom: 3,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color,
          fontSize: FS.small,
          fontWeight: 1000,
          lineHeight: 1.12,
          wordBreak: "break-word",
        }}
      >
        {state}
      </div>

      {detail ? (
        <div
          style={{
            color: "#94a3b8",
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1.2,
            marginTop: 3,
            wordBreak: "break-word",
          }}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function Engine27MinuteTacticalCard({
  wave,
  fib,
  decision,
  strategyNode,
  highestPriorityDegree,
}) {
  const candidate =
    strategyNode?.engine26LocationCandidate ||
    null;

  const reaction =
    strategyNode?.confluence
      ?.context
      ?.reaction
      ?.paperScalpReaction ||
    null;

  const participation =
    strategyNode?.confluence
      ?.context
      ?.volume
      ?.engine4AuthorizedReactionParticipation ||
    null;

  const permission =
    strategyNode?.permission?.paper ||
    null;

  const geometry =
    strategyNode?.engine26ProposedGeometry ||
    null;

  const engine22Display =
    strategyNode?.engine22WaveStrategy
      ?.engine22Display ||
    null;

  const minuteDisplay =
    engine22Display?.degrees?.minute ||
    null;

  /*
   * These are deliberately separate:
   *
   * structuralLeg = what the Elliott/wave leg is doing
   * strategyDirection = tactical Strategy 1 direction
   * expectedDirection = reversal direction currently being evaluated
   */
  const structuralLeg =
    wave?.currentLegDirection ||
    minuteDisplay?.direction ||
    "UNKNOWN";

  const strategyDirection =
    candidate?.currentObservationDirection ||
    candidate?.direction ||
    decision?.direction ||
    "NEUTRAL";

  const expectedDirection =
    candidate?.expectedReversalDirection ||
    decision?.expectedDirection ||
    reaction?.expectedReactionDirection ||
    participation?.intendedDirection ||
    null;

  const contactState =
    candidate?.contactState ||
    candidate?.directionState ||
    decision?.contactState ||
    decision?.directionState ||
    null;

  const tacticalState =
    contactState ||
    decision?.decisionState ||
    candidate?.status ||
    "WAITING";

  const reactionConfirmed =
    reaction?.reactionConfirmed === true ||
    reaction?.confirmed === true ||
    reaction?.allowed === true;

  const participationConfirmed =
    participation?.participationConfirmed ===
      true ||
    participation?.confirmed === true ||
    participation?.allowed === true;

  const permissionAllowed =
    permission?.allowed === true;

  const geometryReady =
    geometry?.geometryReady === true;

  const entryZone =
    candidate?.entryZone ||
    null;

  const zoneLo =
    entryZone?.low ??
    entryZone?.lo ??
    candidate?.zone?.low ??
    candidate?.zone?.lo ??
    null;

  const zoneHi =
    entryZone?.high ??
    entryZone?.hi ??
    candidate?.zone?.high ??
    candidate?.zone?.hi ??
    null;

  const zoneText =
    Number.isFinite(Number(zoneLo)) &&
    Number.isFinite(Number(zoneHi))
      ? `${fmt2(zoneLo)}–${fmt2(zoneHi)}`
      : "—";

  const currentPrice =
    candidate?.currentPrice ??
    decision?.currentPrice ??
    strategyNode?.engine26GeneralLocation
      ?.currentPrice ??
    null;

  const invalidation =
    candidate?.locationInvalidationBoundary ??
    wave?.invalidationLevel ??
    null;

  const nextFib =
    fib?.nextFib ||
    null;

  const nextPrice =
    fib?.nextPrice ??
    null;

  const reactionState =
    reactionConfirmed
      ? "CONFIRMED"
      : reaction?.armed === true ||
        reaction?.active === true
      ? "ARMED / WAITING"
      : "WAITING";

  const participationState =
    participationConfirmed
      ? "CONFIRMED"
      : participation?.armed === true ||
        participation?.active === true
      ? "ARMED / WAITING"
      : "WAITING";

  const permissionState =
    permissionAllowed
      ? "ALLOWED"
      : permission?.armed === true
      ? "ARMED / FALSE"
      : "FALSE";

  const geometryState =
    geometryReady
      ? "READY"
      : "WAITING";

  const isHighestPriority =
    highestPriorityDegree === "minute";

  const plainEnglish =
    "Minute W3 started from 7575 / 7576. Confirmation pending above 7848.50 and 7906.25. Subminute W3 active candidate; Micro W5 launch watch.";

  return (
    <div
      className="engine27-degree-card engine27-minute-tactical-card"
      style={{
        background: "#0b1018",
        border: "1px solid #35506f",
        borderTop: "4px solid #38bdf8",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        boxShadow: isHighestPriority
          ? "0 0 0 1px rgba(56,189,248,.55) inset, 0 0 18px rgba(56,189,248,.18)"
          : "0 6px 18px rgba(0,0,0,.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 7,
        }}
      >
        <div>
          <div
            style={{
              color: "#f8fafc",
              fontSize: FS.body,
              fontWeight: 1000,
            }}
          >
            MINUTE — STRATEGY 1 TACTICAL READ
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 900,
              marginTop: 2,
            }}
          >
            intraday_scalp@10m • Minute W3 started / confirmation pending
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <Badge
            text={prettyEnum(
              tacticalState
            )}
            tone={
              upper(
                tacticalState,
                ""
              ).includes("REVERSAL_WATCH")
                ? "arming"
                : engine27DecisionTone(
                    decision?.decisionState
                  )
            }
          />

          <Badge
            text={prettyEnum(
              strategyDirection
            )}
            tone={engine27DirectionTone(
              strategyDirection
            )}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0,1fr))",
          gap: 6,
          marginBottom: 7,
        }}
      >
        <Engine27StatusBlock
          label="Strategy Direction"
          state={prettyEnum(
            strategyDirection
          )}
          detail="Tactical Strategy 1 direction"
          tone={
            upper(
              strategyDirection
            ) === "LONG"
              ? "long"
              : upper(
                  strategyDirection
                ) === "SHORT"
              ? "short"
              : "warning"
          }
        />

        <Engine27StatusBlock
          label="Structural Leg"
          state={prettyEnum(
            structuralLeg
          )}
          detail={
            wave?.currentWave
              ? `Engine 22 / 27A: ${wave.currentWave}`
              : "Wave structure"
          }
          tone={
            upper(
              structuralLeg
            ) === "DOWN"
              ? "short"
              : "default"
          }
        />

        <Engine27StatusBlock
          label="Expected Reversal"
          state={
            expectedDirection &&
            upper(
              expectedDirection
            ) !== "NONE"
              ? `${prettyEnum(
                  expectedDirection
                )} — WATCH ONLY`
              : "NONE"
          }
          detail="Observation direction only"
          tone={
            upper(
              expectedDirection
            ) === "SHORT"
              ? "warning"
              : "default"
          }
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0,1fr))",
          gap: 6,
          marginBottom: 7,
        }}
      >
        <Engine27StatusBlock
          label="Location"
          state={prettyEnum(
            candidate?.contactState ||
            candidate?.status ||
            "WAITING"
          )}
          detail={`Zone ${zoneText}`}
          tone={
            candidate
              ? "ready"
              : "default"
          }
        />

        <Engine27StatusBlock
          label="Current Price"
          state={engine27Number(
            currentPrice
          )}
          detail={
            candidate?.setupGrade
              ? `${prettyEnum(
                  candidate.setupGrade
                )} child`
              : "Strategy 1 candidate"
          }
        />

        <Engine27StatusBlock
          label="Next Fib"
          state={engine27Value(
            nextFib
          )}
          detail={
            Number.isFinite(
              Number(nextPrice)
            )
              ? `Objective ${fmt2(
                  nextPrice
                )}`
              : "No objective"
          }
        />

        <Engine27StatusBlock
          label="Invalidation"
          state={engine27Number(
            invalidation
          )}
          detail="Strategy 1 / wave invalidation"
          tone="warning"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0,1fr))",
          gap: 6,
          marginBottom: 7,
        }}
      >
        <Engine27StatusBlock
          label="Engine 3 Reaction"
          state={reactionState}
          detail={prettyEnum(
            reaction?.reactionState ||
            reaction?.state ||
            "NO REACTION YET"
          )}
          tone={
            reactionConfirmed
              ? "ready"
              : "warning"
          }
        />

        <Engine27StatusBlock
          label="Engine 4 Participation"
          state={participationState}
          detail={prettyEnum(
            participation
              ?.participationState ||
            participation?.status ||
            "WAITING"
          )}
          tone={
            participationConfirmed
              ? "ready"
              : "warning"
          }
        />

        <Engine27StatusBlock
          label="Engine 6 Permission"
          state={permissionState}
          detail={prettyEnum(
            permission?.decision ||
            "NO PERMISSION"
          )}
          tone={
            permissionAllowed
              ? "ready"
              : "warning"
          }
        />

        <Engine27StatusBlock
          label="Engine 26B Geometry"
          state={geometryState}
          detail={
            geometryReady
              ? "Directional geometry ready"
              : "Waiting for directional confirmation"
          }
          tone={
            geometryReady
              ? "ready"
              : "warning"
          }
        />
      </div>

      <div
        style={{
          border: "1px solid #3b4f68",
          borderRadius: 9,
          background: "#0a1420",
          padding: "7px 9px",
          color: "#dbeafe",
          fontSize: FS.small,
          fontWeight: 900,
          lineHeight: 1.3,
        }}
      >
        {plainEnglish}
      </div>
    </div>
  );
}

function Engine27MinorParentCard({
  wave,
  decision,
  strategyNode,
}) {
  const engine22Display =
    strategyNode?.engine22WaveStrategy
      ?.engine22Display ||
    null;

  const minorDisplay =
    engine22Display?.degrees?.minor ||
    null;

  const minuteDisplay =
    engine22Display?.degrees?.minute ||
    null;

  const structure =
    minorDisplay?.headline ||
    "Engine 22 structure not published.";

  const activeLeg =
    minorDisplay?.badge ||
    "Engine 22 structure not published.";

  const child =
    minuteDisplay?.badge ||
    "Engine 22 structure not published.";

  const invalidationRow =
    Array.isArray(minorDisplay?.rows)
      ? minorDisplay.rows.find(
          (item) =>
            item?.label === "W5 Invalidation"
        )
      : null;

  const invalidation =
    invalidationRow?.value ??
    wave?.invalidationLevel ??
    null;

  const completionStatus =
    wave?.parentWaveComplete === true ||
    minorDisplay?.active === false
      ? "COMPLETE"
      : "ACTIVE — ENGINE 22 DISPLAY";

  return (
    <div
      className="engine27-degree-card engine27-minor-parent-card"
      style={{
        background: "#0b1018",
        border: "1px solid #5d4330",
        borderTop: "4px solid #f59e0b",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        boxShadow:
          "0 6px 18px rgba(0,0,0,.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          marginBottom: 7,
        }}
      >
        <div>
          <div
            style={{
              color: "#f8fafc",
              fontSize: FS.body,
              fontWeight: 1000,
            }}
          >
            MINOR — W5 ACTIVE CANDIDATE
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 900,
              marginTop: 2,
            }}
          >
            Minor W5 active candidate • Minute W3 started / confirmation pending
          </div>
        </div>

        <Badge
          text={completionStatus}
          tone={
            completionStatus ===
            "COMPLETE"
              ? "ready"
              : "arming"
          }
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0,1fr))",
          gap: 6,
          marginBottom: 7,
        }}
      >
        <Engine27StatusBlock
          label="Parent Structure"
          state={structure}
          detail="Engine 22 structural authority"
        />

        <Engine27StatusBlock
          label="Active Leg"
          state={prettyEnum(
            activeLeg
          )}
          detail={prettyEnum(
            wave?.currentLegDirection ||
            "DOWN"
          )}
          tone="short"
        />

        <Engine27StatusBlock
          label="Tactical Child"
          state={prettyEnum(
            child
          )}
          detail="Minute lane owns tactical execution"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0,1fr))",
          gap: 6,
          marginBottom: 7,
        }}
      >
        {(minorDisplay?.levels || []).map(
          (level, index) => (
            <Engine27StatusBlock
              key={`${level?.label || "level"}-${index}`}
              label={level?.label || "Engine 22 Level"}
              state={wavePrice(level?.price)}
              detail={level?.status || "Engine 22"}
              tone="warning"
            />
          )
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2, minmax(0,1fr))",
          gap: 6,
          marginBottom: 7,
        }}
      >
        <Engine27StatusBlock
          label="Parent Invalidation"
          state={engine27Number(
            invalidation
          )}
          detail="Engine 22 structural invalidation"
          tone="warning"
        />

        <Engine27StatusBlock
          label="Engine 27 Parent Read"
          state={prettyEnum(
            decision?.decisionState ||
            "SETTING UP"
          )}
          detail={prettyEnum(
            decision?.recommendedAction ||
            "MONITOR STRUCTURE"
          )}
        />
      </div>

      <div
        style={{
          border: "1px solid #5b3a10",
          borderRadius: 9,
          background: "#171005",
          padding: "7px 9px",
          color: "#fde68a",
          fontSize: FS.small,
          fontWeight: 900,
          lineHeight: 1.3,
        }}
      >
        Minor W5 active candidate from 7398.00. Minute W3 started from 7575 / 7576; confirmation pending above 7848.50 and 7906.25. Subminute W3 active candidate. Micro W5 launch watch.
      </div>
    </div>
  );
}

/* -------------------- existing generic Engine 27 degree card -------------------- */
function Engine27DegreeCard({
  degree,
  wave,
  fib,
  decision,
  alignment,
  highestPriorityDegree,
}) {
  const decisionState =
    decision?.decisionState ||
    "IDLE";

  const direction =
    decision?.direction ||
    wave?.preferredTradeDirection ||
    "NEUTRAL";

  const currentWave =
    wave?.currentWave;

  const internalWave =
    engine27OptionalWave(
      wave?.internalWave
    );

  const nextInternalWave =
    engine27OptionalWave(
      wave?.nextExpectedInternalWave
    );

  const compatibility =
    engine27Compatibility(
      alignment,
      degree
    );

  const warnings =
    Array.isArray(
      decision?.warnings
    )
      ? decision.warnings.filter(Boolean)
      : [];

  const invalidationBreached =
    wave?.invalidationBreached === true ||
    decision?.invalidationBreached === true;

  const pipeline =
    decision?.paperPipeline ||
    {};

  const topAccent =
    invalidationBreached
      ? "#ef4444"
      : engine27Accent(
          decisionState
        );

  const isHighestPriority =
    highestPriorityDegree === degree;

  return (
    <div
      className="engine27-degree-card"
      style={{
        background: "#0b1018",
        border:
          invalidationBreached
            ? "1px solid #7f1d1d"
            : "1px solid #263244",
        borderTop:
          `4px solid ${topAccent}`,
        borderRadius: 12,
        padding: 7,
        minWidth: 0,
        boxShadow: isHighestPriority
          ? `0 0 0 1px ${topAccent} inset, 0 0 18px ${topAccent}33`
          : "0 6px 18px rgba(0,0,0,.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 6,
          alignItems: "center",
          marginBottom: 5,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#f8fafc",
              fontSize: FS.small,
              fontWeight: 1000,
              letterSpacing: ".025em",
            }}
          >
            {degree.toUpperCase()}
          </div>

          {isHighestPriority ? (
            <div
              style={{
                color: "#fbbf24",
                fontSize: 10,
                fontWeight: 1000,
                marginTop: 1,
              }}
            >
              HIGHEST PRIORITY
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          <Badge
            text={prettyEnum(
              decisionState
            )}
            tone={engine27DecisionTone(
              decisionState
            )}
          />

          <Badge
            text={prettyEnum(
              direction
            )}
            tone={engine27DirectionTone(
              direction
            )}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0,1fr))",
          border:
            "1px solid rgba(51,65,85,.42)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <Engine27Metric
          label="Decision"
          value={prettyEnum(
            decisionState
          )}
        />

        <Engine27Metric
          label="Direction"
          value={prettyEnum(
            direction
          )}
          tone={
            upper(
              direction
            ) === "LONG"
              ? "long"
              : upper(
                  direction
                ) === "SHORT"
              ? "short"
              : "default"
          }
        />

        <Engine27Metric
          label="Current"
          value={engine27Value(
            currentWave
          )}
        />

        <Engine27Metric
          label="Current Leg"
          value={engine27Value(
            wave?.currentLegDirection
          )}
        />

        <Engine27Metric
          label="Internal"
          value={
            internalWave
              ? engine27RawValue(
                  internalWave
                )
              : "—"
          }
        />

        <Engine27Metric
          label="Next Wave"
          value={engine27Value(
            wave?.nextExpectedWave
          )}
        />

        <Engine27Metric
          label="Next Internal"
          value={
            nextInternalWave
              ? engine27RawValue(
                  nextInternalWave
                )
              : "—"
          }
        />

        <Engine27Metric
          label="Pullback"
          value={engine27Value(
            wave?.pullbackClassification
          )}
          tone={
            upper(
              wave?.pullbackClassification,
              ""
            ) === "INTERNAL_PULLBACK"
              ? "warning"
              : "default"
          }
        />

        <Engine27Metric
          label="Last Fib"
          value={engine27Value(
            fib?.currentFib
              ?.lastCompleted
          )}
        />

        <Engine27Metric
          label="Next Fib"
          value={engine27Value(
            fib?.nextFib
          )}
        />

        <Engine27Metric
          label="Objective"
          value={engine27Number(
            fib?.nextPrice
          )}
        />

        <Engine27Metric
          label="Distance"
          value={engine27Distance(
            fib?.distance
          )}
        />

        <Engine27Metric
          label="Support"
          value={engine27Number(
            wave?.supportLevel
          )}
        />

        <Engine27Metric
          label="Invalidation"
          value={engine27Number(
            wave?.invalidationLevel
          )}
          tone={
            invalidationBreached
              ? "danger"
              : "default"
          }
        />

        <Engine27Metric
          label="Alignment"
          value={
            degree === "primary"
              ? "TOP DEGREE"
              : engine27Value(
                  compatibility
                )
          }
          tone={
            upper(
              compatibility,
              ""
            ) === "PULLS_BACK_INSIDE_PARENT"
              ? "warning"
              : "default"
          }
        />

        <Engine27Metric
          label="Action"
          value={engine27Value(
            decision?.recommendedAction
          )}
        />
      </div>

      <Engine27WideRow
        label="Waiting For"
      >
        <Engine27InlineList
          values={
            decision?.waitingFor
          }
          emptyLabel="None"
        />
      </Engine27WideRow>

      <Engine27WideRow
        label="Warnings"
        tone={
          warnings.length
            ? "warning"
            : "default"
        }
      >
        <Engine27InlineList
          values={warnings}
          emptyLabel="None"
          tone={
            warnings.length
              ? "warning"
              : "default"
          }
        />
      </Engine27WideRow>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2, minmax(0,1fr))",
          borderTop:
            "1px solid rgba(51,65,85,.42)",
          marginTop: 1,
        }}
      >
        <Engine27Metric
          label="Engine 6"
          value={engine27Engine6Label(
            pipeline
          )}
        />

        <Engine27Metric
          label="Engine 26"
          value={engine27PlannerLabel(
            pipeline
          )}
        />
      </div>
    </div>
  );
}

function Engine27MicroTimingCard({ microState, microDisplay }) {
  const rows = Array.isArray(microDisplay?.rows) ? microDisplay.rows : [];
  return (
    <div className="engine27-degree-card" style={{
      background:"#0b1018",border:"1px solid #2563eb",borderTop:"4px solid #3b82f6",
      borderRadius:12,padding:9,minWidth:0,display:"grid",gap:9,alignContent:"start",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
        <strong style={{color:"#f8fafc",fontSize:13}}>{microDisplay?.label || "Micro"}</strong>
        <Badge text={microDisplay?.badge || "—"} tone="arming" />
      </div>
      <div style={{color:"#bfdbfe",fontWeight:900,fontSize:12}}>
        {microDisplay?.headline || "Engine 22 Micro display unavailable"}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:5}}>
        {rows.map((item,index) => (
          <Engine27Metric key={index} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function Engine27TraderIntelligence({
  snapshot,
}) {
  const engine27 =
    snapshot?.engine27Strategies ||
    null;

  const strategyNode =
    snapshot?.strategies?.[
      STRATEGY_ID_MAP.SCALP
    ] ||
    null;

  if (!engine27) {
    return (
      <div
        style={{
          marginTop: 10,
          border: "1px solid #1f2937",
          borderRadius: 14,
          padding: 12,
          background: "#0b0f16",
          color: "#9ca3af",
          fontWeight: 900,
        }}
      >
        Engine 27 Trader Intelligence unavailable
      </div>
    );
  }

  const currentWavelength = getEngine22CurrentWavelength(snapshot);
  const microDisplay = getEngine22Display(snapshot)?.degrees?.micro;
  const microState = currentWavelength?.degrees?.micro || null;
  const waveIntelligence =
    engine27?.engine27WaveIntelligence ||
    {};

  const fibIntelligence =
    engine27?.engine27FibIntelligence ||
    {};

  const alignment =
    engine27?.engine27Alignment ||
    {};

  const marketStory =
    engine27?.engine27MarketStory ||
    {};

  const traderDecision =
    engine27?.engine27TraderDecision ||
    {};

  const decisions =
    traderDecision?.decisions ||
    {};

  const highestPriorityDegree =
    traderDecision
      ?.highestPriorityDecision
      ?.degree ||
    null;

  const structuralWarnings =
    Array.isArray(
      alignment?.lowerDegreeWarnings
    )
      ? [
          ...new Set(
            alignment.lowerDegreeWarnings.filter(
              Boolean
            )
          ),
        ]
      : [];

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 10,
        background: "#070c13",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <style>{`
        .engine27-summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr 2fr;
          gap: 8px;
        }

        .engine27-degree-grid {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(180px, 1fr);
          grid-template-columns: repeat(6, minmax(180px, 1fr));
          gap: 8px;
          align-items: stretch;
          overflow-x: auto;
          padding-bottom: 5px;
        }
        .engine27-minute-tactical-card,
        .engine27-minor-parent-card {
          grid-column: span 1;
        }
        @media (max-width: 1180px) {
          .engine27-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 760px) {
          .engine27-summary-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#f8fafc",
              fontSize: 20,
              fontWeight: 1000,
              letterSpacing: ".025em",
            }}
          >
            ENGINE 27 — TRADER INTELLIGENCE
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: FS.tiny,
              fontWeight: 900,
              marginTop: 2,
            }}
          >
            Presentation only — all intelligence is owned by Engines 27A–27E
          </div>
        </div>

        <Badge
          text={prettyEnum(
            alignment?.direction ||
            "NEUTRAL"
          )}
          tone={engine27DirectionTone(
            alignment?.direction
          )}
          large
        />
      </div>

      <div
        className="engine27-summary-grid"
      >
        <Engine27SummaryCell
          label="Alignment"
        >
          {engine27Value(
            alignment?.alignmentState
          )}
        </Engine27SummaryCell>

        <Engine27SummaryCell
          label="Confidence"
        >
          {engine27Value(
            alignment?.confidence
          )}
        </Engine27SummaryCell>

        <Engine27SummaryCell
          label="Market Story"
        >
          {engine27RawValue(
            marketStory?.headline
          )}
        </Engine27SummaryCell>

        <Engine27SummaryCell
          label="Warnings"
        >
          <div
            style={{
              display: "grid",
              gap: 5,
            }}
          >
            <div
              style={{
                color:
                  marketStory
                    ?.warningSummary
                    ? "#fbbf24"
                    : "#94a3b8",
              }}
            >
              {marketStory
                ?.warningSummary ||
                "None"}
            </div>

            {structuralWarnings.length ? (
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  flexWrap: "wrap",
                }}
              >
                {structuralWarnings.map(
                  (warning) => (
                    <Badge
                      key={warning}
                      text={prettyEnum(
                        warning
                      )}
                      tone="arming"
                    />
                  )
                )}
              </div>
            ) : null}
          </div>
        </Engine27SummaryCell>
      </div>

      <div
        className="engine27-degree-grid"
      >
        {ENGINE27_DEGREES.map(
          (degree) => {
            if (degree === "micro") {
              return <Engine27MicroTimingCard
                key="micro"
                microState={microState}
                microDisplay={microDisplay}
                currentPrice={currentWavelength?.currentPrice}
              />;
            }
            if (degree === "minute") {
              return (
                <Engine27MinuteTacticalCard
                  key={degree}
                  wave={
                    waveIntelligence?.minute ||
                    null
                  }
                  fib={
                    fibIntelligence?.minute ||
                    null
                  }
                  decision={
                    decisions?.minute ||
                    null
                  }
                  strategyNode={
                    strategyNode
                  }
                  highestPriorityDegree={
                    highestPriorityDegree
                  }
                />
              );
            }

            if (degree === "minor") {
              return (
                <Engine27MinorParentCard
                  key={degree}
                  wave={
                    waveIntelligence?.minor ||
                    null
                  }
                  decision={
                    decisions?.minor ||
                    null
                  }
                  strategyNode={
                    strategyNode
                  }
                />
              );
            }

            return (
              <Engine27DegreeCard
                key={degree}
                degree={degree}
                wave={
                  waveIntelligence?.[
                    degree
                  ] ||
                  null
                }
                fib={
                  fibIntelligence?.[
                    degree
                  ] ||
                  null
                }
                decision={
                  decisions?.[
                    degree
                  ] ||
                  null
                }
                alignment={
                  alignment
                }
                highestPriorityDegree={
                  highestPriorityDegree
                }
              />
            );
          }
        )}
      </div>
    </div>
  );
}

/* -------------------- main row -------------------- */
export default function RowStrategies() {
  const {
    data: snapshot,
    err,
    lastFetch,
    refreshing,
    hasData,
  } = useDashboardSnapshot(
    DASHBOARD_SYMBOL,
    {
      pollMs: POLL_MS,
      timeoutMs: TIMEOUT_MS,
      includeContext: 1,
    }
  );

  return (
    <section
      id="row-5"
      className="panel"
      style={{
        padding: 10,
      }}
    >
      <div
        className="panel-head"
        style={{
          alignItems: "center",
        }}
      >
        <div
          className="panel-title"
          style={{
            fontSize: 16,
            fontWeight: 1000,
          }}
        >
          Strategies — Decision Interface
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
            Symbol:
            <b
              style={{
                marginLeft: 4,
              }}
            >
              {snapshot?.symbol ||
                "—"}
            </b>
          </span>

          <span>
            Poll:{" "}
            <b>
              {Math.round(
                POLL_MS / 1000
              )}
              s
            </b>
          </span>

          <span>
            Frontend fetch:{" "}
            <b
              style={{
                marginLeft: 4,
              }}
            >
              {lastFetch
                ? toAZ(
                    lastFetch,
                    true
                  )
                : "—"}
            </b>

            {refreshing ? (
              <span
                style={{
                  marginLeft: 6,
                  color: "#fbbf24",
                  fontWeight: 1000,
                }}
              >
                refreshing…
              </span>
            ) : null}
          </span>

          <span>
            Backend snapshot:{" "}
            <b
              style={{
                marginLeft: 4,
              }}
            >
              {snapshotTime(
                snapshot
              )}
            </b>
          </span>

          <span>
            Build:{" "}
            <b
              style={{
                marginLeft: 4,
              }}
            >
              {toAZ(
                BUILD_STAMP,
                true
              )}
            </b>
          </span>

          <button
            onClick={() =>
              openFullStrategies(
                DASHBOARD_SYMBOL
              )
            }
            style={btn()}
            title="Open full strategies in a new window"
          >
            Open Full Strategies
          </button>
        </div>
      </div>

      {err && !hasData ? (
        <div
          style={{
            marginTop: 8,
            color: "#fca5a5",
            fontWeight: 1000,
            fontSize: FS.small,
          }}
        >
          Strategy snapshot error:{" "}
          {err}
        </div>
      ) : null}

      <WaveDegreeRow
        snapshot={snapshot}
      />

      <Engine27TraderIntelligence
        snapshot={snapshot}
      />
    </section>
  );
}
