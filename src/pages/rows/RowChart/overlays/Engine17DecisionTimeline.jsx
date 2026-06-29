// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

/* =========================
   Visual System
========================= */

const TIMELINE_FONT =
  '"Trebuchet MS", "Lucida Grande", "Segoe UI", Arial, sans-serif';

const FONT_REGULAR = 400;
const FONT_MEDIUM = 400;

const CARD_BG = "rgba(6,10,20,0.94)";
const CARD_BG_STRONG = "rgba(6,10,20,0.96)";
const SOFT_TEXT = "#dbeafe";
const MAIN_TEXT = "#f8fafc";
const MUTED_TEXT = "#94a3b8";

const C_TARGET_HIT_LABELS = {
  c100: "C 1.000 hit",
  c1272: "C 1.272 hit",
  c1618: "C 1.618 hit",
  c200: "C 2.000 hit",
  c2618: "C 2.618 hit",
};

/* =========================
   Formatters
========================= */

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function formatText(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value).replaceAll("_", " ");
}

function formatUpper(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value).toUpperCase().replaceAll("_", " ");
}

function formatNumber(value, digits = 2, fallback = "—") {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : fallback;
}

function formatScore(value, fallback = "—") {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toString() : fallback;
}

function formatBool(value, fallback = "—") {
  if (value === true) return "YES";
  if (value === false) return "NO";
  return fallback;
}

function titleCase(value, fallback = "—") {
  if (value == null || value === "") return fallback;

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactJoin(parts, separator = " | ") {
  return parts.filter(Boolean).join(separator);
}

function severityColor(severity) {
  if (severity === "danger") return "#fb7185";
  if (severity === "warning") return "#fbbf24";
  if (severity === "bullish") return "#22c55e";
  if (severity === "purple") return "#c084fc";
  if (severity === "blue") return "#38bdf8";
  if (severity === "teal") return "#2dd4bf";
  return "#cbd5e1";
}

function severityBorder(severity) {
  if (severity === "danger") return "rgba(244,63,94,0.62)";
  if (severity === "warning") return "rgba(251,191,36,0.58)";
  if (severity === "bullish") return "rgba(34,197,94,0.46)";
  if (severity === "purple") return "rgba(192,132,252,0.48)";
  if (severity === "blue") return "rgba(56,189,248,0.48)";
  if (severity === "teal") return "rgba(45,212,191,0.48)";
  return "rgba(148,163,184,0.34)";
}

function severityBackground(severity) {
  if (severity === "danger") return "rgba(127,29,29,0.15)";
  if (severity === "warning") return "rgba(113,63,18,0.14)";
  if (severity === "bullish") return "rgba(20,83,45,0.13)";
  if (severity === "purple") return "rgba(88,28,135,0.13)";
  if (severity === "blue") return "rgba(12,74,110,0.13)";
  if (severity === "teal") return "rgba(19,78,74,0.13)";
  return "rgba(15,23,42,0.42)";
}

/* =========================
   Data selectors
========================= */

function getFib(overlayData) {
  return overlayData?.fib || overlayData || {};
}

function getStrategyRoot(fib) {
  return fib?.strategy || fib || {};
}

function getEngine22WaveStrategy(fib) {
  const root = getStrategyRoot(fib);

  return (
    root?.engine22WaveStrategy ||
    fib?.engine22WaveStrategy ||
    root?.engine22 ||
    null
  );
}

function getPostDownImpulseBounce(fib) {
  return (
    getEngine22WaveStrategy(fib)?.waveFibState?.lifecycle?.postAbcReset
      ?.postDownImpulseBounce || null
  );
}

function getPossibleW5Up(fib) {
  return (
    getEngine22WaveStrategy(fib)?.waveFibState?.lifecycle?.postAbcReset
      ?.possibleW5Up || null
  );
}

function isPossibleW5UpComplete(possibleW5Up) {
  return (
    possibleW5Up?.w5Complete === true ||
    String(possibleW5Up?.state || "").toUpperCase() ===
      "POSSIBLE_MINOR_W5_UP_COMPLETE_POST_W5_PULLBACK_WATCH"
  );
}

function getWaveOpportunity(fib) {
  const waveStrategy = getEngine22WaveStrategy(fib);

  return (
    waveStrategy?.waveOpportunity ||
    fib?.waveOpportunity ||
    getStrategyRoot(fib)?.waveOpportunity ||
    null
  );
}

function getBackendTimelineRead(fib) {
  return getEngine22WaveStrategy(fib)?.timelineRead || null;
}

function getBackendTradeContextSummary(fib) {
  return getEngine22WaveStrategy(fib)?.tradeContextSummary || null;
}

function getCurrentLifecycleState(fib) {
  const waveStrategy = getEngine22WaveStrategy(fib);

  return (
    waveStrategy?.currentLifecycleState ||
    waveStrategy?.waveFibState?.currentLifecycleState ||
    null
  );
}

function getBackendTimelineSection(fib, title) {
  const sections = getBackendTimelineRead(fib)?.mainSections;

  if (!Array.isArray(sections)) return null;

  return (
    sections.find(
      (section) => String(section?.title || "").trim() === title
    ) || null
  );
}

function getEngine15Decision(fib) {
  const root = getStrategyRoot(fib);

  return (
    root?.engine15Decision ||
    fib?.engine15Decision ||
    root?.engine15ES ||
    null
  );
}

function getFinalPermission(fib) {
  const root = getStrategyRoot(fib);

  return root?.permission || fib?.permission || root?.finalPermission || null;
}

function getConfluence(fib) {
  const root = getStrategyRoot(fib);

  return (
    root?.confluence ||
    fib?.confluence ||
    root?.engine5 ||
    fib?.engine5 ||
    null
  );
}

function getEngine5Reaction(fib) {
  return getConfluence(fib)?.components?.engine3Reaction || null;
}

function getEngine5Volume(fib) {
  const confluence = getConfluence(fib);

  return (
    confluence?.context?.volume ||
    confluence?.components?.engine4Volume ||
    fib?.confluence?.context?.volume ||
    getStrategyRoot(fib)?.confluence?.context?.volume ||
    null
  );
}

function getEngine22LifecycleParticipation(fib) {
  const confluence = getConfluence(fib);

  return (
    confluence?.context?.volume?.engine22LifecycleParticipation ||
    fib?.confluence?.context?.volume?.engine22LifecycleParticipation ||
    getStrategyRoot(fib)?.confluence?.context?.volume?.engine22LifecycleParticipation ||
    null
  );
}

function getEngine4FastImbalanceParticipation(fib) {
  const confluence = getConfluence(fib);

  return (
    confluence?.context?.volume?.engine4FastImbalanceParticipation ||
    fib?.confluence?.context?.volume?.engine4FastImbalanceParticipation ||
    getStrategyRoot(fib)?.confluence?.context?.volume?.engine4FastImbalanceParticipation ||
    null
  );
}

function getEngine5Timing(fib) {
  const confluence = getConfluence(fib);

  return (
    confluence?.timingContext ||
    confluence?.analytics?.engine5?.timingContext ||
    fib?.timingContext ||
    null
  );
}

function getTargets(waveOpportunity) {
  const targets = waveOpportunity?.targets || {};

  return [
    ["1.000", targets.e100],
    ["1.272", targets.e1272],
    ["1.618", targets.e1618],
    ["2.000", targets.e200],
    ["2.618", targets.e2618],
  ].filter(([, price]) => price != null);
}

function getPostDownImpulseBounceTargets(postBounce) {
  const targets = postBounce?.cUpTargets || {};

  return [
    ["C 1.000", targets.c100],
    ["C 1.272", targets.c1272],
    ["C 1.618", targets.c1618],
    ["C 2.000", targets.c200],
    ["C 2.618", targets.c2618],
  ].filter(([, price]) => price != null);
}

function formatPostBounceTargetHit(postBounce) {
  const hit = String(
    postBounce?.cProgress?.highestTargetHit || ""
  ).toLowerCase();

  return C_TARGET_HIT_LABELS[hit] || "No C-up target hit yet";
}

function isPostMinor5BounceCLegActive(postBounce) {
  const state = String(postBounce?.state || "").toUpperCase();

  return [
    "POST_MINOR_5_BOUNCE_C_LEG_ACTIVE",
    "POST_MINOR_5_BOUNCE_B_MARKED_C_UP_WATCH",
    "POST_MINOR_5_BOUNCE_C_COMPLETE_HTF_DECISION_WATCH",
  ].includes(state);
}

function getPostBounceTargetMeta() {
  return [
    { key: "c100", label: "C 1.000" },
    { key: "c1272", label: "C 1.272" },
    { key: "c1618", label: "C 1.618" },
    { key: "c200", label: "C 2.000" },
    { key: "c2618", label: "C 2.618" },
  ];
}

function getPostBounceTargetSummary(postBounce) {
  const targets = postBounce?.cUpTargets || {};
  const meta = getPostBounceTargetMeta()
    .map((target) => ({
      ...target,
      price: Number(targets[target.key]),
    }))
    .filter((target) => Number.isFinite(target.price));

  if (!meta.length) {
    return {
      hitKey: null,
      hitLabel: null,
      hitPrice: null,
      nextKey: null,
      nextLabel: null,
      nextPrice: null,
      targetsText: "Corrective C-up targets unavailable",
      currentHigh: null,
    };
  }

  const rawHit = String(
    postBounce?.cProgress?.highestTargetHit || ""
  ).toLowerCase();

  const currentHigh = Number(
    postBounce?.cProgress?.activeHigh ??
      postBounce?.cProgress?.price ??
      postBounce?.currentPrice
  );

  let hitIndex = meta.findIndex((target) => target.key === rawHit);

  if (hitIndex < 0 && Number.isFinite(currentHigh)) {
    for (let idx = 0; idx < meta.length; idx += 1) {
      if (currentHigh >= meta[idx].price) hitIndex = idx;
    }
  }

  const hit = hitIndex >= 0 ? meta[hitIndex] : null;
  const next = meta.find((target, idx) => {
    if (hitIndex >= 0) return idx > hitIndex;
    if (Number.isFinite(currentHigh)) return target.price > currentHigh;
    return idx === 0;
  });

  let targetsText;

  if (hit && next) {
    targetsText = `Hit ${hit.label} @ ${formatNumber(
      hit.price
    )} → Next pullback: ${next.label} @ ${formatNumber(next.price)}`;
  } else if (hit && !next) {
    targetsText = `Hit ${hit.label} @ ${formatNumber(
      hit.price
    )} → No higher C-up target`;
  } else if (next) {
    targetsText = `Watching ${next.label} @ ${formatNumber(next.price)}`;
  } else {
    targetsText = "Corrective C-up targets unavailable";
  }

  return {
    hitKey: hit?.key || null,
    hitLabel: hit?.label || null,
    hitPrice: hit?.price ?? null,
    nextKey: next?.key || null,
    nextLabel: next?.label || null,
    nextPrice: next?.price ?? null,
    targetsText,
    currentHigh: Number.isFinite(currentHigh) ? currentHigh : null,
  };
}


function getPossibleW5PullbackMeta() {
  return [
    { key: "r236", label: "23.6%" },
    { key: "r382", label: "38.2%" },
    { key: "r500", label: "50.0%" },
    { key: "r618", label: "61.8%" },
    { key: "r786", label: "78.6%" },
  ];
}

function getPossibleW5PullbackLevels(possibleW5Up) {
  const levels = possibleW5Up?.pullbackLevelsFromW5 || {};

  return getPossibleW5PullbackMeta()
    .map((level) => ({
      ...level,
      price: Number(levels[level.key]),
    }))
    .filter((level) => Number.isFinite(level.price));
}

function getPossibleW5PullbackSummary(possibleW5Up) {
  const levels = getPossibleW5PullbackLevels(possibleW5Up);
  const currentPrice = Number(
    possibleW5Up?.priceProgress?.currentPrice ?? possibleW5Up?.currentPrice
  );
  const pointsOffHigh = Number(possibleW5Up?.priceProgress?.pointsOffHigh);

  if (!levels.length) {
    return {
      hitKey: null,
      hitLabel: null,
      hitPrice: null,
      nextKey: null,
      nextLabel: null,
      nextPrice: null,
      targetsText: "Post-W5 pullback levels unavailable",
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
      pointsOffHigh: Number.isFinite(pointsOffHigh) ? pointsOffHigh : null,
    };
  }

  let hitIndex = -1;

  if (Number.isFinite(currentPrice)) {
    for (let idx = 0; idx < levels.length; idx += 1) {
      // Pullback levels from a W5 high are hit as price moves DOWN through them.
      if (currentPrice <= levels[idx].price) hitIndex = idx;
    }
  }

  const hit = hitIndex >= 0 ? levels[hitIndex] : null;
  const next = hitIndex >= 0 ? levels[hitIndex + 1] || null : levels[0] || null;

  let targetsText;

  if (hit && next) {
    targetsText = `Hit ${hit.label} @ ${formatNumber(
      hit.price
    )} → Next pullback: ${next.label} @ ${formatNumber(next.price)}`;
  } else if (hit && !next) {
    targetsText = `Hit ${hit.label} @ ${formatNumber(
      hit.price
    )} → Failure warning below ${formatNumber(hit.price)}`;
  } else if (next) {
    targetsText = `Next pullback: ${next.label} @ ${formatNumber(next.price)}`;
  } else {
    targetsText = "Post-W5 pullback levels unavailable";
  }

  return {
    hitKey: hit?.key || null,
    hitLabel: hit?.label || null,
    hitPrice: hit?.price ?? null,
    nextKey: next?.key || null,
    nextLabel: next?.label || null,
    nextPrice: next?.price ?? null,
    targetsText,
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
    pointsOffHigh: Number.isFinite(pointsOffHigh) ? pointsOffHigh : null,
  };
}

function formatZone(zone) {
  if (!zone || typeof zone !== "object") return "—";
  if (zone.lo != null && zone.hi != null) {
    return `${formatNumber(zone.lo)}–${formatNumber(zone.hi)}`;
  }
  if (zone.level != null) return formatNumber(zone.level);
  return "—";
}

function isWatchState(value) {
  const v = String(value || "").toUpperCase();
  return ["WATCH", "NEAR", "PREP", "ARMING", "POST_EXTENSION"].includes(v);
}

function isReadyState(value) {
  const v = String(value || "").toUpperCase();
  return ["READY", "CONFIRMED", "TRIGGERED"].includes(v);
}

function isDangerChase(value) {
  const v = String(value || "").toUpperCase();
  return v === "HIGH" || v === "EXTREME";
}

/* =========================
   Fallback headline builders
========================= */

function buildFallbackHeadline({ waveOpportunity, engine15 }) {
  const degree = titleCase(waveOpportunity?.degree, "Wave");
  const setup = formatUpper(waveOpportunity?.setupType, "W3/W5");
  const readiness = formatUpper(
    engine15?.readinessLabel || waveOpportunity?.readiness,
    "WATCH"
  );
  const chaseRisk = formatUpper(waveOpportunity?.chaseRisk, "");
  const timing = formatUpper(waveOpportunity?.timing, "");

  if (isDangerChase(chaseRisk)) {
    return `${degree} ${setup} ${readiness} — NO CHASE`;
  }

  if (timing.includes("POST")) {
    return `${degree} ${setup} ${readiness} — POST EXTENSION`;
  }

  return `${degree} ${setup} ${readiness}`;
}

function buildFallbackSubheadline({ waveOpportunity, engine15 }) {
  if (waveOpportunity?.summary) return waveOpportunity.summary;
  if (engine15?.summary) return engine15.summary;

  return "Waiting for a valid Wave 3 / Wave 5 opportunity and final confirmation.";
}

function buildBadges({ waveOpportunity, engine15, permission }) {
  const badges = [];

  badges.push({
    label: waveOpportunity?.symbol || engine15?.symbol || "ES",
    severity: "blue",
  });

  if (waveOpportunity?.degree) {
    badges.push({
      label: `${titleCase(waveOpportunity.degree)} Degree`,
      severity: "neutral",
    });
  }

  if (waveOpportunity?.direction || engine15?.direction) {
    const direction = waveOpportunity?.direction || engine15?.direction;

    badges.push({
      label: formatUpper(direction),
      severity:
        String(direction).toUpperCase() === "LONG" ? "bullish" : "danger",
    });
  }

  if (engine15?.readinessLabel || waveOpportunity?.readiness) {
    const readiness = engine15?.readinessLabel || waveOpportunity?.readiness;

    badges.push({
      label: formatUpper(readiness),
      severity: isReadyState(readiness) ? "bullish" : "warning",
    });
  }

  if (waveOpportunity?.timing) {
    badges.push({
      label: formatUpper(waveOpportunity.timing),
      severity:
        String(waveOpportunity.timing).toUpperCase().includes("POST") ||
        String(waveOpportunity.timing).toUpperCase().includes("LATE")
          ? "warning"
          : "neutral",
    });
  }

  if (waveOpportunity?.chaseRisk) {
    badges.push({
      label: `${formatUpper(waveOpportunity.chaseRisk)} CHASE RISK`,
      severity: isDangerChase(waveOpportunity.chaseRisk)
        ? "danger"
        : "warning",
    });
  }

  if (permission?.permission) {
    badges.push({
      label: `PERMISSION ${formatUpper(permission.permission)}`,
      severity:
        String(permission.permission).toUpperCase() === "ALLOW"
          ? "bullish"
          : String(permission.permission).toUpperCase() === "REDUCE"
          ? "purple"
          : "danger",
    });
  }

  return badges;
}

function buildCurrentLifecycleBadges(currentLifecycleState) {
  if (!currentLifecycleState) return [];

  const markMaturity = currentLifecycleState.markMaturity || null;
  const lifecycleOverride = isCurrentLifecycleDisplayOverride(
    currentLifecycleState
  );

  return [
    markMaturity?.symbol
      ? {
          label: markMaturity.symbol,
          severity: "blue",
        }
      : null,
    currentLifecycleState.degree
      ? {
          label: `${titleCase(currentLifecycleState.degree)} Degree`,
          severity: "neutral",
        }
      : null,
    lifecycleOverride
      ? {
          label: "BIAS LONG AFTER CONFIRMATION",
          severity: "bullish",
        }
      : currentLifecycleState.direction
      ? {
          label: formatUpper(currentLifecycleState.direction),
          severity:
            String(currentLifecycleState.direction).toUpperCase() === "LONG"
              ? "bullish"
              : "neutral",
        }
      : null,
    currentLifecycleState.readiness
      ? {
          label: formatUpper(currentLifecycleState.readiness),
          severity: isReadyState(currentLifecycleState.readiness)
            ? "bullish"
            : "warning",
        }
      : null,
    markMaturity?.status
      ? {
          label: `W2 ${formatUpper(markMaturity.status)}`,
          severity:
            String(markMaturity.status).toUpperCase() === "CONFIRMED"
              ? "bullish"
              : "warning",
        }
      : null,
    lifecycleOverride
      ? {
          label: "NO CHASE",
          severity: "warning",
        }
      : null,
    currentLifecycleState.noExecution === true
      ? {
          label: "NO EXECUTION",
          severity: "purple",
        }
      : null,
  ].filter(Boolean);
}
function isCurrentLifecycleDisplayOverride(currentLifecycleState) {
  const key = String(currentLifecycleState?.key || "").toUpperCase();
  const markStatus = String(
    currentLifecycleState?.markMaturity?.status || ""
  ).toUpperCase();

  return (
    key.includes("INTERMEDIATE_W2_C_LOW_REACTION") ||
    key.includes("INTERMEDIATE_W1_COMPLETE_W2_STILL_FORMING") ||
    markStatus === "CANDIDATE"
  );
}

function buildPermissionBadge(permission) {
  if (!permission?.permission) return null;

  return {
    label: `PERMISSION ${formatUpper(permission.permission)}`,
    severity:
      String(permission.permission).toUpperCase() === "ALLOW"
        ? "bullish"
        : String(permission.permission).toUpperCase() === "REDUCE"
        ? "purple"
        : "danger",
  };
}

function getLifecycleWatchLevels(currentLifecycleState, fib) {
  const markMaturity = currentLifecycleState?.markMaturity || {};
  const reference = currentLifecycleState?.confirmationContext?.reference || {};
  const progress = reference?.priceProgress?.intermediate || {};
  const retraceLevels = progress?.retraceLevels?.levels || {};

  const trigger10m = fib?.engine16?.regimeLayers?.trigger10m || {};

  const ema10 = Number(trigger10m?.ema10);
  const ema20 = Number(trigger10m?.ema20);

  const r618 = Number(retraceLevels?.r618);
  const r786 = Number(retraceLevels?.r786);

  const currentPrice = Number(reference?.currentPrice);
  const w2Candidate = Number(markMaturity?.price);

  const reclaimZone =
    Number.isFinite(ema10) && Number.isFinite(ema20)
      ? `${formatNumber(Math.max(ema10, ema20))} → ${formatNumber(
          Math.min(ema10, ema20)
        )}`
      : "—";

  const controlledPullback =
    Number.isFinite(r618) && Number.isFinite(r786)
      ? `${formatNumber(r618)} → ${formatNumber(r786)}`
      : "—";

  const mustHold =
    Number.isFinite(w2Candidate)
      ? `7400.00 → ${formatNumber(w2Candidate)}`
      : "7400.00 → 7415.25";

  return {
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
    reclaimZone,
    controlledPullback,
    mustHold,
  };
}

function buildLifecycleNextStepsSection(currentLifecycleState, fib) {
  if (!isCurrentLifecycleDisplayOverride(currentLifecycleState)) return null;

  const levels = getLifecycleWatchLevels(currentLifecycleState, fib);

  const checklist = [
    levels.currentPrice != null
      ? `Current price: ${formatNumber(levels.currentPrice)}`
      : null,
    `Watch 10m reclaim hold: ${levels.reclaimZone}`,
    `Controlled pullback watch: ${levels.controlledPullback}`,
    `Must hold sweep zone: ${levels.mustHold}`,
    "Need Engine 3 reaction confirmation",
    "Need Engine 4 clean participation",
    "Engine 15ES must upgrade from WATCH to READY",
    "No chase after vertical reclaim. No execution.",
  ].filter(Boolean);

  return {
    number: 6,
    icon: "✓",
    title: "Next Action Levels",
    severity: "teal",
    checklist,
  };
}

function buildCurrentLifecycleStateSection(currentLifecycleState, fib = null) {
  if (!currentLifecycleState) return null;

  const markMaturity = currentLifecycleState.markMaturity || {};
  const basis = asArray(markMaturity.basis);
  const needs = asArray(currentLifecycleState.needs);
  const levels = getLifecycleWatchLevels(currentLifecycleState, fib);

  const key = String(currentLifecycleState.key || "").toUpperCase();

  const isCLowReaction = key.includes("C_LOW_REACTION");
  const isW2Candidate =
    String(markMaturity.status || "").toUpperCase() === "CANDIDATE";

  const currentTask = isCLowReaction
    ? "Wait for reclaim hold / controlled pullback"
    : "Wait for C-low reaction / reclaim";

  return {
    number: 1,
    icon: "〽",
    title: "Current Lifecycle — Engine 22",
    severity: isCLowReaction ? "teal" : isW2Candidate ? "warning" : "bullish",
    fields: [
      [
        "Lifecycle",
        isCLowReaction
          ? "W2 C-low reaction"
          : formatText(currentLifecycleState.key, "UNKNOWN"),
      ],
      ["W2 Status", formatUpper(markMaturity.status, "—")],
      ["Bias", "Long after confirmation"],
      ["Readiness", formatUpper(currentLifecycleState.readiness, "WATCH")],
      ["Current Task", currentTask],
      ["10m Reclaim", levels.reclaimZone],
      ["Controlled Pullback", levels.controlledPullback],
      ["Must Hold", levels.mustHold],
      [
        "Prior Mark",
        markMaturity.previousMark?.price != null
          ? `${formatNumber(markMaturity.previousMark.price)} superseded`
          : "—",
      ],
    ],
    lines: [
      currentLifecycleState.headline || null,
      isCLowReaction
        ? "C-down liquidity sweep / reclaim reaction detected. Do not chase the vertical reclaim."
        : null,
      isW2Candidate
        ? "W2 is still a candidate. Engine 22 is not promoting this to W3 launch yet."
        : null,
      basis.includes("B_WAVE_SIDEWAYS_CONSOLIDATION")
        ? "B-wave sideways consolidation detected — this is not clean W3 behavior."
        : null,
      basis.includes("B_WAVE_QUICK_POP_LIQUIDITY_TRAP")
        ? "Quick pop after consolidation can be a B-wave liquidity trap."
        : null,
      levels.reclaimZone !== "—"
        ? `First watch: reclaim hold near ${levels.reclaimZone}.`
        : null,
      levels.controlledPullback !== "—"
        ? `Controlled pullback watch: ${levels.controlledPullback}.`
        : null,
      `Must hold the sweep zone: ${levels.mustHold}.`,
      needs.length ? `Needs: ${needs.map(formatText).join(", ")}` : null,
      "No chase. No automatic long. No execution.",
    ].filter(Boolean),
  };
}
/* =========================
   Shared section builders
========================= */

function buildBackendTimelineSection(section) {
  if (!section) return null;

  const lines = Array.isArray(section.lines)
    ? section.lines.filter(Boolean)
    : [];

  if (!lines.length) return null;

  return {
    number: 0,
    icon: "◷",
    title: section.title || "Context",
    severity: section.severity || "blue",
    fields: [],
    lines,
  };
}

function buildWaveOpportunitySection(waveOpportunity, fib) {
  if (!waveOpportunity) {
    return {
      number: 1,
      icon: "〽",
      title: "Wave Opportunity — Engine 22",
      severity: "warning",
      fields: [],
      lines: [
        "Engine 22 waveOpportunity is unavailable.",
        "Waiting for a valid Wave 3 / Wave 5 setup.",
      ],
    };
  }

  const possibleW5Up = getPossibleW5Up(fib);
  const possibleW5UpComplete = isPossibleW5UpComplete(possibleW5Up);
  const possibleW5Summary = getPossibleW5PullbackSummary(possibleW5Up);

  const postBounce = getPostDownImpulseBounce(fib);
  const postBounceActive = isPostMinor5BounceCLegActive(postBounce);
  const postBounceTargetSummary = getPostBounceTargetSummary(postBounce);

  const normalTargetsText = getTargets(waveOpportunity)
    .map(([level, price]) => `${level}: ${formatNumber(price)}`)
    .join("  |  ");

  const directionText = possibleW5UpComplete
    ? "NONE — WATCH PULLBACK / RECLAIM"
    : postBounceActive
    ? "NONE — WATCH C-UP / HTF DECISION"
    : formatUpper(waveOpportunity.direction, "NONE");

  const targetsLabel = possibleW5UpComplete ? "Targets / Pullback" : "Targets";

  const targetsText = possibleW5UpComplete
    ? possibleW5Summary.targetsText
    : postBounceActive
    ? postBounceTargetSummary.targetsText
    : normalTargetsText || "—";

  return {
    number: 1,
    icon: "〽",
    title: "Wave Opportunity — Engine 22",
    severity: possibleW5UpComplete || postBounceActive
      ? "warning"
      : isDangerChase(waveOpportunity.chaseRisk)
      ? "warning"
      : "bullish",
    fields: [
      ["Setup", formatUpper(waveOpportunity.setupType, "NONE")],
      ["Raw Setup", formatUpper(waveOpportunity.rawSetup, "—")],
      ["Degree", titleCase(waveOpportunity.degree, "—")],
      ["Direction", directionText],
      ["Readiness", formatUpper(waveOpportunity.readiness, "UNKNOWN")],
      ["Timing", formatUpper(waveOpportunity.timing, "UNKNOWN")],
      ["Chase Risk", formatUpper(waveOpportunity.chaseRisk, "UNKNOWN")],
      [targetsLabel, targetsText],
    ],
    lines: [
      possibleW5UpComplete
        ? "Summary: Possible Minor W5 up is marked complete. Watch post-W5 pullback reaction / reclaim zones."
        : waveOpportunity.summary
        ? `Summary: ${waveOpportunity.summary}`
        : "Summary: Waiting for Engine 22 wave opportunity summary.",
    ],
  };
}

function buildPostAbcBounceSection(tradeContextSummary, waveOpportunity) {
  const abcUp = tradeContextSummary?.abcUp || null;
  const reads = tradeContextSummary?.reads || {};

  if (
    String(abcUp?.state || "").toUpperCase() !==
    "A_UP_MARKED_WAITING_FOR_B_PULLBACK"
  ) {
    return null;
  }

  const preferredBZone = abcUp?.preferredBZone || null;
  const preferredBZoneText =
    preferredBZone?.lo != null && preferredBZone?.hi != null
      ? `${formatNumber(preferredBZone.lo)}–${formatNumber(preferredBZone.hi)}`
      : "—";

  const bLow =
    abcUp.effectiveWaveBLow ??
    abcUp.autoWaveBLow ??
    abcUp.waveBLow ??
    null;

  const extensionTargets = getTargets(waveOpportunity)
    .map(([level, price]) => `${level}: ${formatNumber(price)}`)
    .join("  |  ");   

  return {
    number: 2,
    icon: "〽",
    title: "Post-ABC Bounce Map — Engine 22",
    severity: "warning",
    fields: [
      ["State", formatUpper(abcUp.state)],
      [
        "A Up",
        `${formatNumber(abcUp.originLow)} → ${formatNumber(abcUp.waveAHigh)}`,
      ],
      ["B Low", formatNumber(bLow)],
      ["Preferred B Zone", preferredBZoneText],
      ["Extension Targets", extensionTargets || "—"],
      ["Deep B Support", formatNumber(abcUp.deepBSupport)],
      ["B Status", formatUpper(abcUp.bPullbackStatus, "WAITING")],
    ],
    lines: [
      reads.abcUpRead || null,
      reads.bPullbackRead || null,
      abcUp.read || null,
      reads.actionRead ||
        "No chase. No execution. Wait for B pullback hold and reclaim confirmation.",
    ].filter(Boolean),
  };
}

function buildPossibleW5UpCompleteSection(fib) {
  const possibleW5Up = getPossibleW5Up(fib);

  if (!isPossibleW5UpComplete(possibleW5Up)) return null;

  const summary = getPossibleW5PullbackSummary(possibleW5Up);

  return {
    number: 0,
    icon: "〽",
    title: "Possible Minor W5 Up Complete — Engine 22",
    severity: "warning",
    fields: [
      ["Wave Origin", formatNumber(possibleW5Up.originLow)],
      ["W1 High", formatNumber(possibleW5Up.w1High)],
      ["W2 Low", formatNumber(possibleW5Up.w2Low)],
      ["W3 High", formatNumber(possibleW5Up.w3High)],
      ["W4 Low", formatNumber(possibleW5Up.w4Low)],
      ["W5 High", formatNumber(possibleW5Up.w5High)],
      [
        "Current Price",
        summary.currentPrice != null ? formatNumber(summary.currentPrice) : "—",
      ],
      [
        "Off W5 High",
        summary.pointsOffHigh != null
          ? `${formatNumber(summary.pointsOffHigh)} pts`
          : "—",
      ],
      [
        "Current Pullback Fib",
        summary.hitLabel
          ? `${summary.hitLabel} @ ${formatNumber(summary.hitPrice)}`
          : "None hit yet",
      ],
      [
        "Next Pullback Watch",
        summary.nextLabel
          ? `${summary.nextLabel} @ ${formatNumber(summary.nextPrice)}`
          : "No deeper pullback level",
      ],
    ],
    lines: [
      possibleW5Up.read ||
        "Possible Minor W5 up is marked complete. Watch pullback fib levels off the W5 high for reaction / entry zones.",
      "These are pullback reaction / entry planning zones, not automatic entry signals.",
      "Watch pullback reaction / reclaim. No chase. No automatic long. No automatic short. No execution.",
    ],
  };
}

function buildPostMinor5CorrectiveBounceSection(fib) {
  const postBounce = getPostDownImpulseBounce(fib);

  if (!isPostMinor5BounceCLegActive(postBounce)) return null;

  const cHigh =
    Number(postBounce?.waveCHigh) > 0
      ? formatNumber(postBounce.waveCHigh)
      : "not marked yet";

  const targetSummary = getPostBounceTargetSummary(postBounce);

  return {
    number: 0,
    icon: "〽",
    title: "Post-Minor-5 Corrective Bounce — Engine 22",
    severity: "warning",
    fields: [
      ["Origin", formatNumber(postBounce.originLow)],
      ["A High", formatNumber(postBounce.waveAHigh)],
      ["B Low", formatNumber(postBounce.waveBLow)],
      ["C High", cHigh],
      [
        "Correction Type",
        compactJoin(
          [
            formatUpper(postBounce.correctionFamily, "—"),
            formatUpper(postBounce.correctionType, "—"),
          ],
          " / "
        ),
      ],
      [
        "B Retrace",
        postBounce.bRetracePct != null
          ? `${formatNumber(postBounce.bRetracePct, 0)}%`
          : "—",
      ],
      [
        "Current C-Up High",
        targetSummary.currentHigh != null
          ? formatNumber(targetSummary.currentHigh)
          : "—",
      ],
      [
        "Highest Target Hit",
        targetSummary.hitLabel
          ? `${targetSummary.hitLabel} @ ${formatNumber(targetSummary.hitPrice)}`
          : "None yet",
      ],
      [
        "Next C-Up Target",
        targetSummary.nextLabel
          ? `${targetSummary.nextLabel} @ ${formatNumber(targetSummary.nextPrice)}`
          : "No higher C-up target",
      ],
    ],
    lines: [
      postBounce.read ||
        "Post-Minor-5 corrective bounce is active. Read-only watch.",
      "Watch C-up maturity / HTF decision. Do not chase.",
      "No automatic long. No automatic short. No execution.",
    ],
  };
}

function buildEngine15Section(engine15, currentLifecycleState = null) {
  const lifecycleOwnsDisplay =
    isCurrentLifecycleDisplayOverride(currentLifecycleState);

  const lifecycleKey = currentLifecycleState?.key || null;
  const lifecycleAction = currentLifecycleState?.action || null;
  const lifecycleDirection = currentLifecycleState?.direction || null;
  const lifecycleNeeds = asArray(currentLifecycleState?.needs);

  if (!engine15 && !currentLifecycleState) {
    return {
      number: 3,
      icon: "▣",
      title: "Setup Readiness — Engine 15ES",
      severity: "warning",
      fields: [],
      lines: ["Engine 15ES decision unavailable."],
    };
  }

  const rawStrategy = engine15?.strategyType || "NONE";
  const rawDirection = engine15?.direction || "NONE";
  const rawAction = engine15?.action || "NO_ACTION";
  const rawReadiness = engine15?.readinessLabel || "WAIT";

  const engine15LooksEmpty =
    String(rawStrategy || "").toUpperCase() === "NONE" ||
    String(rawAction || "").toUpperCase() === "NO_ACTION" ||
    String(rawDirection || "").toUpperCase() === "NONE";

  const displayStrategy =
    lifecycleOwnsDisplay && engine15LooksEmpty
      ? lifecycleKey
      : rawStrategy;

  const displayDirection =
    lifecycleOwnsDisplay && engine15LooksEmpty
      ? "LONG_AFTER_CONFIRMATION"
      : rawDirection;

  const displayAction =
    lifecycleOwnsDisplay && engine15LooksEmpty
      ? lifecycleAction
      : rawAction;

  const displayReadiness =
    engine15?.readinessLabel ||
    currentLifecycleState?.readiness ||
    rawReadiness;

  const displayNext =
    lifecycleOwnsDisplay
      ? "WAIT_FOR_ENGINE3_ENGINE4_CONFIRMATION"
      : engine15?.nextSetupType ||
        engine15?.lifecycle?.nextFocus ||
        "WAIT_FOR_CONFIRMATION";

  const displayNeeds =
    asArray(engine15?.needs).length > 0
      ? asArray(engine15.needs)
      : lifecycleNeeds;

  const needsText = displayNeeds.map((need) => formatText(need)).join(", ");

  const qualityText =
    engine15?.qualityScore != null ||
    engine15?.qualityGrade ||
    engine15?.qualityBand
      ? `${formatScore(engine15?.qualityScore)} / ${formatUpper(
          engine15?.qualityGrade || engine15?.qualityBand,
          "—"
        )}`
      : lifecycleOwnsDisplay
      ? "0 / WATCH"
      : "0 / IGNORE";

  return {
    number: 3,
    icon: "▣",
    title: "Setup Readiness — Engine 15ES",
    severity: isReadyState(displayReadiness)
      ? "bullish"
      : isWatchState(displayReadiness)
      ? "blue"
      : "warning",
    fields: [
      ["Readiness", formatUpper(displayReadiness, "UNKNOWN")],
      [
        "Strategy",
        lifecycleOwnsDisplay
          ? "W2 C-LOW REACTION WATCH"
          : formatUpper(displayStrategy, "NONE"),
      ],
      [
        "Direction",
        lifecycleOwnsDisplay
          ? "LONG AFTER CONFIRMATION"
          : formatUpper(displayDirection, "NONE"),
      ],
      ["Action", formatUpper(displayAction, "WATCH")],
      ["Quality", qualityText],
      ["Next", formatUpper(displayNext)],
    ],
    lines: [
      lifecycleOwnsDisplay
        ? "Engine 15ES is watching the Engine 22 W2 C-low reaction state. This is watch-only and not executable."
        : null,
      needsText ? `Needs: ${needsText}` : "Needs: waiting for confirmation.",
    ].filter(Boolean),
  };
}

function buildEngine5Section(fib) {
  const reaction = getEngine5Reaction(fib);
  const volume = getEngine5Volume(fib);
  const timing = getEngine5Timing(fib);

  const reactionText = reaction
    ? compactJoin(
        [
          formatText(reaction.quality, "UNKNOWN"),
          formatText(reaction.direction, ""),
          reaction.confirmed || reaction.cleanReaction
            ? "confirmed"
            : "not confirmed",
        ],
        " / "
      )
    : "Unavailable";

  const volumeText = volume
    ? compactJoin(
        [
          formatText(volume.quality || volume.participationQuality, "UNKNOWN"),
          volume.cleanParticipation
            ? "clean participation"
            : "clean participation not confirmed",
        ],
        " / "
      )
    : "Unavailable";

  const timingText = timing
    ? compactJoin(
        [
          formatText(timing.entryTiming, "UNKNOWN"),
          timing.chaseRisk ? `chase risk ${formatText(timing.chaseRisk)}` : null,
          timing.suggestedAction ? formatText(timing.suggestedAction) : null,
        ],
        " / "
      )
    : "Unavailable";

  const hasWarning =
    volume?.cleanParticipation === false ||
    timing?.moveAlreadyHappened === true ||
    timing?.noChaseContext === true ||
    isDangerChase(timing?.chaseRisk);

  return {
    number: 4,
    icon: "⚗",
    title: "Ingredients — Engine 5",
    severity: hasWarning ? "purple" : "neutral",
    ingredientCards: [
      {
        label: "Reaction",
        value: reactionText,
        good: reaction?.confirmed === true || reaction?.cleanReaction === true,
      },
      {
        label: "Volume",
        value: volumeText,
        good: volume?.cleanParticipation === true,
      },
      {
        label: "Timing",
        value: timingText,
        good:
          timing &&
          timing.moveAlreadyHappened !== true &&
          timing.noChaseContext !== true &&
          !isDangerChase(timing.chaseRisk),
      },
    ],
  };
}

function buildPermissionSection(permission, engine15) {
  if (!permission) {
    return {
      number: 5,
      icon: "⬟",
      title: "Final Permission — Engine 6",
      severity: "warning",
      fields: [],
      lines: ["Engine 6 final permission unavailable."],
    };
  }

  const executable = permission.executable === true;
  const watchOnly = permission.watchOnly === true;

  let permissionLine = "Engine 6 does not allow execution yet.";

  if (executable) {
    permissionLine =
      "Engine 6 allows execution because setup and permission gates passed.";
  } else if (
    String(permission.permission || "").toUpperCase() === "REDUCE" &&
    watchOnly
  ) {
    permissionLine =
      "REDUCE — watch only, no execution. Engine 15ES is WATCH, not READY.";
  } else if (watchOnly) {
    permissionLine =
      "Engine 6 will not allow execution because this is watch only.";
  }

  return {
    number: 5,
    icon: "⬟",
    title: "Final Permission — Engine 6",
    severity: executable ? "bullish" : "purple",
    fields: [
      ["Permission", formatUpper(permission.permission, "UNKNOWN")],
      ["Executable", formatBool(permission.executable)],
      ["Watch Only", formatBool(permission.watchOnly)],
      [
        "Strategy Type",
        formatUpper(permission.strategyType || engine15?.strategyType, "NONE"),
      ],
      [
        "Direction",
        formatUpper(permission.direction || engine15?.direction, "NONE"),
      ],
      [
        "Authority",
        permission.engine15Authority === true
          ? "Engine 15"
          : permission.engine5Authority === true
          ? "Engine 5"
          : "—",
      ],
    ],
    lines: [
      permissionLine,
      asArray(permission.reasonCodes).length
        ? `Reasons: ${asArray(permission.reasonCodes).map(formatText).join(", ")}`
        : null,
    ].filter(Boolean),
  };
}

function buildNextStepsSection({
  waveOpportunity,
  engine15,
  permission,
  fib,
  tradeContextSummary = null,
}) {
  const actionLevels = [];
  const steps = [];

  const waveNeeds = asArray(waveOpportunity?.needs);
  const engine15Needs = asArray(engine15?.needs);
  const permissionReasons = asArray(permission?.reasonCodes);
  const volume = getEngine5Volume(fib);
  const timing = getEngine5Timing(fib);
  const abcUp = tradeContextSummary?.abcUp || null;
  const possibleW5Up = getPossibleW5Up(fib);
  const possibleW5UpComplete = isPossibleW5UpComplete(possibleW5Up);
  const possibleW5Summary = getPossibleW5PullbackSummary(possibleW5Up);
  const postBounce = getPostDownImpulseBounce(fib);
  const postBounceActive = isPostMinor5BounceCLegActive(postBounce);
  const postBounceTargetSummary = getPostBounceTargetSummary(postBounce);

  const engine16 = fib?.engine16 || {};
  const trigger10m = engine16?.regimeLayers?.trigger10m || {};
  const currentPrice = waveOpportunity?.currentPrice || trigger10m?.close || null;

  if (currentPrice != null) {
    actionLevels.push(`Current price: ${formatNumber(currentPrice)}`);
  }

  if (possibleW5UpComplete) {
    if (possibleW5Up?.w5High != null) {
      actionLevels.push(`W5 high: ${formatNumber(possibleW5Up.w5High)}`);
    }

    if (possibleW5Summary.pointsOffHigh != null) {
      actionLevels.push(
        `Off W5 high: ${formatNumber(possibleW5Summary.pointsOffHigh)} pts`
      );
    }

    if (possibleW5Summary.hitLabel) {
      actionLevels.push(
        `Current pullback fib hit: ${possibleW5Summary.hitLabel}`
      );
    }

    if (possibleW5Summary.nextLabel) {
      actionLevels.push(
        `Next pullback watch: ${possibleW5Summary.nextLabel} @ ${formatNumber(
          possibleW5Summary.nextPrice
        )}`
      );
    }

    steps.push("Watch pullback reaction / reclaim");
    steps.push("Do not chase the completed W5 up move");
    steps.push("No automatic long. No execution");
  }

  if (postBounceActive && !possibleW5UpComplete) {
    if (postBounceTargetSummary.currentHigh != null) {
      actionLevels.push(
        `Current C-up high: ${formatNumber(postBounceTargetSummary.currentHigh)}`
      );
    }

    if (postBounceTargetSummary.hitLabel) {
      actionLevels.push(
        `Highest target hit: ${postBounceTargetSummary.hitLabel}`
      );
    }

    if (postBounceTargetSummary.nextLabel) {
      actionLevels.push(
        `Next C-up target: ${postBounceTargetSummary.nextLabel} @ ${formatNumber(
          postBounceTargetSummary.nextPrice
        )}`
      );
    }

    steps.push("Watch C-up maturity / HTF decision");
    steps.push("Do not chase the corrective C-up bounce");
  }

  if (
    String(abcUp?.state || "").toUpperCase() ===
    "A_UP_MARKED_WAITING_FOR_B_PULLBACK"
  ) {
    const bLow =
      abcUp.effectiveWaveBLow ??
      abcUp.autoWaveBLow ??
      abcUp.waveBLow ??
      null;

    if (abcUp?.waveAHigh != null) {
      actionLevels.push(`A high: ${formatNumber(abcUp.waveAHigh)}`);
    }

    if (bLow != null) {
      actionLevels.push(`B low: ${formatNumber(bLow)}`);
    }

    if (abcUp?.preferredBZone?.lo != null && abcUp?.preferredBZone?.hi != null) {
      actionLevels.push(
        `Preferred B zone: ${formatNumber(
          abcUp.preferredBZone.lo
        )}–${formatNumber(abcUp.preferredBZone.hi)}`
      );
    }

    if (abcUp?.deepBSupport != null) {
      actionLevels.push(`Deep B support: ${formatNumber(abcUp.deepBSupport)}`);
    }

    steps.push("Wait for B pullback hold and reclaim");
    steps.push("No chase and no execution");
  }

  if (
    trigger10m?.ema10 != null &&
    trigger10m?.ema20 != null &&
    String(abcUp?.state || "").toUpperCase() !==
      "A_UP_MARKED_WAITING_FOR_B_PULLBACK" &&
    !postBounceActive &&
    !possibleW5UpComplete
  ) {
    actionLevels.push(
      `10m reclaim zone: ${formatNumber(trigger10m.ema10)} → ${formatNumber(
        trigger10m.ema20
      )}`
    );
  }

  if (
    !postBounceActive &&
    !possibleW5UpComplete &&
    (waveNeeds.some((need) => String(need).toUpperCase().includes("NO_CHASE")) ||
      isDangerChase(waveOpportunity?.chaseRisk))
  ) {
    steps.push("Do not chase the current W5 extension");
  }

  if (
    waveNeeds.some((need) => String(need).toUpperCase().includes("PULLBACK")) ||
    engine15Needs.some((need) => String(need).toUpperCase().includes("PULLBACK")) ||
    timing?.suggestedAction
  ) {
    steps.push("Wait for controlled pullback or reclaim");
  }

  if (
    engine15Needs.some((need) => String(need).toUpperCase().includes("10M")) ||
    permissionReasons.some((reason) =>
      String(reason).toUpperCase().includes("RECLAIM")
    )
  ) {
    steps.push("Need 10m EMA10/EMA20 reclaim");
  }

  if (
    engine15Needs.some((need) => String(need).toUpperCase().includes("ENGINE3")) ||
    engine15?.qualityBreakdown?.reactionConfirmed === false
  ) {
    steps.push("Need Engine 3 reaction confirmation");
  }

  if (
    engine15Needs.some((need) => String(need).toUpperCase().includes("ENGINE4")) ||
    volume?.cleanParticipation === false
  ) {
    steps.push("Need Engine 4 clean participation");
  }

  if (!isReadyState(engine15?.readinessLabel)) {
    steps.push("Engine 15ES must upgrade from WATCH to READY");
  }

  if (!actionLevels.length && !steps.length) {
    steps.push("Wait for the next valid Wave 3 or Wave 5 opportunity");
  }

  return {
    number: 6,
    icon: "✓",
    title: "Next Action Levels",
    severity: "teal",
    checklist: [...actionLevels, ...steps].slice(0, 8),
  };
}

/* =========================
   Market Context builders
========================= */
function getReactionContext(fib) {
  const confluence = getConfluence(fib);

  return (
    confluence?.context?.reaction ||
    fib?.confluence?.context?.reaction ||
    getStrategyRoot(fib)?.confluence?.context?.reaction ||
    null
  );
}

function getEngine3FastImbalanceReaction(fib) {
  const reactionContext = getReactionContext(fib);

  return reactionContext?.engine3FastImbalanceReaction || null;
}

function getCurrentLevelActionReaction(fib) {
  const reactionContext = getReactionContext(fib);

  return reactionContext?.currentLevelAction || null;
}

function getPaperScalpReaction(fib) {
  const reactionContext = getReactionContext(fib);

  return reactionContext?.paperScalpReaction || null;
}

function getEngine22LifecycleReaction(fib) {
  const reactionContext = getReactionContext(fib);

  return reactionContext?.engine22LifecycleReaction || null;
}

function getEngine22PullbackReaction(fib) {
  const reactionContext = getReactionContext(fib);

  return reactionContext?.engine22PullbackReaction || null;
}

function getDirectionConflict(primaryDirection, secondaryDirection) {
  const a = String(primaryDirection || "").toUpperCase();
  const b = String(secondaryDirection || "").toUpperCase();

  if (!a || !b) return false;
  if (a === "NEUTRAL" || b === "NEUTRAL") return false;

  return a !== b;
}

function getFastReactionSeverity({ fastReaction, currentLevelAction, paperScalp }) {
  const fastDirection = String(fastReaction?.direction || "").toUpperCase();
  const currentDirection = String(currentLevelAction?.direction || "").toUpperCase();
  const fastQuality = String(fastReaction?.quality || "").toUpperCase();
  const state = String(fastReaction?.state || "").toUpperCase();

  const conflict = getDirectionConflict(fastDirection, currentDirection);

  if (conflict) return "warning";
  if (paperScalp?.allowed === true) return "bullish";
  if (["FAILED_RECLAIM", "REJECTING_VALUE", "BREAKOUT_FAILING", "LOST_LEVEL"].includes(state)) {
    return "danger";
  }
  if (fastQuality === "STRONG" || fastQuality === "GOOD") return "bullish";
  if (fastQuality === "MIXED") return "warning";

  return "blue";
}

function buildEngine3ContextSection(fib) {
  const fastReaction = getEngine3FastImbalanceReaction(fib);
  const currentLevelAction = getCurrentLevelActionReaction(fib);
  const paperScalp = getPaperScalpReaction(fib);
  const lifecycleReaction = getEngine22LifecycleReaction(fib);
  const pullbackReaction = getEngine22PullbackReaction(fib);
  const reaction = getEngine5Reaction(fib);

  /*
   * Priority:
   * 1. Fast imbalance scalp read
   * 2. Paper scalp advisory
   * 3. Current level action
   * 4. Engine 22 lifecycle reaction
   * 5. Old pullback / generic fallback
   */

  if (fastReaction?.active === true) {
    const imbalance = fastReaction.imbalance || {};
    const currentPrice = Number(fastReaction.currentPrice);
    const distancePts = Number(imbalance.distancePts);

    const fastDirection = fastReaction.direction || "NEUTRAL";
    const currentDirection = currentLevelAction?.direction || "NEUTRAL";

    const conflict = getDirectionConflict(fastDirection, currentDirection);

    const scalpResult =
      conflict
        ? "CONFLICT / WAIT"
        : paperScalp?.allowed === true
        ? "PAPER WATCH ALLOWED"
        : "WAIT FOR ENGINE 6";

    return {
      number: 0,
      icon: "③",
      title: "Engine 3 Fast Scalp Read",
      severity: getFastReactionSeverity({
        fastReaction,
        currentLevelAction,
        paperScalp,
      }),
      fields: [
        ["Mode", "FAST IMBALANCE"],
        ["State", formatUpper(fastReaction.state, "NO SIGNAL")],
        ["Direction", formatUpper(fastDirection, "NEUTRAL")],
        ["Quality", formatUpper(fastReaction.quality, "WEAK")],
        ["Early", formatBool(fastReaction.earlySignal)],
        [
          "Zone",
          imbalance.lo != null && imbalance.hi != null
            ? `${formatNumber(imbalance.lo)}–${formatNumber(imbalance.hi)}`
            : "—",
        ],
        [
          "Current",
          Number.isFinite(currentPrice) ? formatNumber(currentPrice) : "—",
        ],
        [
          "Distance",
          Number.isFinite(distancePts) ? `${formatNumber(distancePts)} pts` : "—",
        ],
        [
          "Current Level",
          currentLevelAction?.state
            ? `${formatUpper(currentLevelAction.state)} / ${formatUpper(
                currentLevelAction.direction,
                "NEUTRAL"
              )}`
            : "—",
        ],
        ["Scalp Result", scalpResult],
      ],
      lines: [
        "Short-term scalp read is primary right now.",
        imbalance.raw
          ? `Active manual imbalance: ${imbalance.raw}`
          : "Active manual imbalance detected.",
        conflict
          ? `Conflict: fast imbalance says ${formatUpper(
              fastDirection
            )}, current level action says ${formatUpper(currentDirection)}. Wait for one side to win.`
          : null,
        fastReaction.state === "BREAKOUT_FAILING"
          ? "Upper imbalance breakout is failing / rejecting. Watch for imbalance-to-imbalance rotation."
          : null,
        fastReaction.state === "REJECTING_VALUE"
          ? "Price is rejecting imbalance value. Watch for continuation away from the zone."
          : null,
        fastReaction.state === "WICK_BELOW_AND_RECLAIM"
          ? "Price wicked through and reclaimed the imbalance. Watch for fast long continuation only after Engine 6 approval."
          : null,
        paperScalp?.allowed === false && asArray(paperScalp.blockers).length
          ? `Paper blockers: ${asArray(paperScalp.blockers)
              .map(formatText)
              .join(", ")}`
          : null,
        "Paper-only research read. Engine 6 remains final. No permission or execution created.",
      ].filter(Boolean),
    };
  }

  if (paperScalp?.active === true) {
    const allowed = paperScalp.allowed === true;

    return {
      number: 0,
      icon: "③",
      title: "Engine 3 Paper Scalp Read",
      severity: allowed
        ? "bullish"
        : String(paperScalp.direction || "").toUpperCase() === "SHORT"
        ? "warning"
        : "blue",
      fields: [
        ["Mode", "PAPER SCALP"],
        ["Allowed", formatBool(allowed)],
        ["State", formatUpper(paperScalp.state, "NO SIGNAL")],
        ["Direction", formatUpper(paperScalp.direction, "NEUTRAL")],
        ["Quality", formatUpper(paperScalp.quality, "WEAK")],
        ["Setup", formatUpper(paperScalp.setupType, "—")],
        [
          "Current",
          paperScalp.currentPrice != null
            ? formatNumber(paperScalp.currentPrice)
            : "—",
        ],
        [
          "Reference",
          paperScalp.referenceLevel != null
            ? formatNumber(paperScalp.referenceLevel)
            : "—",
        ],
      ],
      lines: [
        allowed
          ? "Paper scalp reaction is allowed by Engine 3, pending Engine 4 and Engine 6."
          : "Paper scalp reaction is not allowed yet.",
        asArray(paperScalp.blockers).length
          ? `Blockers: ${asArray(paperScalp.blockers)
              .map(formatText)
              .join(", ")}`
          : null,
        "This is paper-only. No real permission or execution created.",
      ].filter(Boolean),
    };
  }

  if (currentLevelAction?.active === true) {
    const currentPrice = Number(currentLevelAction.currentPrice);
    const referenceLevel = Number(currentLevelAction.referenceLevel);
    const distancePts = Number(currentLevelAction.distancePts);

    return {
      number: 0,
      icon: "③",
      title: "Engine 3 Current Level Action",
      severity:
        currentLevelAction.quality === "STRONG" ||
        currentLevelAction.quality === "GOOD"
          ? "bullish"
          : currentLevelAction.direction === "SHORT"
          ? "warning"
          : "blue",
      fields: [
        ["State", formatUpper(currentLevelAction.state, "NO SIGNAL")],
        ["Quality", formatUpper(currentLevelAction.quality, "WEAK")],
        ["Direction", formatUpper(currentLevelAction.direction, "NEUTRAL")],
        ["Confirmed", formatBool(currentLevelAction.confirmed)],
        ["Reference", formatUpper(currentLevelAction.referenceType, "—")],
        [
          "Current",
          Number.isFinite(currentPrice) ? formatNumber(currentPrice) : "—",
        ],
        [
          "Level",
          Number.isFinite(referenceLevel) ? formatNumber(referenceLevel) : "—",
        ],
        [
          "Distance",
          Number.isFinite(distancePts) ? `${formatNumber(distancePts)} pts` : "—",
        ],
      ],
      lines: [
        "Fast imbalance watch is not active. Showing short-term current level action.",
        currentLevelAction.state === "WICK_BELOW_AND_RECLAIM"
          ? "Wick below and reclaim detected. This is a fast tactical reaction, not automatic permission."
          : null,
        currentLevelAction.state === "LOST_LEVEL"
          ? "Level lost. Watch for failed reclaim or continuation."
          : null,
        currentLevelAction.state === "REJECTING_VALUE"
          ? "Rejecting value. Watch for imbalance-to-imbalance rotation."
          : null,
        "No permission or execution created.",
      ].filter(Boolean),
    };
  }

  if (
    lifecycleReaction?.source ===
    "engine22WaveStrategy.currentLifecycleState.confirmationContext"
  ) {
    const confirmed = lifecycleReaction.confirmed === true;

    const reactionState = lifecycleReaction.reactionState || "NO_SIGNAL";
    const reactionQuality = lifecycleReaction.reactionQuality || "WEAK";
    const direction = lifecycleReaction.direction || "NEUTRAL";
    const lifecycleKey = lifecycleReaction.lifecycleKey || "—";
    const mode = lifecycleReaction.mode || "—";

    const currentPrice = Number(lifecycleReaction.currentPrice);
    const referenceLevel = Number(lifecycleReaction.debug?.referenceLevel);
    const distanceToReference =
      Number.isFinite(currentPrice) && Number.isFinite(referenceLevel)
        ? currentPrice - referenceLevel
        : null;

    const attemptedReferenceReaction =
      lifecycleReaction.debug?.attemptedReferenceReaction === true;

    const failedReclaim =
      lifecycleReaction.debug?.failedReclaim === true ||
      String(reactionState).toUpperCase().includes("FAILED");

    let reactionLine =
      "Engine 3 is waiting for the current Engine 22 reaction request.";

    if (confirmed) {
      reactionLine =
        "Engine 3 lifecycle reaction is confirmed for the current Engine 22 confirmation context.";
    } else if (reactionState === "NO_SIGNAL") {
      reactionLine =
        "No lifecycle reaction yet. Price has not confirmed the Engine 22 requested pullback / reclaim.";
    } else if (reactionState === "WEAK") {
      reactionLine =
        "Weak lifecycle reaction. Engine 3 does not have enough confirmation yet.";
    } else if (reactionState === "MIXED") {
      reactionLine =
        "Mixed lifecycle reaction. Some response exists, but confirmation is not clean yet.";
    } else if (reactionState === "GOOD") {
      reactionLine =
        "Good lifecycle reaction forming, but Engine 3 has not fully confirmed yet.";
    } else if (reactionState === "CONFIRMED") {
      reactionLine = "Engine 3 lifecycle reaction is confirmed.";
    } else if (reactionState === "FAILED") {
      reactionLine = "Engine 3 lifecycle reaction failed or reclaim was rejected.";
    }

    return {
      number: 0,
      icon: "③",
      title: "Engine 3 Longer-Term Lifecycle Read",
      severity: confirmed
        ? "bullish"
        : failedReclaim
        ? "warning"
        : reactionState === "GOOD" || reactionState === "MIXED"
        ? "blue"
        : "teal",
      fields: [
        ["Lifecycle", formatUpper(lifecycleKey, "—")],
        ["Mode", formatUpper(mode, "—")],
        ["Reaction", formatUpper(reactionState, "NO SIGNAL")],
        ["Quality", formatUpper(reactionQuality, "WEAK")],
        ["Direction", formatUpper(direction, "NEUTRAL")],
        ["Confirmed", formatBool(confirmed)],
        [
          "Current",
          Number.isFinite(currentPrice) ? formatNumber(currentPrice) : "—",
        ],
        [
          "Reference",
          Number.isFinite(referenceLevel) ? formatNumber(referenceLevel) : "—",
        ],
        [
          "Distance",
          Number.isFinite(distanceToReference)
            ? `${formatNumber(distanceToReference)} pts`
            : "—",
        ],
      ],
      lines: [
        "No fast imbalance or paper scalp read is active. Showing Engine 22 lifecycle reaction context.",
        confirmed
          ? "Lifecycle reaction confirmed."
          : reactionState === "NO_SIGNAL"
          ? "Waiting for controlled pullback or reclaim."
          : reactionLine,
        attemptedReferenceReaction
          ? "Price is testing the reference / reclaim area."
          : "Price has not reached the reference / reclaim area yet.",
        failedReclaim ? "Reclaim attempt failed." : null,
        "No permission or execution created.",
      ].filter(Boolean),
    };
  }

  if (pullbackReaction?.active === true) {
    const confirmed = pullbackReaction.confirmed === true;

    return {
      number: 0,
      icon: "③",
      title: "Engine 3 Pullback Reaction",
      severity: confirmed
        ? "bullish"
        : String(pullbackReaction.reactionState || "").includes("FAILED") ||
          String(pullbackReaction.reactionState || "").includes("CLOSE_BELOW")
        ? "warning"
        : "blue",
      fields: [
        ["Reaction", formatUpper(pullbackReaction.reactionState, "PENDING")],
        ["Direction", formatUpper(pullbackReaction.direction, "NEUTRAL")],
        ["Confirmed", formatBool(confirmed)],
        ["Score", "—"],
        [
          "Zone",
          pullbackReaction.touchedZone?.name
            ? titleCase(pullbackReaction.touchedZone.name)
            : "—",
        ],
      ],
      lines: [
        pullbackReaction.touchedZone
          ? `Touched ${titleCase(
              pullbackReaction.touchedZone.name
            )}: ${formatNumber(pullbackReaction.touchedZone.lo)}–${formatNumber(
              pullbackReaction.touchedZone.hi
            )}`
          : "Waiting for Engine 22 pullback zone reaction.",
        pullbackReaction.reactionState === "FAILED_RECLAIM"
          ? "Price touched the pullback zone but failed to reclaim the prior candle high."
          : pullbackReaction.confirmed
          ? "Engine 3 pullback reaction is confirmed."
          : "Engine 3 pullback reaction is not confirmed yet.",
        "Engine 3 is reading Engine 22 pullback reaction context. No permission or execution created.",
      ].filter(Boolean),
    };
  }

  if (!reaction) {
    return {
      number: 0,
      icon: "③",
      title: "Engine 3 Current State",
      severity: "neutral",
      fields: [],
      lines: ["Engine 3 reaction context unavailable."],
    };
  }

  const quality =
    reaction.quality ||
    reaction.reactionQuality ||
    reaction.state ||
    "UNKNOWN";

  const direction =
    reaction.direction ||
    reaction.executionBias ||
    reaction.bias ||
    "NEUTRAL";

  const confirmed =
    reaction.confirmed === true ||
    reaction.cleanReaction === true ||
    reaction.reactionConfirmed === true;

  return {
    number: 0,
    icon: "③",
    title: "Engine 3 Current State",
    severity: confirmed ? "bullish" : "warning",
    fields: [
      ["Reaction", formatUpper(quality, "UNKNOWN")],
      ["Direction", formatUpper(direction, "NEUTRAL")],
      ["Confirmed", formatBool(confirmed)],
      ["Score", formatScore(reaction.score || reaction.reactionScore)],
    ],
    lines: [
      "Fallback generic Engine 3 reaction read. Engine 22 lifecycle reaction was unavailable.",
      reaction.message ||
        reaction.traderMessage ||
        (confirmed
          ? "Generic Engine 3 reaction is confirmed."
          : "Generic Engine 3 reaction is not confirmed yet."),
    ].filter(Boolean),
  };
}
function buildEngine4ContextSection(fib) {
  const fastParticipation = getEngine4FastImbalanceParticipation(fib);
  const lifecycleParticipation = getEngine22LifecycleParticipation(fib);
  const volume = getEngine5Volume(fib);

  if (fastParticipation?.active === true) {
    const allowed = fastParticipation.allowed === true;
    const hardBlocked = fastParticipation.hardBlocked === true;

    const currentBarVolume = Number(fastParticipation.currentBarVolume);
    const priorBarVolume = Number(fastParticipation.priorBarVolume);
    const volumeRatio = Number(fastParticipation.currentVsPriorVolumeRatio);

    return {
      number: 0,
      icon: "④",
      title: "Engine 4 Fast Scalp Volume",
      severity: hardBlocked
        ? "danger"
        : allowed
        ? "bullish"
        : fastParticipation.participationQuality === "MIXED"
        ? "warning"
        : "warning",
      fields: [
        ["Mode", "FAST IMBALANCE"],
        ["State", formatUpper(fastParticipation.participationState, "NO SIGNAL")],
        ["Quality", formatUpper(fastParticipation.participationQuality, "WEAK")],
        ["Allowed", formatBool(allowed)],
        ["Grade", formatUpper(fastParticipation.grade, "D")],
        ["Risk", formatUpper(fastParticipation.risk, "WAIT")],
        ["Direction", formatUpper(fastParticipation.intendedDirection, "NEUTRAL")],
        [
          "Fast Vol",
          Number.isFinite(currentBarVolume)
            ? `${formatScore(currentBarVolume)} now`
            : "—",
        ],
        [
          "Prior Vol",
          Number.isFinite(priorBarVolume)
            ? formatScore(priorBarVolume)
            : "—",
        ],
        [
          "Vol Ratio",
          Number.isFinite(volumeRatio) ? `${formatNumber(volumeRatio, 2)}x` : "—",
        ],
      ],
      lines: [
        "Short-term fast imbalance volume is primary right now.",
        fastParticipation.usedFastReactionCandles === true
          ? "Using Engine 3 fast candles, not slow 10m fallback."
          : "Using fallback volume context.",
        fastParticipation.volumeIncreasing === true
          ? "Fast volume is increasing versus prior candle."
          : "Fast volume is not increasing versus prior candle.",
        fastParticipation.supportsFastReactionDirection === true
          ? "Fast price action supports Engine 3 direction."
          : "Fast price action does not fully support Engine 3 direction.",
        fastParticipation.participationImproving === true
          ? "Participation is improving."
          : "Participation is not improving yet.",
        allowed
          ? "Engine 4 fast participation is acceptable for paper review. Engine 6 still decides."
          : "Engine 4 fast participation is not ready for paper allow yet.",
        "Paper-only research read. No permission or execution created.",
      ].filter(Boolean),
    };
  } 

  if (lifecycleParticipation?.active === true) {
    const confirmed = lifecycleParticipation.confirmed === true;

    const state = lifecycleParticipation.participationState || "NO_SIGNAL";
    const volumeState = lifecycleParticipation.volumeState || state;

    const relativeVolume = Number(lifecycleParticipation.relativeVolume);
    const volumeScore = Number(lifecycleParticipation.volumeScore);

    const lifecycleKey = lifecycleParticipation.lifecycleKey || "—";
    const mode = lifecycleParticipation.mode || "—";
    const participationFocus = lifecycleParticipation.participationFocus || "—";

    let participationLine = "Engine 4 participation is not confirmed yet.";

    if (state === "WEAK") {
      participationLine = "Weak participation. Engine 22 needs volume on reclaim, but volume has not confirmed yet.";
    } else if (state === "MIXED") {
      participationLine = "Mixed participation. Some response exists, but Engine 4 has not confirmed clean volume.";
    } else if (state === "EXPANDING") {
      participationLine = "Participation is expanding in the direction Engine 22 requested.";
    } else if (state === "CONFIRMED") {
      participationLine = "Engine 4 participation is confirmed for the current Engine 22 confirmation context.";
    } else if (state === "RISK") {
      participationLine = "Volume risk detected. Participation is not safe to confirm.";
    } else if (state === "NO_SIGNAL") {
      participationLine = "No Engine 4 participation signal yet.";
    }

    return {
      number: 0,
      icon: "④",
      title: "Engine 4 Current State",
      severity: confirmed
        ? "bullish"
        : state === "RISK"
        ? "danger"
        : state === "WEAK" || state === "MIXED" || state === "NO_SIGNAL"
        ? "warning"
        : "blue",
      fields: [
        ["Lifecycle", formatUpper(lifecycleKey, "—")],
        ["Mode", formatUpper(mode, "—")],
        ["Focus", formatUpper(participationFocus, "—")],
        ["Volume", formatUpper(volumeState, "NO SIGNAL")],
        ["Direction", formatUpper(lifecycleParticipation.direction, "NEUTRAL")],
        ["Confirmed", formatBool(confirmed)],
        ["Score", formatScore(volumeScore)],
        [
          "RelVol",
          Number.isFinite(relativeVolume)
            ? `${formatNumber(relativeVolume, 2)}x`
            : "—",
        ],
      ],
      lines: [
        participationLine,
        lifecycleParticipation.volumeTrend
          ? `Volume trend: ${formatUpper(lifecycleParticipation.volumeTrend)}`
          : null,
        lifecycleParticipation.reclaimLike === false
          ? "Reclaim-like price action is not confirmed."
          : lifecycleParticipation.reclaimLike === true
          ? "Reclaim-like price action detected."
          : null,
        lifecycleParticipation.focusSatisfied === false
          ? "Participation focus is not satisfied yet."
          : lifecycleParticipation.focusSatisfied === true
          ? "Participation focus is satisfied."
          : null,
        "Engine 4 is reading Engine 22 confirmationContext. No permission or execution created.",
      ].filter(Boolean),
    };
  }

  if (!volume) {
    return {
      number: 0,
      icon: "④",
      title: "Engine 4 Current State",
      severity: "neutral",
      fields: [],
      lines: ["Engine 4 volume / participation context unavailable."],
    };
  }

  const quality =
    volume.quality ||
    volume.participationQuality ||
    volume.state ||
    "UNKNOWN";

  const direction =
    volume.direction ||
    volume.participationDirection ||
    "NEUTRAL";

  const confirmed =
    volume.confirmed === true ||
    volume.volumeConfirmed === true ||
    volume.cleanParticipation === true;

  return {
    number: 0,
    icon: "④",
    title: "Engine 4 Current State",
    severity: confirmed ? "bullish" : "warning",
    fields: [
      ["Volume", formatUpper(quality, "UNKNOWN")],
      ["Direction", formatUpper(direction, "NEUTRAL")],
      ["Confirmed", formatBool(confirmed)],
      ["Score", formatScore(volume.score || volume.volumeScore)],
    ],
    lines: [
      volume.message ||
        volume.traderMessage ||
        (confirmed
          ? "Engine 4 participation is confirmed."
          : "Engine 4 participation is not confirmed yet."),
    ].filter(Boolean),
  };
}

function buildCurrentFibExtensionsSection(waveOpportunity, fib) {
  const possibleW5Up = getPossibleW5Up(fib);

  if (isPossibleW5UpComplete(possibleW5Up)) {
    const levels = getPossibleW5PullbackLevels(possibleW5Up);
    const zones = possibleW5Up?.entryZones || {};
    const summary = getPossibleW5PullbackSummary(possibleW5Up);

    return {
      number: 0,
      icon: "⑸",
      title: "Post-W5 Pullback Entry Zones",
      severity: "blue",
      fields: [
        ...levels.map((level) => [level.label, formatNumber(level.price)]),
        ["Shallow Trend Pullback", formatZone(zones.shallowTrendPullback)],
        ["Standard Pullback Entry Zone", formatZone(zones.standardPullback)],
        ["Deeper Support Entry Zone", formatZone(zones.deeperSupport)],
        ["Failure Warning Below", formatZone(zones.failureWarning)],
      ],
      lines: [
        summary.hitLabel
          ? `Current pullback fib hit: ${summary.hitLabel} @ ${formatNumber(
              summary.hitPrice
            )}`
          : "Current pullback fib hit: none yet",
        summary.nextLabel
          ? `Next pullback watch: ${summary.nextLabel} @ ${formatNumber(
              summary.nextPrice
            )}`
          : "Next pullback watch: no deeper pullback level",
        "These are pullback reaction / entry planning zones, not automatic entry signals.",
        "Watch pullback reaction / reclaim. No chase. No automatic long. No execution.",
      ],
    };
  }

  const postBounce = getPostDownImpulseBounce(fib);
  const postBounceTargets = getPostDownImpulseBounceTargets(postBounce);

  if (isPostMinor5BounceCLegActive(postBounce) && postBounceTargets.length) {
    return {
      number: 0,
      icon: "⑸",
      title: "Post-Minor-5 Corrective Bounce C-Up Targets",
      severity: "blue",
      fields: postBounceTargets.map(([level, price]) => [
        level,
        formatNumber(price),
      ]),
      lines: [
        `Current target hit: ${formatPostBounceTargetHit(postBounce)}`,
        "These are corrective bounce reaction zones, not fresh long targets or execution signals.",
        "No automatic long. No automatic short. No execution.",
      ],
    };
  }

  const targets = getTargets(waveOpportunity);

  if (!targets.length) {
    return {
      number: 0,
      icon: "⑸",
      title: "Current Fib Extensions To Watch",
      severity: "neutral",
      fields: [],
      lines: ["No active fib extension targets are available."],
    };
  }

  return {
    number: 0,
    icon: "⑸",
    title: "Current Fib Extensions To Watch",
    severity: "blue",
    fields: targets.map(([level, price]) => [level, formatNumber(price)]),
    lines: [
      "Use these only as target / reaction zones. They are not entry signals by themselves.",
    ],
  };
}

/* =========================
   Normalize timeline data
========================= */

function normalizeTimelineData({ overlayData }) {
  if (!overlayData?.ok) {
    return {
      show: false,
    };
  }

  const fib = getFib(overlayData);
  const waveOpportunity = getWaveOpportunity(fib);
  const engine15 = getEngine15Decision(fib);
  const permission = getFinalPermission(fib);
  const backendTimelineRead = getBackendTimelineRead(fib);
  const tradeContextSummary = getBackendTradeContextSummary(fib);
  const currentLifecycleState = getCurrentLifecycleState(fib);

  const postAbcBounceSection = buildPostAbcBounceSection(
    tradeContextSummary,
    waveOpportunity
  );

  const marketMeterSection = getBackendTimelineSection(
    fib,
    "Market Meter / Tactical Context"
  );

  const headline =
    currentLifecycleState?.headline ||
    backendTimelineRead?.headline ||
    tradeContextSummary?.headline ||
    buildFallbackHeadline({ waveOpportunity, engine15 });

  const subheadline =
    currentLifecycleState?.action
      ? formatText(currentLifecycleState.action)
      : backendTimelineRead?.subheadline ||
        tradeContextSummary?.subheadline ||
        buildFallbackSubheadline({ waveOpportunity, engine15 });

  const lifecycleOwnsDisplay =
    isCurrentLifecycleDisplayOverride(currentLifecycleState);

  const permissionBadge = buildPermissionBadge(permission);

  const badges = lifecycleOwnsDisplay
    ? [
        ...buildCurrentLifecycleBadges(currentLifecycleState),
        permissionBadge,
      ].filter(Boolean)
    : [
        ...buildCurrentLifecycleBadges(currentLifecycleState),
        ...buildBadges({ waveOpportunity, engine15, permission }),
      ].filter(Boolean);

  const sections = [
    buildCurrentLifecycleStateSection(currentLifecycleState, fib),

    lifecycleOwnsDisplay
      ? null
      : buildWaveOpportunitySection(waveOpportunity, fib),

    buildPossibleW5UpCompleteSection(fib),
    buildPostMinor5CorrectiveBounceSection(fib),
    postAbcBounceSection,
    buildEngine15Section(engine15, currentLifecycleState),
    buildEngine5Section(fib),
    buildPermissionSection(permission, engine15),

    lifecycleOwnsDisplay
      ? buildLifecycleNextStepsSection(currentLifecycleState, fib)
      : buildNextStepsSection({
          waveOpportunity,
          engine15,
          permission,
          fib,
          tradeContextSummary,
        }),
  ]
    .filter(Boolean)
    .map((section, idx) => ({
      ...section,
      number: idx + 1,
    }));

  const contextSections = [
    buildBackendTimelineSection(marketMeterSection),
    buildEngine3ContextSection(fib),
    buildEngine4ContextSection(fib),
    buildCurrentFibExtensionsSection(waveOpportunity, fib),
  ]
    .filter(Boolean)
    .map((section, idx) => ({
      ...section,
      number: idx + 1,
    }));

  const severity =
    backendTimelineRead?.severity ||
    tradeContextSummary?.severity ||
    (permission?.executable === true
      ? "bullish"
      : waveOpportunity?.chaseRisk === "EXTREME" ||
        waveOpportunity?.timing === "POST_EXTENSION"
      ? "warning"
      : isWatchState(engine15?.readinessLabel)
      ? "warning"
      : "neutral");

  return {
    show: true,
    severity,
    headline,
    subheadline,
    badges,
    sections,
    contextSections,
    footer: permission?.executable === true ? "EXECUTION ELIGIBLE" : "WATCH",
  };
}

/* =========================
   Shared styles
========================= */

const shellTextStyle = {
  fontFamily: TIMELINE_FONT,
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  textRendering: "geometricPrecision",
};

const smallCapsStyle = {
  textTransform: "uppercase",
  letterSpacing: "0.045em",
};

/* =========================
   UI Components
========================= */

function Badge({ label, severity = "neutral" }) {
  if (!label) return null;

  return (
    <span
      style={{
        ...shellTextStyle,
        ...smallCapsStyle,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${severityBorder(severity)}`,
        background: severityBackground(severity),
        color: severityColor(severity),
        borderRadius: 8,
        padding: "5px 10px",
        fontSize: 13,
        fontWeight: FONT_REGULAR,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function FieldGrid({ fields }) {
  const safeFields = asArray(fields);

  if (!safeFields.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "9px 15px",
        marginTop: 7,
      }}
    >
      {safeFields.map(([label, value], idx) => (
        <div key={`${label}-${idx}`}>
          <div
            style={{
              ...shellTextStyle,
              ...smallCapsStyle,
              color: MUTED_TEXT,
              fontSize: 13,
              fontWeight: FONT_REGULAR,
              marginBottom: 3,
            }}
          >
            {label}
          </div>
          <div
            style={{
              ...shellTextStyle,
              color: MAIN_TEXT,
              fontSize: 16,
              fontWeight: FONT_REGULAR,
              lineHeight: 1.35,
              whiteSpace: "pre-line",
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function IngredientCards({ cards }) {
  const safeCards = asArray(cards);

  if (!safeCards.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
        marginTop: 7,
      }}
    >
      {safeCards.map((card, idx) => (
        <div
          key={`${card.label}-${idx}`}
          style={{
            borderLeft: `3px solid ${card.good ? "#22c55e" : "#f59e0b"}`,
            background: "rgba(15,23,42,0.48)",
            borderRadius: 8,
            padding: "9px 10px",
          }}
        >
          <div
            style={{
              ...shellTextStyle,
              ...smallCapsStyle,
              color: "#cbd5e1",
              fontSize: 13,
              fontWeight: FONT_REGULAR,
              marginBottom: 3,
            }}
          >
            {card.label}
          </div>
          <div
            style={{
              ...shellTextStyle,
              color: card.good ? "#86efac" : "#fed7aa",
              fontSize: 15,
              fontWeight: FONT_REGULAR,
              lineHeight: 1.35,
            }}
          >
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Checklist({ items }) {
  const safeItems = asArray(items);

  if (!safeItems.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "9px 20px",
        marginTop: 7,
      }}
    >
      {safeItems.map((item, idx) => (
        <div
          key={`${item}-${idx}`}
          style={{
            ...shellTextStyle,
            display: "grid",
            gridTemplateColumns: "22px 1fr",
            alignItems: "center",
            gap: 8,
            color: SOFT_TEXT,
            fontSize: 15,
            fontWeight: FONT_REGULAR,
            lineHeight: 1.35,
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 6,
              border: "1px solid rgba(45,212,191,0.85)",
              color: "#2dd4bf",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: FONT_MEDIUM,
            }}
          >
            {idx + 1}
          </div>
          <div>{item}</div>
        </div>
      ))}
    </div>
  );
}

function TimelineSection({ section }) {
  if (!section) return null;

  return (
    <div
      style={{
        border: `1px solid ${severityBorder(section.severity)}`,
        background: severityBackground(section.severity),
        borderRadius: 12,
        padding: "12px 13px",
        textAlign: "left",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "38px 1fr",
          gap: 10,
          alignItems: "start",
        }}
      >
        <div
          style={{
            ...shellTextStyle,
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: `1px solid ${severityBorder(section.severity)}`,
            color: severityColor(section.severity),
            background: "rgba(2,6,23,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: FONT_MEDIUM,
            fontSize: 15,
            boxShadow: `0 0 16px ${severityBorder(section.severity)}`,
          }}
        >
          {section.number}
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                ...shellTextStyle,
                color: severityColor(section.severity),
                fontSize: 19,
                fontWeight: FONT_MEDIUM,
              }}
            >
              {section.icon}
            </span>
            <div
              style={{
                ...shellTextStyle,
                color: severityColor(section.severity),
                fontSize: 19,
                fontWeight: FONT_MEDIUM,
                letterSpacing: "0.01em",
              }}
            >
              {section.title}
            </div>
          </div>

          <FieldGrid fields={section.fields} />
          <IngredientCards cards={section.ingredientCards} />
          <Checklist items={section.checklist} />

          {asArray(section.lines).length > 0 && (
            <div
              style={{
                ...shellTextStyle,
                display: "grid",
                gap: 5,
                marginTop: 8,
                color: SOFT_TEXT,
                fontSize: 15,
                lineHeight: 1.5,
                fontWeight: FONT_REGULAR,
              }}
            >
              {asArray(section.lines).map((line, idx) => (
                <div key={`${line}-${idx}`}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MinimalStatusStrip({ timeline }) {
  return (
    <div
      style={{
        ...shellTextStyle,
        position: "absolute",
        top: 88,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 108,
        width: 760,
        maxWidth: "44%",
        border: "1px solid rgba(148,163,184,0.20)",
        borderRadius: 10,
        background: "rgba(6,10,20,0.70)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 0,
        color: "#cbd5e1",
        pointerEvents: "none",
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={stripCellStyle}>
        <span style={stripLabelStyle}>Market Bias</span>
        <span style={{ ...stripValueStyle, color: "#22c55e" }}>↗ LONG</span>
      </div>
      <div style={stripCellStyle}>
        <span style={stripLabelStyle}>Setup</span>
        <span style={{ ...stripValueStyle, color: "#fbbf24" }}>◉ WATCH</span>
      </div>
      <div style={stripCellStyle}>
        <span style={stripLabelStyle}>Permission</span>
        <span style={{ ...stripValueStyle, color: "#c084fc" }}>⬟ REDUCE</span>
      </div>
    </div>
  );
}

const stripCellStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "10px 12px",
  borderRight: "1px solid rgba(148,163,184,0.14)",
};

const stripLabelStyle = {
  ...shellTextStyle,
  ...smallCapsStyle,
  color: MUTED_TEXT,
  fontSize: 13,
  fontWeight: FONT_REGULAR,
};

const stripValueStyle = {
  ...shellTextStyle,
  ...smallCapsStyle,
  fontSize: 14,
  fontWeight: FONT_MEDIUM,
};

function TimelineMainCard({ timeline }) {
  return (
    <div
      style={{
        ...shellTextStyle,
        position: "absolute",
        top: 138,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 109,
        width: 760,
        maxWidth: "44%",
        maxHeight: "calc(100vh - 165px)",
        overflowY: "auto",
        borderRadius: 15,
        border: `1px solid ${severityBorder(timeline.severity)}`,
        background: CARD_BG_STRONG,
        padding: "18px 19px",
        color: "#e5e7eb",
        pointerEvents: "none",
        backdropFilter: "blur(5px)",
        boxShadow: "0 12px 34px rgba(0,0,0,0.34)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          ...shellTextStyle,
          fontSize: 30,
          fontWeight: FONT_MEDIUM,
          color: "#fbbf24",
          letterSpacing: "0.01em",
          marginBottom: 7,
          lineHeight: 1.2,
          textTransform: "none",
        }}
      >
        {timeline.headline}
      </div>

      {timeline.subheadline && (
        <div
          style={{
            ...shellTextStyle,
            color: "#e2e8f0",
            fontSize: 16,
            lineHeight: 1.5,
            fontWeight: FONT_REGULAR,
            maxWidth: 710,
            margin: "0 auto 11px",
          }}
        >
          {timeline.subheadline}
        </div>
      )}

      {asArray(timeline.badges).length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginBottom: 13,
          }}
        >
          {timeline.badges.map((badge, idx) => (
            <Badge
              key={`${badge.label}-${idx}`}
              label={badge.label}
              severity={badge.severity}
            />
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 9 }}>
        {asArray(timeline.sections).map((section, idx) => (
          <TimelineSection
            key={`${section.title || "section"}-${idx}`}
            section={section}
          />
        ))}
      </div>

      {timeline.footer && (
        <div
          style={{
            ...shellTextStyle,
            ...smallCapsStyle,
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid rgba(148,163,184,0.25)",
            color: MUTED_TEXT,
            fontWeight: FONT_MEDIUM,
            fontSize: 13,
            letterSpacing: "0.08em",
          }}
        >
          {timeline.footer}
        </div>
      )}
    </div>
  );
}

function ContextTimelinePanel({ sections }) {
  const safeSections = asArray(sections);

  if (!safeSections.length) return null;

  return (
    <div
      style={{
        ...shellTextStyle,
        position: "absolute",
        top: 138,
        right: "calc(50% + 430px)",
        width: 430,
        maxWidth: "28%",
        maxHeight: "calc(100vh - 165px)",
        overflowY: "auto",
        zIndex: 108,
        border: "1px solid rgba(148,163,184,0.35)",
        borderRadius: 15,
        background: CARD_BG,
        padding: "14px 14px",
        color: "#e5e7eb",
        pointerEvents: "none",
        boxShadow: "0 10px 28px rgba(0,0,0,0.32)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        style={{
          ...shellTextStyle,
          ...smallCapsStyle,
          color: MAIN_TEXT,
          fontWeight: FONT_MEDIUM,
          fontSize: 18,
          marginBottom: 12,
        }}
      >
        Market Context
      </div>

      <div style={{ display: "grid", gap: 9 }}>
        {safeSections.map((section, idx) => (
          <TimelineSection
            key={`${section.title || "context"}-${idx}`}
            section={section}
          />
        ))}
      </div>
    </div>
  );
}

/* =========================
   Main export
========================= */

export default function Engine17DecisionTimeline({
  overlayData,
  visible = true,
  chartMode = "SCALP",
}) {
  const timeline = normalizeTimelineData({ overlayData, chartMode });

  if (!visible || !timeline?.show) return null;

  return (
    <>
      <MinimalStatusStrip timeline={timeline} />
      <ContextTimelinePanel sections={timeline.contextSections} />
      <TimelineMainCard timeline={timeline} />
    </>
  );
}
