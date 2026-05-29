// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

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

function getWaveOpportunity(fib) {
  const waveStrategy = getEngine22WaveStrategy(fib);

  return (
    waveStrategy?.waveOpportunity ||
    fib?.waveOpportunity ||
    getStrategyRoot(fib)?.waveOpportunity ||
    null
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

  return (
    root?.permission ||
    fib?.permission ||
    root?.finalPermission ||
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
  return getConfluence(fib)?.components?.engine4Volume || null;
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

function getEngine16(fib) {
  const root = getStrategyRoot(fib);
  return root?.engine16 || fib?.engine16 || null;
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
   Timeline builders
========================= */

function buildHeadline({ waveOpportunity, engine15 }) {
  const degree = titleCase(waveOpportunity?.degree, "Wave");
  const setup = formatUpper(waveOpportunity?.setupType, "W3/W5");
  const readiness = formatUpper(
    waveOpportunity?.readiness || engine15?.readinessLabel,
    "WATCH"
  );
  const chaseRisk = formatUpper(waveOpportunity?.chaseRisk, "");

  if (isDangerChase(chaseRisk)) {
    return `${degree} ${setup} ${readiness} — NO CHASE`;
  }

  return `${degree} ${setup} ${readiness}`;
}

function buildSubheadline({ waveOpportunity, engine15 }) {
  if (waveOpportunity?.summary) {
    return waveOpportunity.summary;
  }

  if (engine15?.summary) {
    return engine15.summary;
  }

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
    badges.push({
      label: formatUpper(waveOpportunity?.direction || engine15?.direction),
      severity:
        String(waveOpportunity?.direction || engine15?.direction).toUpperCase() === "LONG"
          ? "bullish"
          : "danger",
    });
  }

  if (waveOpportunity?.readiness || engine15?.readinessLabel) {
    badges.push({
      label: formatUpper(waveOpportunity?.readiness || engine15?.readinessLabel),
      severity: isReadyState(waveOpportunity?.readiness || engine15?.readinessLabel)
        ? "bullish"
        : "warning",
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
      severity: isDangerChase(waveOpportunity.chaseRisk) ? "danger" : "warning",
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

function buildWaveOpportunitySection(waveOpportunity) {
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

  const targetsText = getTargets(waveOpportunity)
    .map(([level, price]) => `${level}: ${formatNumber(price)}`)
    .join("  |  ");

  return {
    number: 1,
    icon: "〽",
    title: "Wave Opportunity — Engine 22",
    severity: isDangerChase(waveOpportunity.chaseRisk) ? "warning" : "bullish",
    fields: [
      ["Setup", formatUpper(waveOpportunity.setupType, "NONE")],
      ["Raw Setup", formatUpper(waveOpportunity.rawSetup, "—")],
      ["Degree", titleCase(waveOpportunity.degree, "—")],
      ["Direction", formatUpper(waveOpportunity.direction, "NONE")],
      ["Readiness", formatUpper(waveOpportunity.readiness, "UNKNOWN")],
      ["Timing", formatUpper(waveOpportunity.timing, "UNKNOWN")],
      ["Chase Risk", formatUpper(waveOpportunity.chaseRisk, "UNKNOWN")],
      ["Targets", targetsText || "—"],
    ],
    lines: [
      waveOpportunity.summary
        ? `Summary: ${waveOpportunity.summary}`
        : "Summary: Waiting for Engine 22 wave opportunity summary.",
    ],
  };
}

function buildEngine15Section(engine15) {
  if (!engine15) {
    return {
      number: 2,
      icon: "▣",
      title: "Setup Readiness — Engine 15ES",
      severity: "warning",
      fields: [],
      lines: ["Engine 15ES decision unavailable."],
    };
  }

  const next =
    engine15.nextSetupType ||
    engine15.lifecycle?.nextFocus ||
    "WAIT_FOR_CONFIRMATION";

  const needs = asArray(engine15.needs)
    .map((need) => formatText(need))
    .join(", ");

  return {
    number: 2,
    icon: "▣",
    title: "Setup Readiness — Engine 15ES",
    severity: isReadyState(engine15.readinessLabel)
      ? "bullish"
      : isWatchState(engine15.readinessLabel)
      ? "blue"
      : "warning",
    fields: [
      ["Readiness", formatUpper(engine15.readinessLabel, "UNKNOWN")],
      ["Strategy", formatUpper(engine15.strategyType, "NONE")],
      ["Direction", formatUpper(engine15.direction, "NONE")],
      ["Action", formatUpper(engine15.action, "WATCH")],
      [
        "Quality",
        `${formatScore(engine15.qualityScore)} / ${formatUpper(
          engine15.qualityGrade || engine15.qualityBand,
          "—"
        )}`,
      ],
      ["Next", formatUpper(next)],
    ],
    lines: needs ? [`Needs: ${needs}`] : ["Needs: waiting for confirmation."],
  };
}

function buildEngine5Section(fib) {
  const reaction = getEngine5Reaction(fib);
  const volume = getEngine5Volume(fib);
  const timing = getEngine5Timing(fib);

  const reactionText = reaction
    ? compactJoin([
        formatText(reaction.quality, "UNKNOWN"),
        formatText(reaction.direction, ""),
        reaction.confirmed || reaction.cleanReaction ? "confirmed" : "not confirmed",
      ], " / ")
    : "Unavailable";

  const volumeText = volume
    ? compactJoin([
        formatText(volume.quality || volume.participationQuality, "UNKNOWN"),
        volume.cleanParticipation ? "clean participation" : "clean participation not confirmed",
      ], " / ")
    : "Unavailable";

  const timingText = timing
    ? compactJoin([
        formatText(timing.entryTiming, "UNKNOWN"),
        timing.chaseRisk ? `chase risk ${formatText(timing.chaseRisk)}` : null,
        timing.suggestedAction ? formatText(timing.suggestedAction) : null,
      ], " / ")
    : "Unavailable";

  const hasWarning =
    volume?.cleanParticipation === false ||
    timing?.moveAlreadyHappened === true ||
    timing?.noChaseContext === true ||
    isDangerChase(timing?.chaseRisk);

  return {
    number: 3,
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
      number: 4,
      icon: "⬟",
      title: "Final Permission — Engine 6",
      severity: "warning",
      fields: [],
      lines: ["Engine 6 final permission unavailable."],
    };
  }

  const executable = permission.executable === true;
  const watchOnly = permission.watchOnly === true;

  return {
    number: 4,
    icon: "⬟",
    title: "Final Permission — Engine 6",
    severity: executable ? "bullish" : "purple",
    fields: [
      ["Permission", formatUpper(permission.permission, "UNKNOWN")],
      ["Executable", formatBool(permission.executable)],
      ["Watch Only", formatBool(permission.watchOnly)],
      ["Strategy Type", formatUpper(permission.strategyType || engine15?.strategyType, "NONE")],
      ["Direction", formatUpper(permission.direction || engine15?.direction, "NONE")],
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
      executable
        ? "Engine 6 allows execution because setup and permission gates passed."
        : watchOnly
        ? "Engine 6 will not allow execution because Engine 15ES is WATCH, not READY."
        : "Engine 6 does not allow execution yet.",
      asArray(permission.reasonCodes).length
        ? `Reasons: ${asArray(permission.reasonCodes).map(formatText).join(", ")}`
        : null,
    ].filter(Boolean),
  };
}

function buildNextStepsSection({ waveOpportunity, engine15, permission, fib }) {
  const steps = [];

  const waveNeeds = asArray(waveOpportunity?.needs);
  const engine15Needs = asArray(engine15?.needs);
  const permissionReasons = asArray(permission?.reasonCodes);
  const volume = getEngine5Volume(fib);
  const timing = getEngine5Timing(fib);

  if (
    waveNeeds.some((need) => String(need).toUpperCase().includes("NO_CHASE")) ||
    isDangerChase(waveOpportunity?.chaseRisk)
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
    permissionReasons.some((reason) => String(reason).toUpperCase().includes("RECLAIM"))
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

  if (!steps.length) {
    steps.push("Wait for the next valid Wave 3 or Wave 5 opportunity");
  }

  return {
    number: 5,
    icon: "✓",
    title: "What Needs to Happen Next",
    severity: "teal",
    checklist: steps.slice(0, 8),
  };
}

function buildSideSummary({ waveOpportunity, engine15, permission }) {
  return [
    {
      title: "Engine 22 — Wave",
      severity: "warning",
      lines: [
        formatUpper(waveOpportunity?.setupType, "NO SETUP"),
        compactJoin([
          titleCase(waveOpportunity?.degree, "—"),
          formatText(waveOpportunity?.direction, "—"),
          formatText(waveOpportunity?.timing, "—"),
        ], " • "),
        getTargets(waveOpportunity)
          .map(([, price]) => formatNumber(price))
          .join(" / "),
      ],
      badge: formatUpper(waveOpportunity?.readiness, "WATCH"),
      icon: "〽",
    },
    {
      title: "Engine 15ES — Readiness",
      severity: "blue",
      lines: [
        compactJoin([
          formatText(engine15?.strategyType, "—"),
          formatText(engine15?.direction, "—"),
        ], " • "),
        `Quality: ${formatScore(engine15?.qualityScore)} (${formatText(
          engine15?.qualityBand || engine15?.qualityGrade,
          "—"
        )})`,
        `Next: ${formatText(engine15?.nextSetupType || engine15?.lifecycle?.nextFocus, "—")}`,
      ],
      badge: formatUpper(engine15?.readinessLabel, "WATCH"),
      icon: "▣",
    },
    {
      title: "Engine 6 — Permission",
      severity: "purple",
      lines: [
        `Executable: ${formatBool(permission?.executable)}`,
        `Watch Only: ${formatBool(permission?.watchOnly)}`,
      ],
      badge: formatUpper(permission?.permission, "—"),
      icon: "⬟",
    },
  ];
}

function buildQuickTargets(waveOpportunity) {
  const targets = getTargets(waveOpportunity);

  return {
    title: "Quick Targets",
    subtitle: `${titleCase(waveOpportunity?.degree, "Wave")} W5 Extension Targets`,
    targets,
    taggedLabel:
      waveOpportunity?.targets?.e1272 != null
        ? "1.272 already tagged"
        : null,
  };
}

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

  const headline = buildHeadline({ waveOpportunity, engine15 });
  const subheadline = buildSubheadline({ waveOpportunity, engine15 });
  const badges = buildBadges({ waveOpportunity, engine15, permission });

  const sections = [
    buildWaveOpportunitySection(waveOpportunity),
    buildEngine15Section(engine15),
    buildEngine5Section(fib),
    buildPermissionSection(permission, engine15),
    buildNextStepsSection({ waveOpportunity, engine15, permission, fib }),
  ];

  const severity =
    permission?.executable === true
      ? "bullish"
      : waveOpportunity?.chaseRisk === "EXTREME" ||
        waveOpportunity?.timing === "POST_EXTENSION"
      ? "warning"
      : isWatchState(engine15?.readinessLabel)
      ? "warning"
      : "neutral";

  return {
    show: true,
    severity,
    headline,
    subheadline,
    badges,
    sections,
    sideSummary: buildSideSummary({ waveOpportunity, engine15, permission }),
    quickTargets: buildQuickTargets(waveOpportunity),
    footer: permission?.executable === true ? "EXECUTION ELIGIBLE" : "WATCH",
  };
}

/* =========================
   UI Components
========================= */

function Badge({ label, severity = "neutral" }) {
  if (!label) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${severityBorder(severity)}`,
        background: severityBackground(severity),
        color: severityColor(severity),
        borderRadius: 8,
        padding: "5px 10px",
        fontSize: 13,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
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
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "8px 14px",
        marginTop: 5,
      }}
    >
      {safeFields.map(([label, value], idx) => (
        <div key={`${label}-${idx}`}>
          <div
            style={{
              color: "#94a3b8",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            {label}
          </div>
          <div
            style={{
              color: "#f8fafc",
              fontSize: 14,
              fontWeight: 850,
              lineHeight: 1.25,
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
        marginTop: 5,
      }}
    >
      {safeCards.map((card, idx) => (
        <div
          key={`${card.label}-${idx}`}
          style={{
            borderLeft: `3px solid ${card.good ? "#22c55e" : "#f59e0b"}`,
            background: "rgba(15,23,42,0.46)",
            borderRadius: 8,
            padding: "7px 9px",
          }}
        >
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            {card.label}
          </div>
          <div
            style={{
              color: card.good ? "#86efac" : "#fed7aa",
              fontSize: 14,
              fontWeight: 800,
              lineHeight: 1.25,
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
        gap: "8px 20px",
        marginTop: 5,
      }}
    >
      {safeItems.map((item, idx) => (
        <div
          key={`${item}-${idx}`}
          style={{
            display: "grid",
            gridTemplateColumns: "22px 1fr",
            alignItems: "center",
            gap: 8,
            color: "#dbeafe",
            fontSize: 14,
            fontWeight: 700,
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
              fontWeight: 900,
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
        padding: "10px 12px",
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
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: `1px solid ${severityBorder(section.severity)}`,
            color: severityColor(section.severity),
            background: "rgba(2,6,23,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
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
              marginBottom: 5,
            }}
          >
            <span
              style={{
                color: severityColor(section.severity),
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              {section.icon}
            </span>
            <div
              style={{
                color: severityColor(section.severity),
                fontSize: 17,
                fontWeight: 900,
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
                display: "grid",
                gap: 4,
                marginTop: 7,
                color: "#dbeafe",
                fontSize: 14,
                lineHeight: 1.35,
                fontWeight: 650,
              }}
            >
              {asArray(section.lines).map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EngineSummaryCard({ item }) {
  if (!item) return null;

  return (
    <div
      style={{
        border: `1px solid ${severityBorder(item.severity)}`,
        background: severityBackground(item.severity),
        borderRadius: 12,
        padding: "12px 13px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: severityColor(item.severity),
            fontWeight: 900,
            fontSize: 15,
            textTransform: "uppercase",
          }}
        >
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          {item.title}
        </div>
        <Badge label={item.badge} severity={item.severity} />
      </div>

      <div
        style={{
          display: "grid",
          gap: 5,
          color: "#e5e7eb",
          fontSize: 14,
          fontWeight: 650,
          lineHeight: 1.35,
        }}
      >
        {asArray(item.lines).map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function EngineSummaryPanel({ items }) {
  const safeItems = asArray(items);
  if (!safeItems.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 145,
        left: 110,
        width: 355,
        zIndex: 110,
        border: "1px solid rgba(148,163,184,0.35)",
        borderRadius: 14,
        background: "rgba(6,10,20,0.94)",
        padding: "14px 14px",
        color: "#e5e7eb",
        pointerEvents: "none",
        boxShadow: "0 10px 28px rgba(0,0,0,0.32)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        style={{
          color: "#f8fafc",
          fontWeight: 900,
          fontSize: 17,
          textTransform: "uppercase",
          marginBottom: 12,
          letterSpacing: "0.02em",
        }}
      >
        Engine Summary
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {safeItems.map((item, idx) => (
          <EngineSummaryCard key={`${item.title}-${idx}`} item={item} />
        ))}

        <div
          style={{
            border: "1px solid rgba(148,163,184,0.35)",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#f8fafc",
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          <span>View Full Engine Details</span>
          <span style={{ fontSize: 20 }}>›</span>
        </div>
      </div>
    </div>
  );
}

function QuickTargetsPanel({ quickTargets }) {
  if (!quickTargets || !asArray(quickTargets.targets).length) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 145,
        right: 130,
        width: 270,
        zIndex: 110,
        border: "1px solid rgba(148,163,184,0.35)",
        borderRadius: 14,
        background: "rgba(6,10,20,0.94)",
        padding: "14px 14px",
        color: "#e5e7eb",
        pointerEvents: "none",
        boxShadow: "0 10px 28px rgba(0,0,0,0.32)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        style={{
          color: "#f8fafc",
          fontWeight: 900,
          fontSize: 17,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {quickTargets.title}
      </div>

      <div
        style={{
          color: "#fbbf24",
          fontWeight: 900,
          fontSize: 14,
          marginBottom: 8,
        }}
      >
        {quickTargets.subtitle}
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {quickTargets.targets.map(([level, price]) => {
          const tagged = level === "1.272";

          return (
            <div
              key={level}
              style={{
                border: "1px solid rgba(148,163,184,0.22)",
                borderRadius: 8,
                background: "rgba(15,23,42,0.58)",
                padding: "9px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 14,
                fontWeight: 750,
              }}
            >
              <span>{level}</span>
              <span style={{ color: "#f8fafc" }}>{formatNumber(price)}</span>
              {tagged && (
                <span
                  style={{
                    color: "#fbbf24",
                    border: "1px solid rgba(251,191,36,0.48)",
                    borderRadius: 6,
                    padding: "2px 5px",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  TAGGED
                </span>
              )}
            </div>
          );
        })}
      </div>

      {quickTargets.taggedLabel && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid rgba(251,191,36,0.55)",
            background: "rgba(113,63,18,0.14)",
            borderRadius: 10,
            padding: "10px 11px",
            color: "#fbbf24",
            fontWeight: 900,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⚠</span>
          <span>{quickTargets.taggedLabel}</span>
        </div>
      )}
    </div>
  );
}

function MinimalStatusStrip({ timeline }) {
  const engine15 = timeline?.sections?.[1] || null;
  const permissionSection = timeline?.sections?.[3] || null;

  return (
    <div
      style={{
        position: "absolute",
        top: 88,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 108,
        width: 900,
        maxWidth: "58%",
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
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const stripValueStyle = {
  fontSize: 14,
  fontWeight: 900,
  textTransform: "uppercase",
};

function TimelineMainCard({ timeline }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 138,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 109,
        width: 820,
        maxWidth: "52%",
        maxHeight: "calc(100vh - 165px)",
        overflowY: "auto",
        borderRadius: 15,
        border: `1px solid ${severityBorder(timeline.severity)}`,
        background: "rgba(6,10,20,0.95)",
        padding: "16px 18px",
        color: "#e5e7eb",
        pointerEvents: "none",
        backdropFilter: "blur(5px)",
        boxShadow: "0 12px 34px rgba(0,0,0,0.34)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 27,
          fontWeight: 950,
          color: "#fbbf24",
          letterSpacing: "0.01em",
          marginBottom: 6,
          lineHeight: 1.18,
          textTransform: "uppercase",
        }}
      >
        {timeline.headline}
      </div>

      {timeline.subheadline && (
        <div
          style={{
            color: "#e2e8f0",
            fontSize: 15,
            lineHeight: 1.35,
            fontWeight: 650,
            maxWidth: 720,
            margin: "0 auto 10px",
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

      <div style={{ display: "grid", gap: 8 }}>
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
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid rgba(148,163,184,0.25)",
            color: "#94a3b8",
            fontWeight: 900,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {timeline.footer}
        </div>
      )}
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
      <EngineSummaryPanel items={timeline.sideSummary} />
      <TimelineMainCard timeline={timeline} />
      <QuickTargetsPanel quickTargets={timeline.quickTargets} />
    </>
  );
}
