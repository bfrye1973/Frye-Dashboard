// src/pages/rows/RowStrategies/index.jsx
// Row 5 — Strategies (compact decision interface)
// FULL REWRITE
//
// Engine 22 Wave Degrees cleanup:
// - Keeps the real RowStrategies default export.
// - Keeps Engine 27 Trader Intelligence.
// - Replaces the cluttered Engine 22 wave-degree cards with a simple structural read.
// - Display only. No execution. No permission.

import React from "react";
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
function getDegreeStates(snapshot) {
  return (
    snapshot?.strategies?.[STRATEGY_ID_MAP.SCALP]?.engine22WaveStrategy
      ?.degreeStates || null
  );
}

function waveText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function wavePrice(value, fallback = "—") {
  return Number.isFinite(Number(value)) ? fmt2(value) : fallback;
}

function getEngine22Internal(state) {
  return (
    state?.cWaveInternalStructure ||
    state?.targetModel?.internalCStructure ||
    state?.activeFibModel?.internalCStructure ||
    state?.internalStructure?.internalCStructure ||
    state?.internalStructure ||
    null
  );
}

function getMinuteCLevels(internal) {
  return (
    internal?.minuteC?.targetModel?.levels ||
    internal?.cC?.targetModel?.levels ||
    internal?.targetModel?.levels ||
    {}
  );
}

function getParentCLevels(state, internal) {
  return (
    internal?.largerCDownTargets ||
    internal?.cC?.largerCTargets ||
    state?.targetModel?.cDownTargets ||
    state?.activeFibModel?.levels ||
    {}
  );
}

function Engine22Line({ label, value, tone = "default" }) {
  const color =
    tone === "short"
      ? "#fca5a5"
      : tone === "long"
      ? "#86efac"
      : tone === "warn"
      ? "#fbbf24"
      : tone === "muted"
      ? "#94a3b8"
      : "#e5e7eb";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "92px minmax(0,1fr)",
        gap: 6,
        alignItems: "start",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 1000,
          lineHeight: 1.1,
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
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Engine22TargetGrid({ title, levels, labels }) {
  const rows = labels
    .map(([key, label]) => ({
      key,
      label,
      price: levels?.[key],
    }))
    .filter((row) => Number.isFinite(Number(row.price)));

  if (!rows.length) return null;

  return (
    <div
      style={{
        border: "1px solid #1f3d20",
        borderRadius: 10,
        background: "#061108",
        padding: 7,
        display: "grid",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          alignItems: "center",
        }}
      >
        <div style={{ color: "#86efac", fontSize: FS.micro, fontWeight: 1000 }}>
          {title}
        </div>
        <Badge text="FIBS" tone="long" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 5,
        }}
      >
        {rows.map((row) => (
          <div
            key={row.key}
            style={{
              border: "1px solid rgba(34,197,94,.35)",
              borderRadius: 8,
              background: "#081509",
              padding: "5px 6px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: "#86efac",
                fontSize: 11,
                fontWeight: 1000,
                lineHeight: 1,
              }}
            >
              {row.label}
            </div>
            <div
              style={{
                color: "#f8fafc",
                fontSize: FS.small,
                fontWeight: 1000,
                lineHeight: 1.1,
              }}
            >
              {wavePrice(row.price)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Engine22SimpleDegreeCard({ degree, state }) {
  const active = state?.active === true;
  const internal = getEngine22Internal(state);
  const degreeKey = String(degree || state?.degree || "").toLowerCase();

  const isMinute = degreeKey === "minute";
  const isMinor = degreeKey === "minor";
  const isSubminute = degreeKey === "subminute";
  const isHigher = degreeKey === "intermediate" || degreeKey === "primary";

  const minuteALow =
    internal?.minuteA?.low ??
    internal?.finalMinuteABC?.waveA?.price ??
    internal?.cA?.low ??
    internal?.cA?.completionTouchPrice ??
    null;

  const minuteATime =
    internal?.minuteA?.time ??
    internal?.finalMinuteABC?.waveA?.time ??
    internal?.cA?.time ??
    internal?.cA?.completionTouchTime ??
    null;

  const minuteBHigh =
    internal?.minuteB?.high ??
    internal?.finalMinuteABC?.waveB?.price ??
    internal?.cB?.high ??
    null;

  const minuteBTime =
    internal?.minuteB?.time ??
    internal?.finalMinuteABC?.waveB?.time ??
    internal?.cB?.time ??
    null;

  const minuteCState =
    internal?.minuteC?.state ||
    internal?.cC?.state ||
    internal?.cWaveState ||
    "—";

  const minuteCStart =
    internal?.minuteC?.start ??
    internal?.finalMinuteABC?.waveC?.start ??
    internal?.cC?.start ??
    minuteBHigh ??
    null;

  const minuteCLevels = getMinuteCLevels(internal);
  const parentCLevels = getParentCLevels(state, internal);

  const largerInvalidation =
    internal?.largerInvalidationLevel ??
    internal?.parentStructure?.invalidationLevel ??
    state?.targetModel?.reclaimInvalidationLevel ??
    state?.activeFibModel?.invalidationLevel ??
    null;

  const currentInvalidation =
    internal?.minuteB?.invalidationLevel ??
    internal?.minuteC?.targetModel?.invalidationLevel ??
    internal?.cC?.targetModel?.invalidationLevel ??
    internal?.invalidationLevel ??
    state?.invalidationLevel ??
    null;

  let title = prettyEnum(degree);
  let subtitle = state?.tf || "—";
  let headline = state?.headline || `${prettyEnum(degree)} context unavailable`;
  let tone = active ? "watch" : "wait";
  let badge = state?.activeWave || "CTX";

  if (isMinute) {
    title = "MINUTE";
    subtitle = "Tactical map";
    headline = "Current tactical wave: Minute C-down active";
    tone = "short";
    badge = "C DOWN";
  } else if (isMinor) {
    title = "MINOR";
    subtitle = "Parent correction";
    headline = "Parent active leg: Minor C-down inside Minor W4 expanded flat";
    tone = "short";
    badge = "PARENT";
  } else if (isSubminute) {
    title = "SUBMINUTE";
    subtitle = "Lower-timeframe context";
    headline = "Unresolved / context only — do not force count";
    tone = "wait";
    badge = "CTX";
  } else if (degreeKey === "intermediate") {
    title = "INTERMEDIATE";
    subtitle = "Higher-timeframe context";
    headline = state?.headline || "Intermediate structure context only";
    tone = "long";
  } else if (degreeKey === "primary") {
    title = "PRIMARY";
    subtitle = "Highest-timeframe context";
    headline = state?.headline || "Primary structure context only";
    tone = "long";
  }

  return (
    <div
      style={{
        background: active ? "#101720" : "#0b0f16",
        border:
          tone === "short"
            ? "1px solid #7f1d1d"
            : active
            ? "1px solid #2563eb"
            : "1px solid #1f2937",
        borderTop:
          tone === "short"
            ? "4px solid #ef4444"
            : tone === "long"
            ? "4px solid #22c55e"
            : "4px solid #3b82f6",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 7,
        boxShadow: active ? "0 0 14px rgba(37,99,235,.22)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 1000, fontSize: FS.small, color: "#e5e7eb" }}>
            {title}
          </div>
          <div style={{ fontWeight: 900, fontSize: FS.micro, color: "#9ca3af" }}>
            {subtitle}
          </div>
        </div>

        <Badge text={badge} tone={tone} />
      </div>

      <div
        style={{
          fontWeight: 1000,
          fontSize: FS.small,
          color: tone === "short" ? "#fca5a5" : active ? "#bfdbfe" : "#9ca3af",
          lineHeight: 1.15,
        }}
      >
        {headline}
      </div>

      {isMinute ? (
        <>
          <Engine22Line
            label="A Low"
            value={`${wavePrice(minuteALow)}${minuteATime ? ` — ${minuteATime}` : ""}`}
          />
          <Engine22Line
            label="B High"
            value={`${wavePrice(minuteBHigh)}${minuteBTime ? ` — ${minuteBTime}` : ""}`}
          />
          <Engine22Line
            label="Current"
            value={`${waveText(internal?.currentInternalWave || "Minute-C")} / ${prettyEnum(minuteCState)}`}
            tone="short"
          />
          <Engine22Line label="Started" value={wavePrice(minuteCStart)} tone="short" />
          <Engine22Line
            label="Invalid"
            value={
              currentInvalidation != null
                ? `Above internal B high ${wavePrice(currentInvalidation)} reclaim / hold`
                : "Above internal B high reclaim / hold"
            }
            tone="warn"
          />

          <Engine22TargetGrid
            title="Minute C-down extensions"
            levels={minuteCLevels}
            labels={[
              ["cc100", "C 1.000"],
              ["cc1272", "C 1.272"],
              ["cc1618", "C 1.618"],
              ["cc200", "C 2.000"],
              ["cc2618", "C 2.618"],
            ]}
          />
        </>
      ) : isMinor ? (
        <>
          <Engine22Line label="Structure" value="Minor W4 expanded flat" />
          <Engine22Line label="Active Leg" value="Minor C-down" tone="short" />
          <Engine22Line
            label="Invalid"
            value={
              largerInvalidation != null
                ? `Above expanded-flat B high ${wavePrice(largerInvalidation)} reclaim / hold`
                : "Above expanded-flat B high 7840.00 reclaim / hold"
            }
            tone="warn"
          />

          <Engine22TargetGrid
            title="Minor C-down destinations"
            levels={parentCLevels}
            labels={[
              ["c100", "First: C 1.000"],
              ["c1272", "Next: C 1.272"],
              ["c1618", "Primary: C 1.618"],
              ["c200", "Deep: C 2.000"],
              ["c2618", "Extreme: C 2.618"],
            ]}
          />

          <div
            style={{
              border: "1px solid #5b3a10",
              borderRadius: 10,
              background: "#171005",
              padding: 7,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ color: "#fbbf24", fontSize: FS.micro, fontWeight: 1000 }}>
              Minor C-down completion watch
            </div>

            <Engine22Line
              label="First"
              value={`First reaction / shallow completion near ${wavePrice(parentCLevels?.c100)}`}
              tone="warn"
            />
            <Engine22Line
              label="Primary"
              value={`Best normal completion watch near ${wavePrice(parentCLevels?.c1618)}`}
              tone="short"
            />
            <Engine22Line
              label="Deep"
              value={`Deeper completion watch near ${wavePrice(parentCLevels?.c200)}`}
              tone="short"
            />
            <Engine22Line
              label="Extreme"
              value={`Exhaustion / stretch zone near ${wavePrice(parentCLevels?.c2618)}`}
              tone="warn"
            />
            <Engine22Line
              label="Rule"
              value="Do not call Minor complete until Minute C-down completes/reclaims"
              tone="muted"
            />
          </div>
        </>
      ) : isSubminute ? (
        <>
          <Engine22Line label="Role" value="Context only" tone="muted" />
          <Engine22Line label="Use" value="Do not force subminute count" tone="muted" />
          <Engine22Line label="Parent" value="Minute C-down map controls" />
        </>
      ) : isHigher ? (
        <>
          <Engine22Line label="Wave" value={state?.activeWave || "—"} />
          <Engine22Line label="Stage" value={prettyEnum(state?.stage)} />
          <Engine22Line label="Role" value="Higher-timeframe context only" tone="muted" />
          {state?.targetModel?.nextTarget != null ? (
            <Engine22Line label="Next" value={wavePrice(state.targetModel.nextTarget)} />
          ) : null}
        </>
      ) : (
        <>
          <Engine22Line label="Stage" value={prettyEnum(state?.stage)} />
          <Engine22Line label="Action" value={prettyEnum(state?.action)} />
        </>
      )}
    </div>
  );
}

function WaveDegreeRow({ snapshot }) {
  const degreeStates = getDegreeStates(snapshot);
  const degrees = ["subminute", "minute", "minor", "intermediate", "primary"];

  if (!degreeStates) {
    return (
      <div
        style={{
          marginTop: 10,
          border: "1px solid #1f2937",
          borderRadius: 14,
          padding: 10,
          background: "#0b0f16",
          color: "#9ca3af",
          fontWeight: 900,
        }}
      >
        Engine 22 Wave Degrees unavailable
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 10,
        background: "#080d14",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 1000, fontSize: FS.title, color: "#e5e7eb" }}>
          Engine 22 Wave Degrees
        </div>
        <div style={{ color: "#9ca3af", fontSize: FS.tiny, fontWeight: 900 }}>
          Structural display only — no execution permission
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0,1fr))",
          gap: 8,
        }}
      >
        {degrees.map((degree) => (
          <Engine22SimpleDegreeCard
            key={degree}
            degree={degree}
            state={degreeStates?.[degree] || { degree, active: false }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------- Engine 27F presentation -------------------- */
const ENGINE27_DEGREES = [
  "subminute",
  "minute",
  "minor",
  "intermediate",
  "primary",
];

const ENGINE27_COMPATIBILITY_PATHS = {
  subminute: "minuteToSubminute",
  minute: "minorToMinute",
  minor: "intermediateToMinor",
  intermediate: "primaryToIntermediate",
};

function engine27Value(value, fallback = "—") {
  if (value == null || value === "") return fallback;

  const normalized = String(value).trim().toUpperCase();
  if (!normalized || normalized === "UNKNOWN" || normalized === "NONE") {
    return fallback;
  }

  return prettyEnum(value, fallback);
}

function engine27RawValue(value, fallback = "—") {
  return value == null || value === "" ? fallback : String(value);
}

function engine27Number(value, fallback = "—") {
  return Number.isFinite(Number(value)) ? String(value) : fallback;
}

function engine27Distance(value) {
  return Number.isFinite(Number(value)) ? `${value} pts` : "—";
}

function engine27Engine6Label(pipeline) {
  if (pipeline?.engine6Allowed !== true) return "NONE";

  const decision = upper(pipeline?.engine6Decision, "");

  if (decision === "FAST_INTRADAY_PAPER_ALLOW") return "FAST PAPER";
  if (decision === "PAPER_ALLOW") return "PAPER";

  return "NONE";
}

function engine27PlannerLabel(pipeline) {
  if (pipeline?.plannerReady === true) return "Planner Ready";
  if (pipeline?.available === true) return "Planner Waiting";
  return "Unavailable";
}

function engine27Compatibility(alignment, degree) {
  if (degree === "primary") return "TOP DEGREE";

  const relationshipKey = ENGINE27_COMPATIBILITY_PATHS[degree];
  return (
    alignment?.waveStageCompatibility?.[relationshipKey]?.status ||
    "UNKNOWN"
  );
}

function engine27OptionalWave(value) {
  const normalized = upper(value, "");
  return normalized && normalized !== "UNKNOWN" ? value : null;
}

function Engine27SummaryCell({ label, children, wide = false }) {
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 12,
        background: "#0a0f18",
        padding: "10px 12px",
        minWidth: 0,
        gridColumn: wide ? "span 2" : "auto",
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

function Engine27Metric({ label, value, tone = "default" }) {
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
        borderRight: "1px solid rgba(51,65,85,.42)",
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

function Engine27InlineList({ values, emptyLabel = "None", tone = "default" }) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  const color = tone === "warning" ? "#fbbf24" : "#e5e7eb";

  return (
    <span style={{ color, fontWeight: 900 }}>
      {items.length ? items.map(prettyEnum).join(" • ") : emptyLabel}
    </span>
  );
}

function Engine27WideRow({ label, children, tone = "default" }) {
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
        gridTemplateColumns: "82px minmax(0,1fr)",
        gap: 7,
        alignItems: "start",
        padding: "4px 7px",
        borderTop: "1px solid rgba(51,65,85,.42)",
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

function Engine27DegreeCard({
  degree,
  wave,
  fib,
  decision,
  alignment,
  highestPriorityDegree,
}) {
  const decisionState = decision?.decisionState || "IDLE";
  const direction =
    decision?.direction ||
    wave?.preferredTradeDirection ||
    "NEUTRAL";

  const currentWave = wave?.currentWave;
  const internalWave = engine27OptionalWave(wave?.internalWave);
  const nextInternalWave = engine27OptionalWave(
    wave?.nextExpectedInternalWave
  );

  const compatibility = engine27Compatibility(alignment, degree);
  const warnings = Array.isArray(decision?.warnings)
    ? decision.warnings.filter(Boolean)
    : [];

  const invalidationBreached =
    wave?.invalidationBreached === true ||
    decision?.invalidationBreached === true;

  const pipeline = decision?.paperPipeline || {};
  const topAccent = invalidationBreached
    ? "#ef4444"
    : engine27Accent(decisionState);

  const isHighestPriority = highestPriorityDegree === degree;

  return (
    <div
      className="engine27-degree-card"
      style={{
        background: "#0b1018",
        border: invalidationBreached
          ? "1px solid #7f1d1d"
          : "1px solid #263244",
        borderTop: `4px solid ${topAccent}`,
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
          justifyContent: "space-between",
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

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Badge
            text={prettyEnum(decisionState)}
            tone={engine27DecisionTone(decisionState)}
          />
          <Badge
            text={prettyEnum(direction)}
            tone={engine27DirectionTone(direction)}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          border: "1px solid rgba(51,65,85,.42)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <Engine27Metric label="Decision" value={prettyEnum(decisionState)} />
        <Engine27Metric
          label="Direction"
          value={prettyEnum(direction)}
          tone={
            upper(direction) === "LONG"
              ? "long"
              : upper(direction) === "SHORT"
              ? "short"
              : "default"
          }
        />
        <Engine27Metric label="Current" value={engine27Value(currentWave)} />
        <Engine27Metric
          label="Current Leg"
          value={engine27Value(wave?.currentLegDirection)}
        />

        <Engine27Metric
          label="Internal"
          value={internalWave ? engine27RawValue(internalWave) : "—"}
        />
        <Engine27Metric
          label="Next Wave"
          value={engine27Value(wave?.nextExpectedWave)}
        />
        <Engine27Metric
          label="Next Internal"
          value={nextInternalWave ? engine27RawValue(nextInternalWave) : "—"}
        />
        <Engine27Metric
          label="Pullback"
          value={engine27Value(wave?.pullbackClassification)}
          tone={
            upper(wave?.pullbackClassification, "") === "INTERNAL_PULLBACK"
              ? "warning"
              : "default"
          }
        />

        <Engine27Metric
          label="Last Fib"
          value={engine27Value(fib?.currentFib?.lastCompleted)}
        />
        <Engine27Metric label="Next Fib" value={engine27Value(fib?.nextFib)} />
        <Engine27Metric
          label="Objective"
          value={engine27Number(fib?.nextPrice)}
        />
        <Engine27Metric
          label="Distance"
          value={engine27Distance(fib?.distance)}
        />

        <Engine27Metric
          label="Support"
          value={engine27Number(wave?.supportLevel)}
        />
        <Engine27Metric
          label="Invalidation"
          value={engine27Number(wave?.invalidationLevel)}
          tone={invalidationBreached ? "danger" : "default"}
        />
        <Engine27Metric
          label="Alignment"
          value={
            degree === "primary"
              ? "TOP DEGREE"
              : engine27Value(compatibility)
          }
          tone={
            upper(compatibility, "") === "PULLS_BACK_INSIDE_PARENT"
              ? "warning"
              : "default"
          }
        />
        <Engine27Metric
          label="Action"
          value={engine27Value(decision?.recommendedAction)}
        />
      </div>

      <Engine27WideRow label="Waiting For">
        <Engine27InlineList values={decision?.waitingFor} emptyLabel="None" />
      </Engine27WideRow>

      <Engine27WideRow label="Warnings" tone={warnings.length ? "warning" : "default"}>
        <Engine27InlineList
          values={warnings}
          emptyLabel="None"
          tone={warnings.length ? "warning" : "default"}
        />
      </Engine27WideRow>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          borderTop: "1px solid rgba(51,65,85,.42)",
          marginTop: 1,
        }}
      >
        <Engine27Metric label="Engine 6" value={engine27Engine6Label(pipeline)} />
        <Engine27Metric label="Engine 26" value={engine27PlannerLabel(pipeline)} />
      </div>
    </div>
  );
}

function Engine27TraderIntelligence({ snapshot }) {
  const engine27 = snapshot?.engine27Strategies || null;

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

  const waveIntelligence = engine27?.engine27WaveIntelligence || {};
  const fibIntelligence = engine27?.engine27FibIntelligence || {};
  const alignment = engine27?.engine27Alignment || {};
  const marketStory = engine27?.engine27MarketStory || {};
  const traderDecision = engine27?.engine27TraderDecision || {};
  const decisions = traderDecision?.decisions || {};
  const highestPriorityDegree =
    traderDecision?.highestPriorityDecision?.degree || null;

  const structuralWarnings = Array.isArray(alignment?.lowerDegreeWarnings)
    ? [...new Set(alignment.lowerDegreeWarnings.filter(Boolean))]
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
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          align-items: stretch;
        }

        @media (max-width: 1750px) {
          .engine27-degree-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1180px) {
          .engine27-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .engine27-degree-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .engine27-summary-grid,
          .engine27-degree-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
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
          text={prettyEnum(alignment?.direction || "NEUTRAL")}
          tone={engine27DirectionTone(alignment?.direction)}
          large
        />
      </div>

      <div className="engine27-summary-grid">
        <Engine27SummaryCell label="Alignment">
          {engine27Value(alignment?.alignmentState)}
        </Engine27SummaryCell>

        <Engine27SummaryCell label="Confidence">
          {engine27Value(alignment?.confidence)}
        </Engine27SummaryCell>

        <Engine27SummaryCell label="Market Story">
          {engine27RawValue(marketStory?.headline)}
        </Engine27SummaryCell>

        <Engine27SummaryCell label="Warnings">
          <div style={{ display: "grid", gap: 5 }}>
            <div
              style={{
                color: marketStory?.warningSummary ? "#fbbf24" : "#94a3b8",
              }}
            >
              {marketStory?.warningSummary || "None"}
            </div>

            {structuralWarnings.length ? (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {structuralWarnings.map((warning) => (
                  <Badge
                    key={warning}
                    text={prettyEnum(warning)}
                    tone="arming"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </Engine27SummaryCell>
      </div>

      <div className="engine27-degree-grid">
        {ENGINE27_DEGREES.map((degree) => (
          <Engine27DegreeCard
            key={degree}
            degree={degree}
            wave={waveIntelligence?.[degree] || null}
            fib={fibIntelligence?.[degree] || null}
            decision={decisions?.[degree] || null}
            alignment={alignment}
            highestPriorityDegree={highestPriorityDegree}
          />
        ))}
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
  } = useDashboardSnapshot(DASHBOARD_SYMBOL, {
    pollMs: POLL_MS,
    timeoutMs: TIMEOUT_MS,
    includeContext: 1,
  });

  return (
    <section id="row-5" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title" style={{ fontSize: 16, fontWeight: 1000 }}>
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
            Symbol: <b style={{ marginLeft: 4 }}>{snapshot?.symbol || "—"}</b>
          </span>

          <span>
            Poll: <b>{Math.round(POLL_MS / 1000)}s</b>
          </span>

          <span>
            Frontend fetch:{" "}
            <b style={{ marginLeft: 4 }}>
              {lastFetch ? toAZ(lastFetch, true) : "—"}
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
            <b style={{ marginLeft: 4 }}>{snapshotTime(snapshot)}</b>
          </span>

          <span>
            Build: <b style={{ marginLeft: 4 }}>{toAZ(BUILD_STAMP, true)}</b>
          </span>

          <button
            onClick={() => openFullStrategies(DASHBOARD_SYMBOL)}
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
          Strategy snapshot error: {err}
        </div>
      ) : null}

      <WaveDegreeRow snapshot={snapshot} />
      <Engine27TraderIntelligence snapshot={snapshot} />
    </section>
  );
}
