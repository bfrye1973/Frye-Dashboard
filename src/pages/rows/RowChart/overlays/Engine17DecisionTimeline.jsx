// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React, { useState } from "react";

/* =========================
   Visual System
========================= */

const TIMELINE_FONT =
  '"Trebuchet MS", "Lucida Grande", "Segoe UI", Arial, sans-serif';

const FONT_REGULAR = 400;
const FONT_MEDIUM = 500;

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

const WAVELENGTH_TABS = [
  { key: "subminute", label: "Subminute" },
  { key: "minute", label: "Minute" },
  { key: "minor", label: "Minor" },
  { key: "intermediate", label: "Intermediate" },
  { key: "primary", label: "Primary" },
];

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
function getLifecycleViews(fib) {
  const waveStrategy = getEngine22WaveStrategy(fib);

  return (
    waveStrategy?.lifecycleViews ||
    waveStrategy?.timelineRead?.lifecycleViews ||
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

function getEngine27TraderDecision(fib) {
  return fib?.engine27TraderDecision || null;
}

function getEngine27SubminuteTraderDecision(fib) {
  return fib?.engine27SubminuteTraderDecision || null;
}

function getCanonicalStrategyTimeline(fib) {
  return fib?.strategyTimeline || null;
}

function getEngine26StructuralContext(fib) {
  const root = getStrategyRoot(fib);

  return (
    root?.engine26StructuralContext ||
    fib?.engine26StructuralContext ||
    root?.engine26?.structuralContext ||
    null
  );
}

function getEngine26LocationContext(fib) {
  const root = getStrategyRoot(fib);
  const structural = getEngine26StructuralContext(fib);

  return (
    structural?.locationContext ||
    root?.engine26TradePlanPreview?.locationContext ||
    fib?.engine26TradePlanPreview?.locationContext ||
    null
  );
}

function getEngine26ControlLevelContext(fib) {
  const root = getStrategyRoot(fib);
  const structural = getEngine26StructuralContext(fib);

  return (
    structural?.controlLevelContext ||
    root?.engine26TradePlanPreview?.controlLevelContext ||
    fib?.engine26TradePlanPreview?.controlLevelContext ||
    null
  );
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

function getEngine4CurrentScalpParticipation(fib) {
  const confluence = getConfluence(fib);

  return (
    confluence?.context?.volume?.engine4CurrentScalpParticipation ||
    fib?.confluence?.context?.volume?.engine4CurrentScalpParticipation ||
    getStrategyRoot(fib)?.confluence?.context?.volume?.engine4CurrentScalpParticipation ||
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

function formatFibLevels(levels = {}, labels = {}) {
  if (!levels || typeof levels !== "object") return "—";

  const entries = Object.entries(levels)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .map(([key, value]) => {
      const label = labels[key] || key.toUpperCase();
      return `${label}: ${formatNumber(value)}`;
    });

  return entries.length ? entries.join("  |  ") : "—";
}

function formatFibTargetsList(values = []) {
  const nums = Array.isArray(values)
    ? values.filter((value) => Number.isFinite(Number(value)))
    : [];

  return nums.length ? nums.map((value) => formatNumber(value)).join(" → ") : "—";
}

function formatTargetPath(values = [], fallback = "—") {
  const nums = Array.isArray(values)
    ? values.filter((value) => Number.isFinite(Number(value)))
    : [];

  return nums.length
    ? nums.map((value) => formatNumber(value)).join(" → ")
    : fallback;
}
function formatZoneRange(zone) {
  if (!zone || typeof zone !== "object") return "—";

  if (zone.lo != null && zone.hi != null) {
    return `${formatNumber(zone.lo)}–${formatNumber(zone.hi)}`;
  }

  return "—";
}

function buildLongTermLifecycleViewSection(lifecycleViews) {
  const longTerm = lifecycleViews?.longTerm || null;

  if (!longTerm) return null;

  const fibMap = longTerm.fibMap || {};
  const anchors = longTerm.anchors || {};
  const levels = fibMap.levels || {};

  return {
    number: 1,
    icon: "↗",
    title: "Long-Term Lifecycle — Engine 22",
    severity: "bullish",
    fields: [
      ["Lifecycle", formatText(longTerm.label, "Intermediate W3 active")],
      ["Active Wave", `${formatUpper(longTerm.activeDegree)} ${formatUpper(longTerm.activeWave)}`],
      ["Direction", formatUpper(longTerm.direction, "LONG")],
      ["Current", formatNumber(anchors.currentPrice)],
      ["W1 High", formatNumber(anchors.w1High)],
      ["W2 Low", formatNumber(anchors.w2Low)],
      ["Next Target", formatNumber(fibMap.nextTarget)],
      ["Target Path", formatFibTargetsList(fibMap.higherTargets)],
    ],
    lines: [
      longTerm.summary ||
        "Intermediate W3 is active. This is higher-timeframe context, not a scalp trigger.",
      `Intermediate W3 extension map: ${formatFibLevels(levels, {
        e100: "1.000",
        e1272: "1.272",
        e1618: "1.618",
        e200: "2.000",
        e2618: "2.618",
      })}`,
      "Use this section for bigger destination targets only. No execution from this alone.",
    ],
  };
}

function buildIntradayScalpLifecycleViewSection(lifecycleViews) {
  const intraday = lifecycleViews?.intradayScalp || null;

  if (!intraday) return null;

  const fibMap = intraday.fibMap || {};
  const anchors = intraday.anchors || {};
  const pullbackLevels = fibMap.pullbackLevels || {};
  const holdTargets = fibMap.ifW4HoldsNextTargets || {};

  return {
    number: 2,
    icon: "〽",
    title: "Intraday Scalp Lifecycle — Engine 22",
    severity: "teal",
    fields: [
      ["Lifecycle", formatText(intraday.label, "Minute W4 pullback watch")],
      ["Active Wave", `${formatUpper(intraday.activeDegree)} ${formatUpper(intraday.activeWave)}`],
      ["Parent", `${formatUpper(intraday.parentDegree)} ${formatUpper(intraday.parentWave)}`],
      ["Direction", formatUpper(intraday.direction, "LONG AFTER CONFIRMATION")],
      ["Current", formatNumber(anchors.currentPrice)],
      ["W3 High", formatNumber(anchors.w3High)],
      ["Preferred W4 Zone", formatZoneRange(fibMap.preferredW4Zone)],
      ["Invalidation", formatNumber(fibMap.invalidationLevel)],
    ],
    lines: [
      intraday.summary ||
        "Minute W4 pullback is being watched. No chase. No execution.",
      `Minute W4 pullback levels: ${formatFibLevels(pullbackLevels, {
        r236: "23.6%",
        r382: "38.2%",
        r500: "50.0%",
        r618: "61.8%",
        r786: "78.6%",
      })}`,
      `If W4 holds, next targets: ${formatFibLevels(holdTargets, {
        e100: "1.000",
        e1272: "1.272",
        e1618: "1.618",
        e200: "2.000",
        e2618: "2.618",
      })}`,
      "Engine 26 may use this as scalp context only. Engine 15 / Engine 6 still control permission.",
    ],
  };
}

function buildLifecycleViewSections(lifecycleViews) {
  return [
    buildLongTermLifecycleViewSection(lifecycleViews),
    buildIntradayScalpLifecycleViewSection(lifecycleViews),
  ].filter(Boolean);
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
  const paper = engine15?.paperScalpReadiness || null;

  const isShortStructuralWatch =
    paper?.readiness === "SHORT_STRUCTURAL_WATCH" &&
    paper?.source === "engine26StructuralContext";

  if (isShortStructuralWatch) {
    const targetPath = Array.isArray(paper?.targetModel?.targetPathPreview)
      ? paper.targetModel.targetPathPreview
      : [];

    const targetPathText = targetPath.length
      ? targetPath.map((level) => formatNumber(level)).join(" → ")
      : "—";

    const bHigh = paper?.riskModel?.bHigh;

    const blockersText = asArray(paper?.blockers)
      .map(formatText)
      .join(", ");

    return {
      number: 3,
      icon: "▣",
      title: "Setup Readiness — Engine 15ES",
      severity: "danger",
      fields: [
        ["Readiness", "SHORT STRUCTURAL WATCH"],
        ["Strategy", formatUpper(paper.setupType, "ABC DOWN B BOUNCE C DOWN WATCH")],
        ["Direction", "SHORT"],
        ["Role", formatUpper(paper.setupRole, "B BOUNCE FINAL FILL ZONE")],
        ["Bias", formatUpper(paper.structuralBias, "C DOWN WATCH")],
        ["Action", "WATCH FAILED ACCEPTANCE / LEVEL LOSS"],
        ["Quality", "WATCH ONLY / RESEARCH"],
        ["B High / Stop Preview", bHigh != null ? formatNumber(bHigh) : "—"],
      ],
      lines: [
        "Watch only. No paper allow. No ticket.",
      ].filter(Boolean),
    };
  } 
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

function buildEngine27TraderIntelligenceSection(fib, decisionOverride = null) {
  const decision = decisionOverride || getEngine27TraderDecision(fib);

  if (!decision) {
    return {
      number: 0,
      icon: "㉗",
      title: "Trader Intelligence — Engine 27",
      severity: "warning",
      fields: [
        ["State", "WAITING FOR ENGINE 27 DATA"],
        ["Direction", "—"],
        ["Current Wave", "—"],
        ["Internal Wave", "—"],
        ["Next Action", "MONITOR"],
      ],
      lines: [
        "Engine 27 Trader Intelligence is not present in the current RowChart overlay payload.",
        "This card is ready for the canonical engine27TraderDecision object once RowChart passes it through.",
      ],
    };
  }

  const readiness = decision?.readiness || {};
  const blockers = asArray(
    decision?.blockers ||
      decision?.blockingReasons ||
      readiness?.blockers
  );

  const waitingFor = asArray(
    decision?.waitingFor ||
      decision?.needs ||
      readiness?.waitingFor
  );

  const currentWave =
    decision?.currentWave ||
    decision?.wave?.currentWave ||
    decision?.waveState?.currentWave ||
    "—";

  const internalWave =
    decision?.internalWave ||
    decision?.wave?.internalWave ||
    decision?.waveState?.internalWave ||
    "—";

  const state =
    decision?.state ||
    decision?.decisionState ||
    decision?.readinessState ||
    "UNKNOWN";

  const direction =
    decision?.direction ||
    decision?.bias ||
    decision?.tradeDirection ||
    "NEUTRAL";

  const nextAction =
    decision?.nextAction ||
    decision?.action ||
    decision?.recommendedAction ||
    "MONITOR";

  const severity =
    decision?.executable === true
      ? "bullish"
      : blockers.length
      ? "warning"
      : "teal";

  return {
    number: 0,
    icon: "㉗",
    title: "Trader Intelligence — Engine 27",
    severity,
    fields: [
      ["State", formatUpper(state)],
      ["Direction", formatUpper(direction)],
      ["Current Wave", formatUpper(currentWave)],
      ["Internal Wave", formatUpper(internalWave)],
      ["Next Action", formatUpper(nextAction)],
      ["Executable", formatBool(decision?.executable, "NO")],
    ],
    lines: [
      waitingFor.length
        ? `Waiting for: ${waitingFor.map(formatText).join(", ")}`
        : null,
      blockers.length
        ? `Blockers: ${blockers.map(formatText).join(", ")}`
        : "No active Engine 27 blockers reported.",
      decision?.summary || decision?.traderMessage || null,
    ].filter(Boolean),
  };
}

function getCanonicalStageSeverity(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "ACTIVE") return "bullish";
  if (normalized === "WATCHING") return "warning";
  if (normalized === "WAITING") return "purple";

  return "neutral";
}

function buildCanonicalMinuteStageTimelineSection(fib) {
  const strategyTimeline = getCanonicalStrategyTimeline(fib);
  const stages = Array.isArray(strategyTimeline?.stages)
    ? strategyTimeline.stages.filter(Boolean)
    : [];

  if (!stages.length) {
    return {
      number: 0,
      icon: "⑩",
      title: "Canonical Minute Stage Timeline",
      severity: "warning",
      fields: [],
      lines: ["Timeline not attached yet."],
    };
  }

  return {
    number: 0,
    icon: "⑩",
    title: "Canonical Minute Stage Timeline",
    severity: "blue",
    canonicalStages: stages.map((stage) => ({
      id: stage?.id || null,
      label: stage?.label || stage?.id || "—",
      status: stage?.status || "—",
      sourceEngine: stage?.sourceEngine || null,
      severity: getCanonicalStageSeverity(stage?.status),
    })),
    fields: [],
    lines: [],
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
  const paper = permission.paper || null;

  const paperDecision = String(paper?.decision || "").toUpperCase();
  const paperDirection = String(paper?.direction || "").toUpperCase();

  const isStructuralFastWatch =
    paperDecision === "STRUCTURAL_FAST_WATCH" ||
    paper?.structuralWatchOnly === true;

  const isShortResearchWatch =
    paperDecision === "PAPER_SHORT_RESEARCH_WATCH" ||
    paper?.shortResearchWatch === true;

  const isPaperResearchLane = isStructuralFastWatch || isShortResearchWatch;

  const paperStrategy =
    paper?.setupType ||
    engine15?.paperScalpReadiness?.setupType ||
    engine15?.strategyType ||
    "NONE";

  const realStrategy =
    permission.strategyType ||
    engine15?.strategyType ||
    "NONE";

  let permissionLine = "Engine 6 does not allow execution yet.";

  if (isShortResearchWatch) {
    permissionLine =
      "PAPER SHORT RESEARCH WATCH — short rejection / failed-acceptance research is active. No ticket. No execution.";
  } else if (isStructuralFastWatch) {
    permissionLine =
      "STRUCTURAL FAST WATCH — Engine 26 C-down danger zone is active. Watch only. No ticket. No execution.";
  } else if (executable) {
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

  const severity =
    isShortResearchWatch || isStructuralFastWatch
      ? "danger"
      : executable
      ? "bullish"
      : "purple";

  return {
    number: 5,
    icon: "⬟",
    title: "Final Permission — Engine 6",
    severity,
    fields: [
      ["Paper State", paperDecision ? formatUpper(paperDecision) : "—"],
      ["Paper Direction", paperDirection ? formatUpper(paperDirection) : "—"],
      [
        "Paper Strategy",
        isPaperResearchLane ? formatUpper(paperStrategy, "NONE") : "—",
      ],
      ["Paper Allowed", formatBool(paper?.allowed)],
      ["Ticket Allowed", formatBool(paper?.paperShortAllowed)],
      ["Short Research", formatBool(paper?.shortResearchOnly)],

      ["Real Permission", formatUpper(permission.permission, "UNKNOWN")],
      ["Real Strategy", formatUpper(realStrategy, "NONE")],
      ["Executable", formatBool(permission.executable)],
      ["Watch Only", formatBool(permission.watchOnly)],

      [
        "Authority",
        permission.engine15Authority === true
          ? "Engine 15"
          : permission.engine5Authority === true
          ? "Engine 5"
          : "—",
      ],
    ],
    lines: []  
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

function getWaveContextForScalp({ fastReaction, paperScalp, currentLevelAction }) {
  return (
    fastReaction?.waveContext ||
    paperScalp?.waveContext ||
    currentLevelAction?.waveContext ||
    null
  );
}

function formatScalpStructureLine(waveContext) {
  if (!waveContext?.active) return null;

  const minor = waveContext?.minor?.correctionType
    ? `Minor ${formatUpper(waveContext.minor.activeWave, "—")} / ${formatUpper(
        waveContext.minor.correctionType,
        "—"
      )}`
    : null;

  const minute = waveContext?.minute?.correctionType
    ? `Minute ${formatUpper(waveContext.minute.correctionType, "—")}`
    : null;

  const subminute = waveContext?.subminute?.currentRead
    ? "Subminute C-down watch"
    : null;

  return [minor, minute, subminute].filter(Boolean).join(" → ");
}

function directionFromDegreeDirection(value) {
  const v = String(value || "").toUpperCase();

  if (v === "DOWN" || v === "SHORT" || v.includes("C_DOWN")) return "SHORT";
  if (v === "UP" || v === "LONG" || v.includes("BOUNCE")) return "LONG";

  return "NEUTRAL";
}

function getEngine4StructureDirection(waveContext) {
  return directionFromDegreeDirection(
    waveContext?.subminute?.direction ||
      waveContext?.minute?.direction ||
      waveContext?.minor?.direction ||
      null
  );
}

function formatEngine4WavePath(waveContext) {
  if (!waveContext?.available) return "—";

  const minor = waveContext?.minor
    ? `Minor ${formatUpper(waveContext.minor.activeWave, "—")} / ${formatUpper(
        waveContext.minor.correctionType ||
          waveContext.minor.preferredType ||
          "—"
      )}`
    : null;

  const minute = waveContext?.minute
    ? `Minute ${formatUpper(
        waveContext.minute.correctionType || waveContext.minute.activeWave || "—"
      )}`
    : null;

  const subminute = waveContext?.subminute
    ? `Subminute ${formatUpper(
        waveContext.subminute.activeWave || waveContext.subminute.direction || "—"
      )}`
    : null;

  return [minor, minute, subminute].filter(Boolean).join(" → ") || "—";
}

function getEngine4StructureAlignment(participation) {
  const intendedDirection = String(
    participation?.intendedDirection || participation?.direction || ""
  ).toUpperCase();

  const structureDirection = getEngine4StructureDirection(
    participation?.waveContext
  );

  if (!intendedDirection || intendedDirection === "NEUTRAL") {
    return "NO_TRADE_DIRECTION";
  }

  if (!structureDirection || structureDirection === "NEUTRAL") {
    return "STRUCTURE_DIRECTION_UNKNOWN";
  }

  if (intendedDirection === structureDirection) {
    return structureDirection === "SHORT"
      ? "SUPPORTS_TACTICAL_C_DOWN"
      : "SUPPORTS_SUPPORT_DEFENSE";
  }

  return structureDirection === "SHORT"
    ? "COUNTER_TO_TACTICAL_C_DOWN"
    : "COUNTER_TO_SUPPORT_DEFENSE";
}

function buildEngine4StructureLines(participation) {
  const waveContext = participation?.waveContext || null;

  if (!waveContext?.available) {
    return [
      "Engine 4 structure context is using fallback lifecycle data.",
    ];
  }

  const wavePath = formatEngine4WavePath(waveContext);
  const alignment = getEngine4StructureAlignment(participation);

  return [
    "Engine 4 is reading volume against Engine 22 degreeStates.",
    wavePath !== "—" ? `Wave path: ${wavePath}.` : null,
    alignment === "SUPPORTS_TACTICAL_C_DOWN"
      ? "Participation is aligned with the tactical C-down path."
      : null,
    alignment === "COUNTER_TO_TACTICAL_C_DOWN"
      ? "Participation is counter to the tactical C-down path; treat this as support defense / bounce risk."
      : null,
    alignment === "SUPPORTS_SUPPORT_DEFENSE"
      ? "Participation supports support defense / bounce behavior."
      : null,
    alignment === "COUNTER_TO_SUPPORT_DEFENSE"
      ? "Participation is pushing against support defense."
      : null,
  ].filter(Boolean);
}

function buildEngine3ContextSection(fib) {
  const fastReaction = getEngine3FastImbalanceReaction(fib);
  const currentLevelAction = getCurrentLevelActionReaction(fib);
  const paperScalp = getPaperScalpReaction(fib);
  const lifecycleReaction = getEngine22LifecycleReaction(fib);
  const pullbackReaction = getEngine22PullbackReaction(fib);
  const reaction = getEngine5Reaction(fib);
  const control = getEngine26ControlLevelContext(fib);
  const location = getEngine26LocationContext(fib);

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

    const waveContext = getWaveContextForScalp({
      fastReaction,
      paperScalp,
      currentLevelAction,
    });

    const structureLine = formatScalpStructureLine(waveContext);

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
        [
         "Structure",
         waveContext?.reactionVsStructure
           ? formatUpper(waveContext.reactionVsStructure)
           : "—",
       ],
      ],
      lines: [
        "Short-term scalp read is primary right now.", 
        control?.currentInstruction
          ? `Control map: ${formatText(control.currentInstruction)}.`
          : null,
        location?.locationRead
          ? `Location: ${formatText(location.locationRead)}.`
          : null,
        imbalance.raw
          ? `Active manual imbalance: ${imbalance.raw}`
          : "Active manual imbalance detected.",        
        conflict
          ? `Conflict: fast imbalance says ${formatUpper(
              fastDirection
            )}, current level action says ${formatUpper(currentDirection)}. Wait for one side to win.`
          : null,
        fastReaction.state === "BREAKOUT_FAILING"
          ? "Upper imbalance breakout is failing."
          : null,
        fastReaction.state === "REJECTING_VALUE"
          ? "Price is rejecting imbalance value."
          : null,
        fastReaction.state === "WICK_BELOW_AND_RECLAIM"
          ? "Wick/reclaim detected. Engine 6 still decides."
          : null,
        paperScalp?.allowed === false && asArray(paperScalp.blockers).length
          ? `Paper blockers: ${asArray(paperScalp.blockers)
              .map(formatText)
              .join(", ")}`
          : null,
        "No permission or execution created.",
      ].filter(Boolean),
    };
  }

  if (paperScalp?.active === true) {
    const allowed = paperScalp.allowed === true;
    const waveContext = getWaveContextForScalp({
      fastReaction,
      paperScalp,
      currentLevelAction,
    });

    const structureLine = formatScalpStructureLine(waveContext); 

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
         "Structure",
         waveContext?.reactionVsStructure
           ? formatUpper(waveContext.reactionVsStructure)
           : "—",
       ],
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
  const currentScalpParticipation = getEngine4CurrentScalpParticipation(fib);
  const lifecycleParticipation = getEngine22LifecycleParticipation(fib);
  const volume = getEngine5Volume(fib);
  const control = getEngine26ControlLevelContext(fib);
  const location = getEngine26LocationContext(fib);

  if (fastParticipation?.active === true) {
    const allowed = fastParticipation.allowed === true;
    const hardBlocked = fastParticipation.hardBlocked === true;

    const currentBarVolume = Number(fastParticipation.currentBarVolume);
    const priorBarVolume = Number(fastParticipation.priorBarVolume);
    const volumeRatio = Number(fastParticipation.currentVsPriorVolumeRatio);
    const structuralAlignment = getEngine4StructureAlignment(fastParticipation);
    const wavePath = formatEngine4WavePath(fastParticipation.waveContext);

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
        ["Wave Path", wavePath],
        ["Structure Align", formatUpper(structuralAlignment, "—")],
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
        "Fast imbalance volume read.",
        control?.currentInstruction
          ? `Control map: ${formatText(control.currentInstruction)}.`
          : null,
        location?.handoff?.engine4ShouldTreatInsideShortZoneAs
          ? `Engine 26 handoff: ${formatText(
              location.handoff.engine4ShouldTreatInsideShortZoneAs
            )}.`
          : null,
        fastParticipation.usedFastReactionCandles === true
          ? "Using Engine 3 fast candles."
          : "Using fallback volume context.",
        fastParticipation.volumeIncreasing === true
          ? "Fast volume is increasing versus prior candle."
          : "Fast volume is below prior candle.",
        fastParticipation.supportsFastReactionDirection === true
          ? "Price and volume support Engine 3 direction."
          : "Price and volume do not fully support Engine 3 direction yet.",
        fastParticipation.participationImproving === true
          ? "Participation is improving."
          : "Participation is not improving yet.",
        allowed
          ? "OK for paper review. Engine 6 still decides."
          : "Waiting for better participation before paper allow.",
        "No real permission or execution.",
      ].filter(Boolean),
    };
  } 

  if (currentScalpParticipation?.active === true) {
    const allowed = currentScalpParticipation.allowed === true;
    const hardBlocked = currentScalpParticipation.hardBlocked === true;

    const currentBarVolume = Number(currentScalpParticipation.currentBarVolume);
    const priorBarVolume = Number(currentScalpParticipation.priorBarVolume);
    const volumeRatio = Number(currentScalpParticipation.currentVsPriorVolumeRatio);
    const structuralAlignment = getEngine4StructureAlignment(currentScalpParticipation);
    const wavePath = formatEngine4WavePath(currentScalpParticipation.waveContext);

    return {
      number: 0,
      icon: "④",
      title: "Engine 4 Current Scalp Volume",
      severity: hardBlocked
        ? "danger"
        : allowed
        ? "bullish"
        : currentScalpParticipation.participationQuality === "RISK"
        ? "danger"
        : "warning",
      fields: [
        ["Mode", "CURRENT SCALP"],
        ["Source", formatUpper(currentScalpParticipation.source, "—")],
        ["State", formatUpper(currentScalpParticipation.participationState, "NO SIGNAL")],
        ["Quality", formatUpper(currentScalpParticipation.participationQuality, "WEAK")],
        ["Allowed", formatBool(allowed)],
        ["Hard Block", formatBool(hardBlocked)],
        ["Grade", formatUpper(currentScalpParticipation.grade, "D")],
        ["Risk", formatUpper(currentScalpParticipation.risk, "WAIT")],
        ["Direction", formatUpper(currentScalpParticipation.intendedDirection, "NEUTRAL")],
        ["Wave Path", wavePath],
        ["Structure Align", formatUpper(structuralAlignment, "—")],
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
        "Current Engine 4 scalp volume read.",
        control?.currentInstruction
          ? `Control map: ${formatText(control.currentInstruction)}.`
          : null,
        location?.handoff?.engine4ShouldTreatInsideShortZoneAs
          ? `Engine 26 handoff: ${formatText(
              location.handoff.engine4ShouldTreatInsideShortZoneAs
            )}.`
          : null,
        currentScalpParticipation.fastImbalanceActive === true
          ? "Using fast imbalance volume."
          : "Using paper scalp / level-action volume.",
        currentScalpParticipation.volumeIncreasing === true
          ? "Volume is increasing versus prior candle."
          : "Volume is below prior candle.",
        currentScalpParticipation.supportsDirection === true
          ? "Price and volume support the scalp direction."
          : currentScalpParticipation.againstDirection === true
          ? "Price and volume are fighting the scalp direction."
          : "Price and volume are not aligned yet.",
        currentScalpParticipation.highVolumeNoProgress === true
          ? "Volume is active, but price is not making clean progress."
          : null,
        allowed
          ? "OK for paper review. Engine 6 still decides."
          : hardBlocked
          ? "Blocked until price and volume improve."
         : "Waiting for better participation.",
       "No real permission or execution.",
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
   Engine 22 Degree Stack timeline builders
========================= */

function getEngine22DegreeStates(fib) {
  const waveStrategy = getEngine22WaveStrategy(fib);
  const degreeStates = waveStrategy?.degreeStates || null;

  if (!degreeStates || typeof degreeStates !== "object") return null;

  const hasAnyDegree = ["primary", "intermediate", "minor", "minute", "subminute"].some(
    (degree) => degreeStates?.[degree] && typeof degreeStates[degree] === "object"
  );

  return hasAnyDegree ? degreeStates : null;
}

function formatDisplayLevel(level) {
  if (level == null) return null;

  if (typeof level === "number" || typeof level === "string") {
    const n = Number(level);
    return Number.isFinite(n) ? formatNumber(n) : formatText(level, null);
  }

  if (typeof level !== "object") return null;

  const label =
    level.label ||
    level.name ||
    level.key ||
    level.levelKey ||
    level.ratio ||
    level.fib ||
    null;

  const value =
    level.price ??
    level.value ??
    level.level ??
    level.target ??
    level.hi ??
    level.lo ??
    null;

  if (value == null) return label ? formatText(label) : null;

  const valueText = Number.isFinite(Number(value))
    ? formatNumber(value)
    : formatText(value, null);

  return label ? `${formatText(label)}: ${valueText}` : valueText;
}

function formatDisplayLevels(displayLevels, fallback = "—") {
  if (!displayLevels) return fallback;

  if (Array.isArray(displayLevels)) {
    const items = displayLevels.map(formatDisplayLevel).filter(Boolean);
    return items.length ? items.slice(0, 6).join("  |  ") : fallback;
  }

  if (typeof displayLevels === "object") {
    const items = Object.entries(displayLevels)
      .map(([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return formatDisplayLevel({ key, ...value });
        }

        const valueText = formatDisplayLevel(value);
        return valueText ? `${formatText(key)}: ${valueText}` : null;
      })
      .filter(Boolean);

    return items.length ? items.slice(0, 6).join("  |  ") : fallback;
  }

  return formatDisplayLevel(displayLevels) || fallback;
}

function formatSupportWatch(localSupportWatch) {
  if (!localSupportWatch) return "—";

  if (typeof localSupportWatch === "string") return formatText(localSupportWatch);

  if (Array.isArray(localSupportWatch)) {
    const values = localSupportWatch.map(formatDisplayLevel).filter(Boolean);
    return values.length ? values.join(" → ") : "—";
  }

  if (typeof localSupportWatch === "object") {
    if (localSupportWatch.lo != null && localSupportWatch.hi != null) {
      return `${formatNumber(localSupportWatch.lo)}–${formatNumber(localSupportWatch.hi)}`;
    }

    if (localSupportWatch.low != null && localSupportWatch.high != null) {
      return `${formatNumber(localSupportWatch.low)}–${formatNumber(localSupportWatch.high)}`;
    }

    if (localSupportWatch.from != null && localSupportWatch.to != null) {
      return `${formatNumber(localSupportWatch.from)}–${formatNumber(localSupportWatch.to)}`;
    }

    if (localSupportWatch.level != null) return formatNumber(localSupportWatch.level);

    const values = Object.entries(localSupportWatch)
      .map(([key, value]) => {
        const valueText = formatDisplayLevel(value);
        return valueText ? `${formatText(key)}: ${valueText}` : null;
      })
      .filter(Boolean);

    return values.length ? values.slice(0, 4).join("  |  ") : "—";
  }

  return "—";
}

function formatContextObject(value, fallback = "—") {
  if (!value) return fallback;
  if (typeof value === "string") return formatText(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => formatContextObject(item, null)).filter(Boolean);
    return items.length ? items.join("; ") : fallback;
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "summary",
      "read",
      "headline",
      "action",
      "relationship",
      "purpose",
      "role",
      "stage",
      "type",
      "state",
      "currentRead",
    ];

    const preferred = preferredKeys
      .map((key) => value?.[key])
      .filter((item) => item != null && item !== "")
      .map((item) => formatText(item))
      .filter(Boolean);

    if (preferred.length) return preferred.join("; ");

    const entries = Object.entries(value)
      .filter(([, item]) => item != null && item !== "")
      .slice(0, 5)
      .map(([key, item]) => `${formatText(key)}: ${formatContextObject(item, "—")}`);

    return entries.length ? entries.join("; ") : fallback;
  }

  return formatText(value, fallback);
}

function getAlternateCorrectionText(correctionModels) {
  const alternate =
    correctionModels?.models?.abcDown ||
    correctionModels?.alternateModels ||
    correctionModels?.alternateType ||
    correctionModels?.alternate ||
    null;

  if (!alternate) return "—";

  if (Array.isArray(alternate)) {
    const items = alternate.map((item) => formatContextObject(item, null)).filter(Boolean);
    return items.length ? items.join("; ") : "—";
  }

  return formatContextObject(alternate);
}

function buildDegreeSummaryLine(label, state) {
  if (!state) return null;

  const headline = state.headline ? `${label}: ${formatText(state.headline)}` : null;
  const read = state.currentRead ? `${label} read: ${formatText(state.currentRead)}` : null;
  const action = state.action ? `${label} action: ${formatText(state.action)}` : null;

  return [headline, read, action].filter(Boolean).join(" ");
}

function buildEngine22DegreeBadges(degreeStates, permission) {
  const safetyFlags = [
    degreeStates?.primary,
    degreeStates?.intermediate,
    degreeStates?.minor,
    degreeStates?.minute,
    degreeStates?.subminute,
  ].filter(Boolean);

  const noExecution = safetyFlags.some((degree) => degree?.noExecution === true);
  const watchOnly = safetyFlags.some((degree) => degree?.watchOnly === true);
  const noPermissionCreated = safetyFlags.some(
    (degree) => degree?.noPermissionCreated === true
  );

  return [
    { label: "ES", severity: "blue" },
    { label: "ENGINE 22 DEGREE STACK", severity: "teal" },
    noExecution ? { label: "NO EXECUTION", severity: "purple" } : null,
    noPermissionCreated
      ? { label: "NO PERMISSION CREATED", severity: "purple" }
      : null,
    watchOnly ? { label: "WATCH ONLY", severity: "warning" } : null,
    buildPermissionBadge(permission),
  ].filter(Boolean);
}

function buildHigherTimeframeTrendSection(degreeStates) {
  const primary = degreeStates?.primary || null;
  const intermediate = degreeStates?.intermediate || null;

  return {
    number: 1,
    icon: "↗",
    title: "Higher-Timeframe Trend",
    severity: "bullish",
    fields: [
      ["Primary", formatUpper(primary?.activeWave || primary?.stage, "—")],
      ["Primary Targets", formatDisplayLevels(primary?.targetModel?.displayLevels)],
      ["Intermediate", formatUpper(intermediate?.activeWave || intermediate?.stage, "—")],
      [
        "Intermediate Targets",
        formatDisplayLevels(intermediate?.targetModel?.displayLevels),
      ],
    ],
    lines: [
      buildDegreeSummaryLine("Primary", primary),
      buildDegreeSummaryLine("Intermediate", intermediate),
      "Higher-timeframe degrees are context and target maps only. No execution comes from this section.",
    ].filter(Boolean),
  };
}

function buildActiveCorrectionSection(degreeStates) {
  const minor = degreeStates?.minor || null;
  const correctionModel = minor?.correctionModel || null;
  const correctionModels = minor?.correctionModels || null;

  const preferredType =
    correctionModels?.preferredType ||
    correctionModel?.type ||
    correctionModel?.correctionType ||
    "—";

  const stage = correctionModel?.stage || minor?.stage || "—";
  const alternateText = getAlternateCorrectionText(correctionModels);
  const localSupport = formatSupportWatch(minor?.targetModel?.localSupportWatch);

  return {
    number: 2,
    icon: "〽",
    title: "Active Correction",
    severity: "warning",
    fields: [
      ["Minor", formatUpper(minor?.activeWave || minor?.stage, "—")],
      ["Preferred Model", formatUpper(preferredType, "—")],
      ["Stage", formatUpper(stage, "—")],
      ["Alternate Path", alternateText],
      ["Local Support Watch", localSupport],
      ["Minor Targets", formatDisplayLevels(minor?.targetModel?.displayLevels)],
    ],
    lines: [
      buildDegreeSummaryLine("Minor", minor),
      correctionModel ? `Preferred correction: ${formatContextObject(correctionModel)}.` : null,
      alternateText !== "—" ? `Alternate correction path: ${alternateText}.` : null,
      localSupport !== "—" ? `Local support / bounce watch: ${localSupport}.` : null,
    ].filter(Boolean),
  };
}

function buildNestedCorrectionSection(degreeStates) {
  const minute = degreeStates?.minute || null;
  const subminute = degreeStates?.subminute || null;

  const minuteNested = formatContextObject(minute?.nestedCorrectionContext);
  const subminuteNested = formatContextObject(subminute?.nestedCorrectionContext);

  return {
    number: 3,
    icon: "⇣",
    title: "Nested Correction / Tactical Path",
    severity: "teal",
    fields: [
      ["Minute", formatUpper(minute?.activeWave || minute?.stage, "—")],
      ["Minute Nested Context", minuteNested],
      ["Subminute", formatUpper(subminute?.activeWave || subminute?.stage, "—")],
      ["Subminute Nested Context", subminuteNested],
    ],
    lines: [
      "Nested relationship: Minor E leg → Minute internal ABC down → Subminute tactical timing.",
      buildDegreeSummaryLine("Minute", minute),
      minuteNested !== "—" ? `Minute nested context: ${minuteNested}.` : null,
      buildDegreeSummaryLine("Subminute", subminute),
      subminuteNested !== "—" ? `Subminute nested context: ${subminuteNested}.` : null,
      "Minute and Subminute are nested correction context, not independent stale W5 layouts.",
    ].filter(Boolean),
  };
}

function buildTargetLevelMapSection(degreeStates) {
  const primary = degreeStates?.primary || null;
  const intermediate = degreeStates?.intermediate || null;
  const minor = degreeStates?.minor || null;

  const localSupport = formatSupportWatch(minor?.targetModel?.localSupportWatch);

  return {
    number: 4,
    icon: "⑸",
    title: "Target & Level Map",
    severity: "blue",
    fields: [
      ["Primary Target Map", formatDisplayLevels(primary?.targetModel?.displayLevels)],
      [
        "Intermediate Target Map",
        formatDisplayLevels(intermediate?.targetModel?.displayLevels),
      ],
      ["Minor Target Map", formatDisplayLevels(minor?.targetModel?.displayLevels)],
      ["Local Support Watch", localSupport],
    ],
    lines: [
      "Target map is displayed from Engine 22 generated targetModel.displayLevels only.",
      "React is not calculating fibs or inferring wave state.",
      localSupport !== "—" ? `Minor local support / bounce watch: ${localSupport}.` : null,
    ].filter(Boolean),
  };
}

function buildEngine22SafetySection(degreeStates) {
  const degrees = [
    degreeStates?.primary,
    degreeStates?.intermediate,
    degreeStates?.minor,
    degreeStates?.minute,
    degreeStates?.subminute,
  ].filter(Boolean);

  const noExecution = degrees.some((degree) => degree?.noExecution === true);
  const noPermissionCreated = degrees.some(
    (degree) => degree?.noPermissionCreated === true
  );
  const watchOnly = degrees.some((degree) => degree?.watchOnly === true);

  const reasonCodes = degrees.flatMap((degree) => asArray(degree?.reasonCodes));

  return {
    number: 5,
    icon: "⬟",
    title: "Safety / Permission",
    severity: "purple",
    fields: [
      ["Engine 22 Role", "STRUCTURAL ONLY"],
      ["No Execution", formatBool(noExecution, "YES")],
      ["No Permission Created", formatBool(noPermissionCreated, "YES")],
      ["Watch Only", formatBool(watchOnly, "YES")],
    ],
    lines: [
      "Engine 22 is structural only.",
      "No execution permission is created.",
      "Engine 15 controls readiness.",
      "Engine 6 controls final permission.",
      reasonCodes.length
        ? `Engine 22 reasons: ${reasonCodes.slice(0, 8).map(formatText).join(", ")}`
        : null,
    ].filter(Boolean),
  };
}

function getCompactCorrectionLabel(minor) {
  const correctionModel = minor?.correctionModel || null;
  const correctionModels = minor?.correctionModels || null;

  return formatUpper(
    correctionModels?.preferredType ||
      correctionModel?.type ||
      correctionModel?.correctionType ||
      "—"
  );
}

function getCompactCorrectionStage(minor) {
  return formatUpper(
    minor?.correctionModel?.stage || minor?.stage || minor?.currentRead || "—"
  );
}

function buildEngine26ControlMapSection(fib) {
  const structural = getEngine26StructuralContext(fib);
  const control = getEngine26ControlLevelContext(fib);
  const location = getEngine26LocationContext(fib);

  if (!structural && !control && !location) return null;

  const hasFullControlMap = !!control || !!location;

  const bearTargets =
    control?.bearishPath?.nextTargets ||
    structural?.targetPathPreview ||
    structural?.levels?.bearTargets ||
    [];

  const bullTargets =
    control?.bullishPath?.nextTargets ||
    structural?.levels?.bullTargets ||
    [];

  const currentControlState =
    control?.currentControlState ||
    structural?.controlState ||
    structural?.status ||
    null;

  const currentInstruction =
    control?.currentInstruction ||
    structural?.preferredAction ||
    structural?.action ||
    null;

  const currentPrice =
    control?.currentPrice ??
    location?.currentPrice ??
    structural?.currentPrice ??
    null;

  const bearLevel =
    control?.bearControlLevel ??
    structural?.levels?.bearControlLevel ??
    structural?.levels?.bearControl ??
    structural?.levels?.shortTriggerLevel ??
    null;

  const bullLevel =
    control?.bullRecoveryLevel ??
    structural?.levels?.bullRecoveryLevel ??
    structural?.levels?.bullRecovery ??
    structural?.levels?.invalidationLevel ??
    null;

  const shortTrigger =
    location?.shortTriggerLevel ??
    structural?.levels?.shortTriggerLevel ??
    structural?.shortTriggerLevel ??
    null;

  const invalidation =
    location?.invalidationLevel ??
    structural?.invalidation?.level ??
    structural?.invalidationLevel ??
    structural?.levels?.invalidationLevel ??
    null;

  const locationRead =
    location?.locationRead ||
    structural?.locationRead ||
    structural?.activeImbalanceRole ||
    null;

  const title = hasFullControlMap
    ? "Control Map — Engine 26"
    : "Structural Map — Engine 26";

  const severity =
    control?.bearControlRejecting === true
      ? "danger"
      : control?.bullRecoveryHolding === true
      ? "bullish"
      : control?.betweenLevels === true
      ? "warning"
      : String(structural?.preferredDirection || "").toUpperCase().includes("SHORT")
      ? "danger"
      : "teal";

  return {
    number: 2,
    icon: "⑳",
    title,
    severity,
    fields: hasFullControlMap
      ? [
          ["Current", formatNumber(currentPrice)],
          ["Control State", formatUpper(currentControlState, "—")],
          ["Instruction", formatUpper(currentInstruction, "—")],
          ["Bear Level", formatNumber(bearLevel)],
          ["Bull Level", formatNumber(bullLevel)],
          ["Location", formatUpper(locationRead, "—")],
          ["Short Trigger", formatNumber(shortTrigger)],
          ["Invalidation", formatNumber(invalidation)],
          ["Bear Targets", formatTargetPath(bearTargets)],
          ["Bull Targets", formatTargetPath(bullTargets)],
        ]
      : [
          ["Status", formatUpper(structural?.status, "—")],
          ["Template", formatUpper(structural?.template, "—")],
          ["Role", formatUpper(structural?.activeImbalanceRole, "—")],
          ["Bias", formatUpper(structural?.structuralBias, "—")],
          ["Direction", formatUpper(structural?.preferredDirection, "—")],
          ["Action", formatUpper(structural?.preferredAction, "—")],
          ["Short Research", formatBool(structural?.shortResearchOnly)],
          ["Do Not Chase Long", formatBool(structural?.doNotChaseLong)],
          ["Target Path", formatTargetPath(structural?.targetPathPreview)],
          ["Invalidation", formatNumber(invalidation)],
        ],
    lines: hasFullControlMap
      ? [
          location?.tacticalMeaning || null,
          control?.betweenLevels === true
            ? "Between 7500 and 7560 is the decision zone. No clean permission here."
            : null,
          control?.bearControlRejecting === true
            ? "7500 is rejecting — bear control is active. Watch lower targets."
            : null,
          control?.bullRecoveryHolding === true
            ? "7560 is holding — short watch is weakening and recovery path is active."
            : null,
          `Bear path: ${formatText(
            control?.bearishPath?.trigger,
            "Failed reclaim / lost bear control"
          )}. Targets: ${formatTargetPath(bearTargets)}.`,
          `Bull path: ${formatText(
            control?.bullishPath?.trigger,
            "Reclaim and hold bull recovery"
          )}. Targets: ${formatTargetPath(bullTargets)}.`,
          "Engine 3 must confirm level reaction. Engine 4 must confirm participation. Engine 6 remains final.",
          "No permission. No ticket. No execution.",
        ].filter(Boolean)
      : [
          "Full location/control map fields are not present yet, so this card is showing the canonical Engine 26 structural map.",
          structural?.confirmationNeeds
            ? `Confirmation needs: ${asArray(structural.confirmationNeeds)
                .map(formatText)
                .join(", ")}`
            : null,
          "Engine 26 gives the map only. Engine 15 checks readiness. Engine 6 remains final.",
          "No permission. No ticket. No execution.",
        ].filter(Boolean),
  };
}
function buildEngine22CompactStructureSection(degreeStates) {
  if (!degreeStates) return null;

  const primary = degreeStates?.primary || null;
  const intermediate = degreeStates?.intermediate || null;
  const minor = degreeStates?.minor || null;
  const minute = degreeStates?.minute || null;
  const subminute = degreeStates?.subminute || null;

  const primaryWave = formatUpper(primary?.activeWave || primary?.stage, "—");
  const intermediateWave = formatUpper(
    intermediate?.activeWave || intermediate?.stage,
    "—"
  );
  const minorWave = formatUpper(minor?.activeWave || minor?.stage, "—");
  const minuteWave = formatUpper(minute?.activeWave || minute?.stage, "—");
  const subminuteWave = formatUpper(
    subminute?.activeWave || subminute?.stage,
    "—"
  );

  const correctionLabel = getCompactCorrectionLabel(minor);
  const correctionStage = getCompactCorrectionStage(minor);
  const localSupport = formatSupportWatch(minor?.targetModel?.localSupportWatch);

  const minuteRead = minute?.currentRead || minute?.headline || minute?.action || null;
  const subminuteRead =
    subminute?.currentRead || subminute?.headline || subminute?.action || null;

  return {
    number: 1,
    icon: "〽",
    title: "Engine 22 Compact Structure",
    severity: "teal",
    fields: [
      ["Structure", `Primary ${primaryWave} | Intermediate ${intermediateWave}`],
      ["Correction", `Minor ${minorWave} | ${correctionLabel} | ${correctionStage}`],
      ["Tactical Path", `Minute ${minuteWave} → Subminute ${subminuteWave}`],
      ["Key Level", localSupport !== "—" ? `Support ${localSupport}` : "—"],
      ["Role", "STRUCTURAL ONLY / NO PERMISSION"],
    ],
    lines: [
      minor?.headline || minor?.currentRead
        ? `Minor: ${formatText(minor.headline || minor.currentRead)}.`
        : null,
      minuteRead || subminuteRead
        ? `Nested: ${minuteRead ? formatText(minuteRead) : "Minute watch"} → ${
            subminuteRead ? formatText(subminuteRead) : "Subminute tactical watch"
          }.`
        : "Nested: Minor E leg → Minute internal ABC down → Subminute tactical timing.",
      "No execution permission is created. Engine 15 controls readiness. Engine 6 controls final permission.",
    ].filter(Boolean),
  };
}

function buildEngine22DegreeTimelineSections(degreeStates) {
  if (!degreeStates) return [];

  return [buildEngine22CompactStructureSection(degreeStates)].filter(Boolean);
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
  const degreeStates = getEngine22DegreeStates(fib);
  const hasDegreeStates = degreeStates != null;

  const lifecycleViews = getLifecycleViews(fib);
  const lifecycleViewSections = hasDegreeStates
    ? []
    : buildLifecycleViewSections(lifecycleViews);
  const hasLifecycleViews = lifecycleViewSections.length > 0;

  const postAbcBounceSection = hasDegreeStates
    ? null
    : buildPostAbcBounceSection(tradeContextSummary, waveOpportunity);

  const marketMeterSection = getBackendTimelineSection(
    fib,
    "Market Meter / Tactical Context"
  );

  const headline = hasDegreeStates
    ? "Engine 22 Wave Stack — Current Structure"
    : hasLifecycleViews
    ? `${formatText(
        lifecycleViews?.longTerm?.label,
        "Intermediate W3 active"
      )} / ${formatText(
        lifecycleViews?.intradayScalp?.label,
        "Minute W4 pullback watch"
      )}`
    : currentLifecycleState?.headline ||
      backendTimelineRead?.headline ||
      tradeContextSummary?.headline ||
      buildFallbackHeadline({ waveOpportunity, engine15 });

  const engine26Control = getEngine26ControlLevelContext(fib);
  const engine26Location = getEngine26LocationContext(fib);

  const controlSubheadline =
    engine26Control?.currentInstruction
      ? `Control Map: ${formatText(engine26Control.currentInstruction)}. 7500 = bear control / 7560 = bull recovery.`
      : null;

  const locationSubheadline =
    engine26Location?.locationRead
      ? `Location: ${formatText(engine26Location.locationRead)}.`
      : null; 

  const subheadline = hasDegreeStates
  ? [
      "Primary and Intermediate remain higher-timeframe continuation context; Minor / Minute / Subminute define the active correction and tactical path. Structural only — no execution permission.",
      controlSubheadline,
      locationSubheadline,
    ]
      .filter(Boolean)
      .join(" ")
  : hasLifecycleViews
  ? "Higher-timeframe lifecycle and intraday scalp lifecycle are shown separately. Structural only — no execution permission."
  : currentLifecycleState?.summary ||
    backendTimelineRead?.subheadline ||
    tradeContextSummary?.summary ||
    buildFallbackSubheadline({ waveOpportunity, engine15 });

const lifecycleOwnsDisplay =
  !hasDegreeStates && isCurrentLifecycleDisplayOverride(currentLifecycleState);

  const permissionBadge = buildPermissionBadge(permission);

  const badges = hasDegreeStates
    ? buildEngine22DegreeBadges(degreeStates, permission)
    : lifecycleOwnsDisplay
    ? [
        ...buildCurrentLifecycleBadges(currentLifecycleState),
        permissionBadge,
      ].filter(Boolean)
    : [
        ...buildCurrentLifecycleBadges(currentLifecycleState),
        ...buildBadges({ waveOpportunity, engine15, permission }),
      ].filter(Boolean);

  const degreeTimelineSections = buildEngine22DegreeTimelineSections(degreeStates);
  const engine26ControlMapSection = buildEngine26ControlMapSection(fib);

  const sections = [
    ...(hasDegreeStates ? degreeTimelineSections : lifecycleViewSections),

    engine26ControlMapSection,

    hasDegreeStates || hasLifecycleViews
      ? null
      : buildCurrentLifecycleStateSection(currentLifecycleState, fib),

    hasDegreeStates || hasLifecycleViews || lifecycleOwnsDisplay
      ? null
      : buildWaveOpportunitySection(waveOpportunity, fib),

    hasDegreeStates ? null : buildPossibleW5UpCompleteSection(fib),
    hasDegreeStates ? null : buildPostMinor5CorrectiveBounceSection(fib),
    postAbcBounceSection,
    buildEngine27TraderIntelligenceSection(fib),
    buildPermissionSection(permission, engine15),

    lifecycleOwnsDisplay && !hasLifecycleViews
      ? buildLifecycleNextStepsSection(currentLifecycleState, fib)
      : buildNextStepsSection({
          waveOpportunity,
          engine15,
          permission,
          fib,
          tradeContextSummary,
        }),

    buildCanonicalMinuteStageTimelineSection(fib),
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
  ]
    .filter(Boolean)
    .map((section, idx) => ({
      ...section,
      number: idx + 1,
    }));

  const severity = hasDegreeStates
    ? "teal"
    : backendTimelineRead?.severity ||
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
    permission,
    footer: permission?.executable === true ? "EXECUTION ELIGIBLE" : "WATCH",
  };
}

function normalizeSubminuteTimelineData({ overlayData }) {
  if (!overlayData?.ok) {
    return {
      show: false,
    };
  }

  const fib = getFib(overlayData);
  const subminuteDecision = getEngine27SubminuteTraderDecision(fib);

  return {
    show: true,
    severity: subminuteDecision?.noExecution === false ? "bullish" : "teal",
    headline: "Subminute Trader Intelligence",
    subheadline:
      "Read-only Subminute lane. No Minute decision or Minute timeline data is reused.",
    badges: [
      { label: "ES", severity: "blue" },
      { label: "SUBMINUTE", severity: "teal" },
      subminuteDecision?.noExecution === true
        ? { label: "NO EXECUTION", severity: "purple" }
        : null,
    ].filter(Boolean),
    sections: [
      buildEngine27TraderIntelligenceSection(fib, subminuteDecision),
      {
        number: 2,
        icon: "⑩",
        title: "Canonical Subminute Stage Timeline",
        severity: "warning",
        fields: [],
        lines: ["Timeline not attached yet."],
      },
    ],
    contextSections: [],
    permission: null,
    footer: subminuteDecision?.noExecution === true ? "WATCH" : null,
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
  textTransform: "none",
  letterSpacing: "0.015em",
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

function CanonicalStageGrid({ stages }) {
  const safeStages = asArray(stages);

  if (!safeStages.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 9,
        marginTop: 8,
      }}
    >
      {safeStages.map((stage, idx) => (
        <div
          key={`${stage.id || stage.label || "stage"}-${idx}`}
          style={{
            border: `1px solid ${severityBorder(stage.severity)}`,
            background: severityBackground(stage.severity),
            borderRadius: 9,
            padding: "9px 10px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              ...shellTextStyle,
              color: MAIN_TEXT,
              fontSize: 15,
              fontWeight: FONT_MEDIUM,
              lineHeight: 1.3,
              marginBottom: 4,
            }}
          >
            {stage.label}
          </div>

          <div
            style={{
              ...shellTextStyle,
              color: severityColor(stage.severity),
              fontSize: 14,
              fontWeight: FONT_MEDIUM,
              letterSpacing: "0.02em",
              lineHeight: 1.3,
            }}
          >
            {stage.status}
          </div>

          {stage.sourceEngine && (
            <div
              style={{
                ...shellTextStyle,
                color: MUTED_TEXT,
                fontSize: 12,
                fontWeight: FONT_REGULAR,
                lineHeight: 1.3,
                marginTop: 4,
              }}
            >
              Source Engine: {stage.sourceEngine}
            </div>
          )}
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
          <CanonicalStageGrid stages={section.canonicalStages} />

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

function MinimalStatusStrip({ timeline }) {
  const permission = timeline?.permission || null;
  const paper = permission?.paper || null;

  const paperDecision = String(paper?.decision || "").toUpperCase();
  const paperDirection = String(paper?.direction || "").toUpperCase();

  const isStructuralFastWatch =
    paperDecision === "STRUCTURAL_FAST_WATCH" ||
    paper?.structuralWatchOnly === true;

  const isShortResearchWatch =
    paperDecision === "PAPER_SHORT_RESEARCH_WATCH" ||
    paper?.shortResearchWatch === true;

  const marketBiasLabel =
    isStructuralFastWatch || isShortResearchWatch
      ? "Short watch"
      : paperDirection === "SHORT"
      ? "Short"
      : paperDirection === "LONG"
      ? "Long"
      : "Neutral";

  const marketBiasColor =
    isStructuralFastWatch || isShortResearchWatch || paperDirection === "SHORT"
      ? "#fb7185"
      : paperDirection === "LONG"
      ? "#22c55e"
      : "#cbd5e1";

  const setupLabel =
    isShortResearchWatch
      ? "Short research"
      : isStructuralFastWatch
      ? "Structural watch"
      : paperDecision
      ? formatText(paperDecision)
      : "Watch";

  const setupColor =
    isShortResearchWatch || isStructuralFastWatch
      ? "#fb7185"
      : "#fbbf24";

  const permissionLabel =
    paper?.allowed === true
      ? "Paper allow"
      : formatUpper(permission?.permission, "REDUCE") === "REDUCE"
      ? "Reduce"
      : formatText(permission?.permission, "Wait");

  return (
    <div
      style={{
        ...shellTextStyle,
        width: "100%",
        border: "1px solid rgba(148,163,184,0.20)",
        borderRadius: 12,
        background: "rgba(6,10,20,0.86)",
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0,1fr))",
        color: "#cbd5e1",
        pointerEvents: "none",
        backdropFilter: "blur(4px)",
        overflow: "hidden",
      }}
    >
      <div style={stripCellStyle}>
        <span style={stripLabelStyle}>Market bias</span>
        <span style={{ ...stripValueStyle, color: marketBiasColor }}>
          {marketBiasLabel}
        </span>
      </div>
      <div style={stripCellStyle}>
        <span style={stripLabelStyle}>Setup</span>
        <span style={{ ...stripValueStyle, color: setupColor }}>
          {setupLabel}
        </span>
      </div>
      <div style={{ ...stripCellStyle, borderRight: "none" }}>
        <span style={stripLabelStyle}>Trade permission</span>
        <span style={{ ...stripValueStyle, color: "#c084fc" }}>
          {permissionLabel}
        </span>
      </div>
    </div>
  );
}

function TimelineMainCard({ timeline }) {
  return (
    <div
      style={{
        ...shellTextStyle,
        width: "100%",
        maxHeight: "calc(100vh - 185px)",
        overflowY: "auto",
        borderRadius: 15,
        border: `1px solid ${severityBorder(timeline.severity)}`,
        background: CARD_BG_STRONG,
        padding: "18px 19px",
        color: "#e5e7eb",
        pointerEvents: "none",
        backdropFilter: "blur(5px)",
        boxShadow: "0 12px 34px rgba(0,0,0,0.34)",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          ...shellTextStyle,
          fontSize: 27,
          fontWeight: 600,
          color: "#fbbf24",
          letterSpacing: "0.005em",
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
            fontSize: 15,
            lineHeight: 1.5,
            fontWeight: 400,
            margin: "0 0 11px",
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
            justifyContent: "flex-start",
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

      <div style={{ display: "grid", gap: 10 }}>
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
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid rgba(148,163,184,0.25)",
            color: MUTED_TEXT,
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          {formatText(timeline.footer)}
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
        width: "100%",
        maxHeight: "calc(100vh - 100px)",
        overflowY: "auto",
        border: "1px solid rgba(148,163,184,0.35)",
        borderRadius: 15,
        background: CARD_BG,
        padding: "14px",
        color: "#e5e7eb",
        pointerEvents: "none",
        boxShadow: "0 10px 28px rgba(0,0,0,0.32)",
        backdropFilter: "blur(5px)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          ...shellTextStyle,
          color: MAIN_TEXT,
          fontWeight: 600,
          fontSize: 19,
          marginBottom: 12,
        }}
      >
        Market Context
      </div>

      <div style={{ display: "grid", gap: 10 }}>
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


function WavelengthTabs({ selectedDegree, onSelect }) {
  return (
    <div
      style={{
        ...shellTextStyle,
        gridColumn: "1 / -1",
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 8,
        padding: 8,
        border: "1px solid rgba(148,163,184,0.25)",
        borderRadius: 12,
        background: "rgba(6,10,20,0.92)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
        pointerEvents: "auto",
      }}
    >
      {WAVELENGTH_TABS.map((tab) => {
        const active = selectedDegree === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            style={{
              ...shellTextStyle,
              border: active
                ? "1px solid rgba(56,189,248,0.85)"
                : "1px solid rgba(148,163,184,0.24)",
              borderRadius: 9,
              background: active
                ? "rgba(12,74,110,0.42)"
                : "rgba(15,23,42,0.52)",
              color: active ? "#7dd3fc" : "#cbd5e1",
              padding: "9px 10px",
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              boxShadow: active
                ? "0 0 18px rgba(56,189,248,0.18)"
                : "none",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function UnattachedLaneCard({ selectedDegree }) {
  const lane =
    WAVELENGTH_TABS.find((tab) => tab.key === selectedDegree)?.label ||
    "Selected";

  return (
    <div
      style={{
        ...shellTextStyle,
        width: "100%",
        borderRadius: 15,
        border: "1px solid rgba(251,191,36,0.48)",
        background: CARD_BG_STRONG,
        padding: "22px 20px",
        color: "#e5e7eb",
        boxShadow: "0 12px 34px rgba(0,0,0,0.34)",
        boxSizing: "border-box",
        textAlign: "left",
      }}
    >
      <div
        style={{
          color: "#fbbf24",
          fontSize: 25,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {lane} Timeline
      </div>

      <div
        style={{
          color: SOFT_TEXT,
          fontSize: 16,
          lineHeight: 1.5,
        }}
      >
        Timeline not attached yet.
      </div>

      <div
        style={{
          color: MUTED_TEXT,
          fontSize: 14,
          lineHeight: 1.45,
          marginTop: 8,
        }}
      >
        Minute remains the only canonical lane wired in this phase. No Minute
        data is being reused for this tab.
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
  const [selectedDegree, setSelectedDegree] = useState("minute");
  const timeline = normalizeTimelineData({ overlayData, chartMode });
  const subminuteTimeline = normalizeSubminuteTimelineData({
    overlayData,
    chartMode,
  });

  if (!visible || !timeline?.show) return null;

  const minuteSelected = selectedDegree === "minute";
  const subminuteSelected = selectedDegree === "subminute";

  return (
    <div
      style={{
        ...shellTextStyle,
        position: "absolute",
        top: 88,
        left: 18,
        right: 470,
        zIndex: 108,
        display: "grid",
        gridTemplateColumns: "minmax(330px, 430px) minmax(560px, 760px)",
        justifyContent: "center",
        alignItems: "start",
        gap: 14,
        pointerEvents: "none",
      }}
    >
      <WavelengthTabs
        selectedDegree={selectedDegree}
        onSelect={setSelectedDegree}
      />

      <ContextTimelinePanel sections={timeline.contextSections} />

      <div
        style={{
          display: "grid",
          gap: 12,
          minWidth: 0,
        }}
      >
        {minuteSelected ? (
          <>
            <MinimalStatusStrip timeline={timeline} />
            <TimelineMainCard timeline={timeline} />
          </>
        ) : subminuteSelected ? (
          <TimelineMainCard timeline={subminuteTimeline} />
        ) : (
          <UnattachedLaneCard selectedDegree={selectedDegree} />
        )}
      </div>
    </div>
  );
}
