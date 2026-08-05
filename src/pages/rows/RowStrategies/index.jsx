// src/pages/rows/RowStrategies/index.jsx
// Row 5 — Strategies (compact decision interface)
// PART 1 OF 2

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

function getDegreeStates(snapshot) {
  return (
    snapshot?.strategies?.[STRATEGY_ID_MAP.SCALP]?.engine22WaveStrategy
      ?.degreeStates || null
  );
}

function latestCompletedMark(marks = {}) {
  const waves = ["C", "B", "A", "W5", "W4", "W3", "W2", "W1"];

  for (const wave of waves) {
    const mark = marks?.[wave];
    if (mark?.price != null) {
      return { wave, mark };
    }
  }

  return null;
}

function CorrectionModelMiniBlock({ model }) {
  if (!model?.active) return null;

  const modelType = upper(model?.type || model?.preferredType || "", "");
  const isTriangle =
    modelType.includes("TRIANGLE") ||
    model?.upperTrendline ||
    model?.lowerTrendline ||
    model?.breakoutRules;

  if (isTriangle) {
    const marks = model?.marks || model?.manualMarks || {};
    const upperLine = model?.upperTrendline || {};
    const lowerLine = model?.lowerTrendline || {};
    const breakout = model?.breakoutRules || {};

    const markText = (key) =>
      marks?.[key]?.price != null ? fmt2(marks[key].price) : "—";

    return (
      <div
        style={{
          border: "1px solid #5b3a10",
          borderRadius: 10,
          padding: 7,
          background: "#171005",
          display: "flex",
          flexDirection: "column",
          gap: 5,
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
          <div style={{ fontWeight: 1000, fontSize: FS.micro, color: "#fbbf24" }}>
            ABCDE TRIANGLE — D COMPLETE / E WATCH
          </div>
          <Badge text={prettyEnum(model.stage || "E_WATCH")} tone="arming" />
        </div>

        <KV
          label="A/B/C"
          value={`A ${markText("A")} / B ${markText("B")} / C ${markText("C")}`}
        />

        <KV
          label="D/E"
          value={`D ${markText("D")} / E ${markText("E")}`}
        />

        <KV
          label="B-D Resist"
          value={
            upperLine?.latestResistance != null
              ? fmt2(upperLine.latestResistance)
              : upperLine?.resistanceZone?.lo != null &&
                upperLine?.resistanceZone?.hi != null
              ? `${fmt2(upperLine.resistanceZone.lo)}–${fmt2(
                  upperLine.resistanceZone.hi
                )}`
              : "—"
          }
        />

        <KV
          label="A-C Support"
          value={
            lowerLine?.latestSupport != null
              ? fmt2(lowerLine.latestSupport)
              : lowerLine?.supportZone?.lo != null &&
                lowerLine?.supportZone?.hi != null
              ? `${fmt2(lowerLine.supportZone.lo)}–${fmt2(
                  lowerLine.supportZone.hi
                )}`
              : "—"
          }
        />

        <KV
          label="Breakout"
          value={
            breakout?.bullishReference != null
              ? `Above ${fmt2(breakout.bullishReference)}`
              : prettyEnum(breakout?.bullish || "BREAK_ABOVE_B_D_RESISTANCE")
          }
        />
      </div>
    );
  }

  const bZone = model?.bBounceZone || {};
  const bBand = bZone?.fibBand || {};
  const preferred = bZone?.preferredBand || {};
  const cProjection = model?.cProjectionZone?.projectionFromB || {};
  const parentFib = model?.parentImpulseFib || {};
  const internalFib = model?.abcInternalFib || {};

  const bBandText =
    preferred?.low != null && preferred?.high != null
      ? `${fmt2(preferred.low)}–${fmt2(preferred.high)}`
      : bBand?.r382 != null && bBand?.r618 != null
      ? `${fmt2(bBand.r382)}–${fmt2(bBand.r618)}`
      : "—";

  const bMidText = bBand?.r500 != null ? fmt2(bBand.r500) : "—";

  const cText =
    cProjection?.c100 != null
      ? `C100 ${fmt2(cProjection.c100)}`
      : cProjection?.reason
      ? prettyEnum(cProjection.reason)
      : "Waiting for B mark";

  return (
    <div
      style={{
        border: "1px solid #1e3a5f",
        borderRadius: 10,
        padding: 7,
        background: "#07111f",
        display: "flex",
        flexDirection: "column",
        gap: 5,
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
        <div style={{ fontWeight: 1000, fontSize: FS.micro, color: "#93c5fd" }}>
          ABC DOWN MODEL
        </div>
        <Badge text={prettyEnum(model.stage || "WATCH")} tone="watch" />
      </div>

      <KV label="B Zone" value={bBandText} />
      <KV label="B Mid" value={bMidText} />
      <KV label="C Watch" value={cText} />

      <KV
        label="A Map"
        value={
          internalFib?.anchorHigh != null && internalFib?.anchorLow != null
            ? `${fmt2(internalFib.anchorHigh)} → ${fmt2(internalFib.anchorLow)}`
            : "—"
        }
      />

      <KV
        label="Parent"
        value={
          parentFib?.r382 != null || parentFib?.r500 != null || parentFib?.r618 != null
            ? `382 ${fmt2(parentFib.r382)} / 500 ${fmt2(parentFib.r500)} / 618 ${fmt2(parentFib.r618)}`
            : "—"
        }
      />
    </div>
  );
}

function targetModelTitle(state) {
  const degree = String(state?.degree || "").toLowerCase();
  const activeWave = String(state?.activeWave || "").toUpperCase();

  if (degree === "primary") return `${activeWave || "W5"} Extension Ladder`;
  if (degree === "intermediate") return `${activeWave || "W3"} Extension Ladder`;
  if (degree === "minor") return `${activeWave || "W2"} Retracement Ladder`;

  return "Target Ladder";
}

function TargetModelMiniBlock({ state }) {
  const targetModel = state?.targetModel || null;
  const displayLevels = Array.isArray(targetModel?.displayLevels)
    ? targetModel.displayLevels
    : [];

  if (!targetModel || !displayLevels.length) return null;

  const localSupport = targetModel?.localSupportWatch || null;

  return (
    <div
      style={{
        border: "1px solid #31512c",
        borderRadius: 10,
        padding: 7,
        background: "#081509",
        display: "flex",
        flexDirection: "column",
        gap: 5,
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
        <div style={{ fontWeight: 1000, fontSize: FS.micro, color: "#86efac" }}>
          {targetModelTitle(state)}
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
  {displayLevels.map((level, idx) => (
    <div
      key={`${level?.label || "fib"}-${idx}`}
      style={{
        border: "1px solid #1f3d20",
        borderRadius: 8,
        padding: "5px 6px",
        background: "#061108",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#86efac",
          fontSize: FS.micro,
          fontWeight: 1000,
          lineHeight: 1,
        }}
      >
        {level?.label || "—"}
      </div>
      <div
        style={{
          color: "#e5e7eb",
          fontSize: FS.small,
          fontWeight: 1000,
          lineHeight: 1.1,
        }}
      >
        {fmt2(level?.price)}
      </div>
    </div>
  ))}
</div>

      {localSupport?.lo != null && localSupport?.hi != null ? (
        <KV
          label="Local Watch"
          value={`${fmt2(localSupport.lo)}–${fmt2(localSupport.hi)}`}
        />
      ) : null}

      {targetModel?.nextTarget != null ? (
        <KV label="Next" value={fmt2(targetModel.nextTarget)} />
      ) : null}
    </div>
  );
}

function NestedCorrectionMiniBlock({ context }) {
  if (!context?.active) return null;

  return (
    <div
      style={{
        border: "1px solid #4c1d95",
        borderRadius: 10,
        padding: 7,
        background: "#120a22",
        display: "flex",
        flexDirection: "column",
        gap: 5,
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
        <div style={{ fontWeight: 1000, fontSize: FS.micro, color: "#c4b5fd" }}>
          NESTED CORRECTION CONTEXT
        </div>
        <Badge text="STRUCTURE" tone="watch" />
      </div>

      <KV
        label="Parent"
        value={
          context.parentDegree && context.parentActiveLeg
            ? `${prettyEnum(context.parentDegree)} ${context.parentActiveLeg}`
            : prettyEnum(context.parentRole || "—")
        }
      />

      <KV
        label="Role"
        value={prettyEnum(context.childPurpose || context.tacticalFocus || "—")}
      />

      <KV
        label="Path"
        value={prettyEnum(context.expectedPath || "—")}
      />

      <KV
        label="Current"
        value={prettyEnum(context.currentChildLeg || context.tacticalFocus || "—")}
      />

      <KV
        label="Next"
        value={prettyEnum(context.nextExpected || context.tacticalFocus || "—")}
      />
    </div>
  );
}

function WaveDegreeMiniCard({ state }) {
  const active = state?.active === true;
  const headline = state?.headline || `${prettyEnum(state?.degree)} unavailable`;
  const action = state?.action || "NO_ACTION";
  const parent =
    state?.parentDegree && state?.parentWave
      ? `${prettyEnum(state.parentDegree)} ${state.parentWave}`
      : "—";
  const last = latestCompletedMark(state?.marks || {});
  const preferredTriangle =
    state?.correctionModels?.models?.abcdeTriangle?.active === true
      ? state.correctionModels.models.abcdeTriangle
      : null;

  const correctionModel =
    String(state?.degree || "").toLowerCase() === "minor" && preferredTriangle
      ? preferredTriangle
      : state?.correctionModel || null;
  return (
    <div
      style={{
        background: active ? "#101720" : "#0b0f16",
        border: active ? "1px solid #2563eb" : "1px solid #1f2937",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: active ? "0 0 14px rgba(37,99,235,.22)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.small, color: "#e5e7eb" }}>
            {prettyEnum(state?.degree)}
          </div>
          <div style={{ fontWeight: 900, fontSize: FS.micro, color: "#9ca3af" }}>
            {state?.tf || "—"}
          </div>
        </div>

        <Badge
          text={state?.activeWave || "—"}
          tone={active ? "watch" : "wait"}
        />
      </div>

      <div
        style={{
          fontWeight: 1000,
          fontSize: FS.small,
          color: active ? "#bfdbfe" : "#9ca3af",
          lineHeight: 1.15,
        }}
      >
        {headline}
      </div>

      <KV label="Stage" value={prettyEnum(state?.stage)} />
      <KV label="Parent" value={parent} />
      <KV label="Action" value={prettyEnum(action)} />

      <KV
        label="Last Mark"
        value={
          last
            ? `${last.wave} ${fmt2(last.mark.price)}`
            : "—"
        }
      />

       <TargetModelMiniBlock state={state} />
       <NestedCorrectionMiniBlock context={state?.nestedCorrectionContext} />
       <CorrectionModelMiniBlock model={correctionModel} />
         
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
          <WaveDegreeMiniCard
            key={degree}
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
