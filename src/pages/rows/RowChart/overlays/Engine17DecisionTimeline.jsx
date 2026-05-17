// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

/* =========================
   Formatters
========================= */

function formatText(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value).replaceAll("_", " ");
}

function formatLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function formatScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function formatPct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
}

function formatSignedLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function formatWave(value) {
  if (!value) return "—";
  return String(value)
    .replace(/^IN_/, "")
    .replace(/^WAVE_/, "")
    .replaceAll("_", " ");
}

function prettyZone(value) {
  const v = String(value || "").toUpperCase();

  if (v === "BELOW_786_ABOVE_INVALIDATION") {
    return "Below 78.6% but above hard invalidation";
  }

  if (v === "BELOW_786_DEEP_DAMAGE_ZONE") {
    return "Below 78.6% deep damage zone";
  }

  return formatText(value);
}

function severityColor(severity) {
  if (severity === "danger") return "#fb7185";
  if (severity === "warning") return "#fbbf24";
  if (severity === "bullish") return "#22c55e";
  if (severity === "info") return "#60a5fa";
  return "#cbd5e1";
}

function severityBorder(severity) {
  if (severity === "danger") return "rgba(244,63,94,0.55)";
  if (severity === "warning") return "rgba(251,191,36,0.50)";
  if (severity === "bullish") return "rgba(34,197,94,0.45)";
  if (severity === "info") return "rgba(96,165,250,0.45)";
  return "rgba(148,163,184,0.32)";
}

function asLines(lines) {
  return Array.isArray(lines) ? lines.filter(Boolean) : [];
}

/* =========================
   Data helpers
========================= */

function getEngine22(overlayData) {
  return overlayData?.fib?.engine22Scalp || null;
}

function getFib(overlayData) {
  return overlayData?.fib || {};
}

function getWaveFibState(engine22) {
  return engine22?.waveFibState || null;
}

function getWaveSource({ overlayData, engine22, fib }) {
  return (
    engine22?.waveFibState?.degrees ||
    engine22?.breakoutContext?.waveContext ||
    engine22?.debug ||
    overlayData?.engine2State ||
    fib?.engine2State ||
    fib?.waveContext ||
    {}
  );
}

function normalizeWaveStack({ overlayData, engine22, fib }) {
  const waveFibState = getWaveFibState(engine22);
  const source = getWaveSource({ overlayData, engine22, fib });

  const fromWaveFib = waveFibState?.degrees || {};

  const primary =
    waveFibState?.stackBias?.primary ||
    fromWaveFib?.primary?.phase ||
    source?.primaryPhase ||
    source?.primary?.phase ||
    "W5";

  const intermediate =
    waveFibState?.stackBias?.intermediate ||
    fromWaveFib?.intermediate?.phase ||
    source?.intermediatePhase ||
    source?.intermediate?.phase ||
    "W5";

  const minor =
    waveFibState?.stackBias?.minor ||
    fromWaveFib?.minor?.phase ||
    source?.minorPhase ||
    source?.minor?.phase ||
    "W5";

  const minute =
    waveFibState?.stackBias?.minute ||
    fromWaveFib?.minute?.phase ||
    source?.minutePhase ||
    source?.minute?.phase ||
    "W5";

  const micro =
    waveFibState?.stackBias?.micro ||
    fromWaveFib?.micro?.phase ||
    source?.microPhase ||
    source?.micro?.phase ||
    "—";

  return {
    primary: formatWave(primary),
    intermediate: formatWave(intermediate),
    minor: formatWave(minor),
    minute: formatWave(minute),
    micro: formatWave(micro),
    text: `Primary ${formatWave(primary)} | Intermediate ${formatWave(
      intermediate
    )} | Minor ${formatWave(minor)} | Minute ${formatWave(
      minute
    )} | Micro ${formatWave(micro)}`,
  };
}

function normalizeLayer(layer, label, unavailableText) {
  if (!layer) {
    return {
      title: label,
      lines: [unavailableText || `${label}: unavailable`],
      severity: "neutral",
    };
  }

  const close =
    layer.close ??
    layer.price ??
    layer.last ??
    layer.currentPrice ??
    null;

  const ema10 =
    layer.ema10 ??
    layer.ema10Value ??
    layer.dailyEma10 ??
    null;

  const ema20 =
    layer.ema20 ??
    layer.ema20Value ??
    null;

  const dist =
    layer.distanceToEma10 ??
    layer.distance ??
    null;

  const distPct =
    layer.distanceToEma10Pct ??
    layer.distancePct ??
    null;

  const state =
    layer.state ||
    layer.trendState ||
    layer.structureState ||
    layer.permissionState ||
    "UNKNOWN";

  const score =
    layer.score ??
    layer.layerScore ??
    null;

  const lines = [];

  if (close != null || ema10 != null || ema20 != null) {
    lines.push(
      `Price ${formatLevel(close)} | EMA10 ${formatLevel(ema10)}${
        ema20 != null ? ` | EMA20 ${formatLevel(ema20)}` : ""
      }`
    );
  }

  if (dist != null || distPct != null) {
    lines.push(
      `Distance to EMA10: ${formatSignedLevel(dist)} / ${formatPct(distPct)}`
    );
  }

  lines.push(`State: ${formatText(state)}`);

  if (score != null) {
    lines.push(`Score: ${formatScore(score)}`);
  }

  if (layer.dipBuyPermission === true) {
    lines.push("Permission: ON");
  }

  if (layer.dipBuyPermission === false) {
    lines.push("Permission: OFF");
  }

  return {
    title: label,
    lines,
    severity:
      String(state).toUpperCase().includes("BELOW") ||
      String(state).toUpperCase().includes("LOST")
        ? "warning"
        : "neutral",
  };
}

function normalizeRegimeLayers({ engine22, fib }) {
  const layers = engine22?.regimeLayers || {};
  const engine16Layers = fib?.regimeLayers || {};

  const tenMinute =
    layers.tenMinute ||
    layers.trigger10m ||
    engine16Layers.trigger10m ||
    null;

  const oneHour =
    layers.oneHour ||
    layers.pullback1h ||
    engine16Layers.pullback1h ||
    null;

  const fourHour =
    layers.fourHour ||
    layers.trend4h ||
    engine16Layers.trend4h ||
    null;

  const eod =
    layers.eod ||
    layers.regimeEod ||
    engine16Layers.regimeEod ||
    null;

  return [
    normalizeLayer(tenMinute, "10m Trigger Layer", "10m Trigger Layer: unavailable"),
    normalizeLayer(oneHour, "1H Pullback Layer", "1H Pullback Layer: unavailable"),
    normalizeLayer(fourHour, "4H Trend Layer", "4H Trend Layer: unavailable"),
    normalizeLayer(eod, "EOD Regime Layer", "EOD Regime Layer: unavailable"),
  ];
}

function normalizeReaction(engine22) {
  const reaction = engine22?.reactionContext || null;

  if (!reaction) {
    return {
      title: "Engine 3 Reaction",
      severity: "neutral",
      lines: ["Reaction context unavailable"],
    };
  }

  const lines = [
    `${formatText(reaction.state, "UNKNOWN")} — ${formatText(
      reaction.quality,
      "UNKNOWN"
    )}`,
    `Score ${reaction.score != null ? reaction.score : "—"}/100`,
    `Direction: ${formatText(reaction.direction, "NEUTRAL")}`,
    reaction.message || null,
  ];

  return {
    title: "Engine 3 Reaction",
    severity:
      String(reaction.quality || "").toUpperCase().includes("WEAK") ||
      String(reaction.state || "").toUpperCase().includes("FAILED")
        ? "warning"
        : "neutral",
    lines: asLines(lines),
  };
}

function normalizeVolume(engine22) {
  const volume = engine22?.volumeContext || null;

  if (!volume) {
    return {
      title: "Engine 4 Volume",
      severity: "neutral",
      lines: ["Volume context unavailable"],
    };
  }

  const maxScore = volume.maxScore ?? 15;
  const relVol =
    volume.relativeVolume != null
      ? `${Number(volume.relativeVolume).toFixed(2)}x`
      : "—";

  const lines = [
    `${formatText(
      volume.participationState || volume.state,
      "UNKNOWN"
    )} — ${formatText(volume.quality || volume.participationQuality, "UNKNOWN")}`,
    `Score ${volume.score != null ? volume.score : "—"}/${maxScore}`,
    `Relative Volume: ${relVol}`,
    volume.confirmed === true ? "Participation confirmed" : "Participation not confirmed",
    volume.message || null,
  ];

  return {
    title: "Engine 4 Volume",
    severity:
      volume.confirmed === true
        ? "bullish"
        : String(volume.quality || "").toUpperCase().includes("WEAK")
        ? "warning"
        : "neutral",
    lines: asLines(lines),
  };
}

function normalizeBreakout(engine22) {
  const breakout = engine22?.breakoutContext || null;

  if (!breakout) {
    return {
      title: "Breakout Context",
      severity: "neutral",
      lines: ["Breakout context unavailable"],
    };
  }

  return {
    title: "Breakout Context",
    severity: breakout.chaseAllowed === true ? "bullish" : "warning",
    lines: asLines([
      breakout.label || formatText(breakout.state, "UNKNOWN"),
      `Action: ${formatText(breakout.action, "WAIT")}`,
      `Chase allowed: ${breakout.chaseAllowed === true ? "YES" : "NO"}`,
      breakout.summary || null,
    ]),
  };
}

function normalizeDuration(waveFibState) {
  const duration = waveFibState?.waveDuration || null;

  if (!duration || duration.ok === false) {
    return {
      title: "Duration / Time Risk",
      severity: "neutral",
      lines: ["Duration unavailable"],
    };
  }

  const microBars = duration?.degrees?.micro?.barDuration || null;
  const barLine =
    microBars?.reason === "BARS_UNAVAILABLE"
      ? "Bar duration: waiting for feed"
      : `Bar duration: ${formatText(duration.activeTimeRiskByBars, "UNKNOWN")}`;

  return {
    title: "Duration / Time Risk",
    severity:
      String(duration.activeTimeRisk || "").toUpperCase().includes("HIGH") ||
      String(duration.activeMaturityState || "").toUpperCase().includes("OVERDUE")
        ? "warning"
        : "neutral",
    lines: asLines([
      `Active duration: ${formatText(duration.activeDegree)} ${formatText(
        duration.activeWave
      )}`,
      `Clock state: ${formatText(duration.activeMaturityState)} / ${formatText(
        duration.activeTimeRisk
      )}`,
      barLine,
      duration.summary || null,
    ]),
  };
}

/* =========================
   Timeline normalizer
========================= */

function normalizeFromBackendTimelineRead(timelineRead) {
  if (!timelineRead) return null;

  const mainSections = Array.isArray(timelineRead.sections)
    ? timelineRead.sections
    : [];

  const sideSections = Array.isArray(timelineRead.sideSections)
    ? timelineRead.sideSections
    : [];

  const waveStack = timelineRead.waveStack || {};

  return {
    show: true,
    severity: timelineRead.severity || "neutral",
    headline: timelineRead.headline || "WAIT",
    subheadline: timelineRead.subheadline || "",
    waveStackText:
      timelineRead.waveStackText ||
      `Primary ${waveStack.primary || "—"} | Intermediate ${
        waveStack.intermediate || "—"
      } | Minor ${waveStack.minor || "—"} | Minute ${
        waveStack.minute || "—"
      } | Micro ${waveStack.micro || "—"}`,
    mainSections,
    sideSections,
    footer:
      timelineRead.action ||
      timelineRead.needs ||
      "Wait for Engine confirmation.",
  };
}

function normalizeTimelineData({ overlayData, chartMode }) {
  const fib = getFib(overlayData);
  const engine22 = getEngine22(overlayData);

  if (!overlayData?.ok) {
    return { show: false };
  }

  if (!engine22) {
    return {
      show: true,
      severity: "neutral",
      headline: "Wave/Fib State unavailable",
      subheadline: "Engine 22 scalp object missing.",
      waveStackText: "Primary — | Intermediate — | Minor — | Minute — | Micro —",
      mainSections: [
        {
          title: "Action",
          severity: "neutral",
          lines: ["Wait for dashboard snapshot to populate."],
        },
      ],
      sideSections: [],
      footer: "No trade decision from frontend.",
    };
  }

  const timelineRead = normalizeFromBackendTimelineRead(engine22?.timelineRead);
  if (timelineRead) return timelineRead;

  const waveFibState = getWaveFibState(engine22);
  const abc = waveFibState?.abcCorrection || null;
  const risk = waveFibState?.microW4AbcRisk || null;

  const waveStack = normalizeWaveStack({ overlayData, engine22, fib });
  const regimeSections = normalizeRegimeLayers({ engine22, fib });

  const sideSections = [
    normalizeReaction(engine22),
    normalizeVolume(engine22),
    normalizeBreakout(engine22),
    normalizeDuration(waveFibState),
  ];

  const mainSections = [];

  let headline = "WAIT — NO CLEAN SETUP";
  let subheadline = "Waiting for a clean reclaim, trigger, or invalidation.";
  let severity = "neutral";
  let footer = "No chase. Wait for Engine confirmation.";

  if (abc?.active === true && abc?.state === "ABC_C_LEG_DEEP_DAMAGED") {
    headline = "MICRO W4 ABC DAMAGED — WAIT FOR RECLAIM";
    subheadline =
      "C leg is below 78.6% but above hard invalidation. Micro W5 requires reclaim.";
    severity = "danger";
    footer = "No chase long. Wait for reclaim before Micro W5 trigger.";

    mainSections.push({
      title: "Wave/Fib State",
      severity: "danger",
      lines: asLines([
        waveFibState?.summary ||
          "Micro W4 is damaged below 78.6%. Clean Micro W5 path is damaged.",
        "749.50–750 likely short-term top for now.",
        "Micro W5 is only possible after reclaim confirmation.",
      ]),
    });

    mainSections.push(...regimeSections);

    mainSections.push({
      title: "ABC Correction",
      severity: "danger",
      lines: asLines([
        `A: ${formatLevel(abc?.abc?.aLow)} | B: ${formatLevel(
          abc?.abc?.bHigh
        )} | C: ${formatLevel(abc?.abc?.cLow)}`,
        `Status: ${formatText(abc?.abcStatus)}`,
        `C Zone: ${prettyZone(abc?.cZone)}`,
        abc?.cleanW5PathDamaged === true ? "Clean Micro W5 path damaged" : null,
        abc?.microW5NeedsReclaim === true ? "Micro W5 needs reclaim confirmation" : null,
      ]),
    });

    mainSections.push({
      title: "Reclaim Ladder",
      severity: "warning",
      lines: [abc?.reclaimDisplay || "Reclaim ladder unavailable"],
    });

    mainSections.push({
      title: "Risk / Invalidation",
      severity: "danger",
      lines: asLines([
        `Hard invalidation: ${formatLevel(abc?.hardInvalidation)}`,
        risk?.topCandidate != null
          ? `Top candidate: ${formatLevel(risk.topCandidate)}`
          : "Top candidate: 749.50–750 likely short-term top for now",
        risk?.maxCleanPullback != null
          ? `Max clean pullback: ${formatLevel(risk.maxCleanPullback)}`
          : null,
        risk?.currentZone ? `Current zone: ${prettyZone(risk.currentZone)}` : null,
        risk?.hardInvalidated === true
          ? "Micro impulse invalidated"
          : "Top likely confirmed for now, but not hard invalidated.",
      ]),
    });

    mainSections.push({
      title: "Action / Needs",
      severity: "warning",
      lines: [
        "No chase long.",
        "Wait for reclaim before Micro W5 trigger.",
        "Only later should Engine 22 / Engine 15 decide whether reclaim is READY or GO.",
      ],
    });

    return {
      show: true,
      severity,
      headline,
      subheadline,
      waveStackText: waveStack.text,
      mainSections,
      sideSections,
      footer,
    };
  }

  if (
    risk?.active === true &&
    String(risk?.state || "").toUpperCase().includes("DAMAGED")
  ) {
    headline = "MICRO W4 DAMAGED — WAIT FOR RECLAIM";
    subheadline = "Clean Micro W5 path is damaged unless price reclaims.";
    severity = "danger";
    footer = "No chase long. Wait for reclaim confirmation.";

    mainSections.push({
      title: "Wave/Fib State",
      severity: "danger",
      lines: asLines([
        waveFibState?.summary,
        "Micro W4 is below the 78.6% retrace.",
        "Clean Micro W5 path is damaged unless price reclaims.",
      ]),
    });

    mainSections.push(...regimeSections);

    mainSections.push({
      title: "Micro W4 Risk",
      severity: "danger",
      lines: asLines([
        `State: ${formatText(risk?.state)}`,
        `Top candidate: ${formatLevel(risk?.topCandidate)}`,
        `Max clean pullback: ${formatLevel(risk?.maxCleanPullback)}`,
        `Hard invalidation: ${formatLevel(risk?.hardInvalidation)}`,
        `Current zone: ${prettyZone(risk?.currentZone)}`,
      ]),
    });

    mainSections.push({
      title: "Action / Needs",
      severity: "warning",
      lines: ["No chase long.", "Wait for reclaim before Micro W5 trigger."],
    });

    return {
      show: true,
      severity,
      headline,
      subheadline,
      waveStackText: waveStack.text,
      mainSections,
      sideSections,
      footer,
    };
  }

  const microW4State = String(engine22?.microW4Pullback?.state || "").toUpperCase();
  const state = String(engine22?.state || "").toUpperCase();
  const status = String(engine22?.status || "").toUpperCase();

  if (
    microW4State === "MICRO_W4_PULLBACK_ACTIVE" ||
    state === "MICRO_W4_PULLBACK_ACTIVE"
  ) {
    headline = "MICRO W4 PULLBACK ACTIVE — WAIT";
    subheadline =
      "Higher timeframe W5 is active, but Micro W4 is pulling back.";
    severity = "warning";
    footer = "No chase long. Wait for Micro W4 support/reclaim.";

    mainSections.push({
      title: "Wave/Fib State",
      severity: "warning",
      lines: asLines([
        waveFibState?.summary ||
          "Micro W3 completed. Micro W4 pullback is active.",
      ]),
    });

    mainSections.push(...regimeSections);

    mainSections.push({
      title: "Action / Needs",
      severity: "warning",
      lines: [
        "No chase long.",
        "No blind short.",
        "Wait for Micro W4 support/reclaim, then watch for Micro W5 trigger.",
      ],
    });

    return {
      show: true,
      severity,
      headline,
      subheadline,
      waveStackText: waveStack.text,
      mainSections,
      sideSections,
      footer,
    };
  }

  const readableState = state || status || "WAIT";

  headline = formatText(readableState);
  subheadline =
    waveFibState?.summary ||
    "Timeline normalizer is waiting for a higher-priority Engine 22 state.";
  severity =
    status.includes("ENTRY") || state.includes("TRIGGER")
      ? "bullish"
      : state.includes("BLOCK") || state.includes("INVALID")
      ? "danger"
      : "neutral";

  mainSections.push({
    title: "Wave/Fib State",
    severity,
    lines: asLines([
      waveFibState?.summary,
      `Active setup: ${formatText(waveFibState?.activeSetup, "—")}`,
      `Active degree: ${formatText(waveFibState?.activeTradingDegree, "—")}`,
      `Chase risk: ${formatText(waveFibState?.chaseRisk, "—")}`,
    ]),
  });

  mainSections.push(...regimeSections);

  mainSections.push({
    title: "Action / Needs",
    severity: "neutral",
    lines: asLines([
      engine22?.needs ? `Needs: ${formatText(engine22.needs)}` : "Wait for setup.",
      engine22?.status ? `Status: ${formatText(engine22.status)}` : null,
    ]),
  });

  return {
    show: true,
    severity,
    headline,
    subheadline,
    waveStackText: waveStack.text,
    mainSections,
    sideSections,
    footer,
  };
}

/* =========================
   UI Components
========================= */

function TimelineSection({ title, lines, severity = "neutral" }) {
  const safeLines = asLines(lines);

  if (!title && safeLines.length === 0) return null;

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        border: `1px solid ${severityBorder(severity)}`,
        borderRadius: 10,
        padding: "8px 10px",
        background: "rgba(15,23,42,0.38)",
        textAlign: "left",
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 17,
            fontWeight: 700,
            color: severityColor(severity),
            marginBottom: 5,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          display: "grid",
          gap: 4,
          fontSize: 17,
          lineHeight: 1.42,
          color: "#dbeafe",
          fontWeight: 500,
          whiteSpace: "pre-line",
        }}
      >
        {safeLines.map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function TimelineMainCard({ timeline }) {
  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "absolute",
        top: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 109,
        width: 760,
        maxWidth: "64%",
        borderRadius: 14,
        border: `1px solid ${severityBorder(timeline.severity)}`,
        background: "rgba(6,10,20,0.95)",
        padding: "14px 18px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      }}
    >
      <div
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 700,
          fontSize: 29,
          lineHeight: 1.25,
          color: severityColor(timeline.severity),
          marginBottom: 8,
        }}
      >
        {timeline.headline}
      </div>

      <div
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 600,
          fontSize: 21,
          lineHeight: 1.3,
          color: "#f8fafc",
          marginBottom: 8,
        }}
      >
        {timeline.waveStackText}
      </div>

      {timeline.subheadline && (
        <div
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 20,
            lineHeight: 1.4,
            color: "#cbd5e1",
            fontWeight: 500,
            marginBottom: 10,
          }}
        >
          {timeline.subheadline}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {(timeline.mainSections || []).map((section, idx) => (
          <TimelineSection
            key={`${section.title || "section"}-${idx}`}
            title={section.title}
            lines={section.lines}
            severity={section.severity}
          />
        ))}
      </div>

      {timeline.footer && (
        <div
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid rgba(148,163,184,0.25)",
            color: "#94a3b8",
            fontWeight: 500,
            fontSize: 18,
          }}
        >
          {timeline.footer}
        </div>
      )}
    </div>
  );
}

function TimelineContextPanel({ sections }) {
  const safeSections = Array.isArray(sections) ? sections : [];
  if (safeSections.length === 0) return null;

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "absolute",
        top: 160,
        left: "calc(50% - 760px)",
        zIndex: 110,
        width: 360,
        maxWidth: "30%",
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,0.42)",
        background: "rgba(6,10,20,0.94)",
        padding: "12px 14px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "left",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
        display: "grid",
        gap: 8,
      }}
    >
      {safeSections.map((section, idx) => (
        <TimelineSection
          key={`${section.title || "side"}-${idx}`}
          title={section.title}
          lines={section.lines}
          severity={section.severity}
        />
      ))}
    </div>
  );
}

/* =========================
   Main Export
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
      <TimelineContextPanel sections={timeline.sideSections} />
      <TimelineMainCard timeline={timeline} />
    </>
  );
}
