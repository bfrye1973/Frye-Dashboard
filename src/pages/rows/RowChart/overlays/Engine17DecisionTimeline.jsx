// src/pages/rows/RowChart/overlays/Engine17DecisionTimeline.jsx

import React from "react";

function formatWave(value) {
  if (!value) return "—";
  return String(value).replace(/^IN_/, "").replaceAll("_", " ");
}

function formatText(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value).replaceAll("_", " ");
}

function formatLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function formatSignedLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function formatSignedPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function formatLayerState(value) {
  const v = String(value || "").toUpperCase();

  if (v === "ABOVE_EMA10") return "above EMA10";
  if (v === "AT_OR_BELOW_EMA10") return "testing / below EMA10";
  if (v === "BELOW_EMA20") return "below EMA20";
  if (v === "ABOVE_DAILY_EMA10") return "above Daily EMA10";
  if (v === "BELOW_DAILY_EMA10") return "below Daily EMA10";

  return formatText(v, "—").toLowerCase();
}

function buildRegimeLayerLine(layer, options = {}) {
  const label = options.label || layer?.label || "Layer";
  const emaLabel = options.emaLabel || "EMA10";

  if (!layer) {
    return `${label}: unavailable`;
  }

  const score =
    layer?.score != null
      ? ` | Score ${formatScore(layer.score)}`
      : "";

  const trend =
    layer?.trendState
      ? ` | ${formatText(layer.trendState).toLowerCase()}`
      : "";

  return (
    `${label}: ` +
    `Price ${formatLevel(layer.close)} | ${emaLabel} ${formatLevel(layer.ema10)} | ` +
    `Dist ${formatSignedLevel(layer.distanceToEma10)} / ${formatSignedPct(layer.distanceToEma10Pct)}` +
    `${score}${trend} → ${formatLayerState(layer.state)}`
  );
}

function getRegimeStructureText(engine22) {
  const layers = engine22?.regimeLayers || null;

  if (!layers) {
    return "Current price structure:\nRegime layers unavailable.";
  }

  const ten = layers.tenMinute || null;
  const hour = layers.oneHour || null;
  const eod = layers.eod || null;

  const permission =
    eod?.dipBuyPermission === true
      ? "ON — EOD price is above Daily EMA10"
      : eod?.dipBuyPermission === false
      ? "OFF — EOD price is below Daily EMA10"
      : "UNKNOWN — EOD permission unavailable";

  return (
    `Current price structure:\n` +
    `${buildRegimeLayerLine(ten, {
      label: "10m Trigger Layer",
      emaLabel: "EMA10",
    })}\n` +
    `${buildRegimeLayerLine(hour, {
      label: "1H Pullback Layer",
      emaLabel: "EMA10",
    })}\n` +
    `${buildRegimeLayerLine(eod, {
      label: "EOD Regime Layer",
      emaLabel: "Daily EMA10",
    })}\n` +
    `EOD Permission: ${permission}`
  );
}

function buildReactionVolumeContextText(engine22) {
  const reaction = engine22?.reactionContext || null;
  const volume = engine22?.volumeContext || null;
  const breakout = engine22?.breakoutContext || null;

  if (!reaction && !volume && !breakout) return null;

  const reactionScore =
    reaction?.score != null
      ? `${reaction.score}/100`
      : "—/100";

  const volumeMax =
    volume?.maxScore != null
      ? volume.maxScore
      : 15;

  const volumeScore =
    volume?.score != null
      ? `${volume.score}/${volumeMax}`
      : `—/${volumeMax}`;

  const relVol =
    volume?.relativeVolume != null
      ? `${Number(volume.relativeVolume).toFixed(2)}x`
      : "—";

  const volumeConfirmed =
    volume?.confirmed === true
      ? "Confirmed"
      : "Not confirmed";

  const chaseText =
    breakout?.chaseAllowed === true
      ? "Yes"
      : "No";

  const lines = [];

  if (reaction) {
    lines.push(
      "Engine 3 Reaction:",
      `${formatText(reaction.state, "UNKNOWN")} — ${formatText(reaction.quality, "UNKNOWN")}`,
      `Score ${reactionScore} | Direction ${formatText(reaction.direction, "NEUTRAL")}`,
      reaction.message ? reaction.message : null
    );
  }

  if (volume) {
    lines.push(
      "",
      "Engine 4 Volume:",
      `${formatText(volume.participationState || volume.state, "UNKNOWN")} — ${formatText(volume.quality || volume.participationQuality, "UNKNOWN")}`,
      `Score ${volumeScore} | RelVol ${relVol} | ${volumeConfirmed}`,
      volume.message ? volume.message : null
    );
  }

  if (breakout) {
    lines.push(
      "",
      "Breakout Context:",
      `${breakout.label || formatText(breakout.state, "UNKNOWN")}`,
      `Action: ${formatText(breakout.action, "WAIT")} | Chase: ${chaseText}`,
      breakout.summary ? breakout.summary : null
    );
  }

  return lines.filter(Boolean).join("\n");
}

function conditionText(code) {
  const c = String(code || "").toUpperCase();

  if (c === "BULLISH_BUT_WEAKENING") return "Bullish trend is weakening";
  if (c === "SHORT_RISK_RISING") return "Short risk is rising";
  if (c === "BEARISH_BUT_WEAKENING") return "Bearish trend is weakening";
  if (c === "LONG_RISK_RISING") return "Long risk is rising";

  return null;
}

function prettyMinute(value) {
  const v = String(value || "").toUpperCase();
  if (v === "IN_W1") return "Minute W1";
  if (v === "IN_W2") return "Minute W2";
  if (v === "IN_W3") return "Minute W3";
  if (v === "IN_W4") return "Minute W4";
  if (v === "IN_W5") return "Minute W5";
  if (!v || v === "UNKNOWN") return "Minute —";
  return formatText(v);
}

 function getTimelineWaveSource({ engine22, fib, overlayData }) {
  return (
    engine22?.breakoutContext?.waveContext ||
    engine22?.debug ||
    overlayData?.engine2State ||
    fib?.engine2State ||
    fib?.waveContext ||
    {}
  );
}

function getRunnerModeRead(engine22) {
  const runner = engine22?.runnerMode || null;
  const runnerState = String(runner?.state || "").toUpperCase();

  if (!runner || runner?.active !== true) return null;

  if (runnerState === "W3_W5_RUNNER_ACTIVE") {
    const profitPlan = runner?.profitPlan || {};
    const stopPlan = runner?.stopPlan || {};

    return {
      label: "🟢 W3/W5 RUNNER ACTIVE",
      currentRead: "🟢 RUNNER ACTIVE — W3/W5 CONTINUATION",
      confirmation:
        "Higher timeframe trend remains long-only.\nMinute W5 continuation is active.\nThis is a runner-management state, not a new blind chase.",
      details: [
        runner?.entryQuality ? `Entry Quality: ${runner.entryQuality}` : null,
        runner?.recommendedContracts != null
          ? `Recommended: ${runner.recommendedContracts} contracts`
          : null,
        runner?.expiration ? `Expiration: ${runner.expiration}` : null,
        runner?.strikeStyle ? `Strike: ${runner.strikeStyle}` : null,
        runner?.pullbackExpectation
          ? `Pullback: ${formatText(runner.pullbackExpectation)}`
          : null,
      ].filter(Boolean),
      action:
        runner?.preferredEntry
          ? `Preferred Entry: ${formatText(runner.preferredEntry)}`
          : "Preferred Entry: EMA10 hold, micro-flag break, or continuation trigger.",
      needs:
        runner?.management
          ? `Management: ${formatText(runner.management)}`
          : "Management: Take partial profit, then trail the runner.",
      extra: [
        profitPlan?.profit1?.rule ? `TP1: ${profitPlan.profit1.rule}` : null,
        profitPlan?.profit2?.rule ? `TP2: ${profitPlan.profit2.rule}` : null,
        profitPlan?.profit3?.rule ? `Runner: ${profitPlan.profit3.rule}` : null,
        stopPlan?.initialStopLevel != null
          ? `Initial Stop: ${formatLevel(stopPlan.initialStopLevel)}`
          : stopPlan?.initialStopRule
          ? `Initial Stop: ${formatText(stopPlan.initialStopRule)}`
          : null,
      ].filter(Boolean),
    };
  }

  return {
    label: `🟢 ${formatText(runnerState || "RUNNER MODE ACTIVE")}`,
    currentRead: `🟢 ${formatText(runnerState || "RUNNER MODE ACTIVE")}`,
    confirmation:
      "Runner mode is active.\nUse runner management rules until the trend or stop plan invalidates.",
    details: [
      runner?.entryQuality ? `Entry Quality: ${runner.entryQuality}` : null,
      runner?.recommendedContracts != null
        ? `Recommended: ${runner.recommendedContracts} contracts`
        : null,
      runner?.expiration ? `Expiration: ${runner.expiration}` : null,
      runner?.strikeStyle ? `Strike: ${runner.strikeStyle}` : null,
    ].filter(Boolean),
    action:
      runner?.preferredEntry
        ? `Preferred Entry: ${formatText(runner.preferredEntry)}`
        : "Preferred Entry: Follow active runner rules.",
    needs:
      runner?.management
        ? `Management: ${formatText(runner.management)}`
        : "Management: Trail according to runner plan.",
    extra: [],
  };
}

function engine22StateLabel(engine22) {
  const runner = engine22?.runnerMode || null;
  const runnerState = String(runner?.state || "").toUpperCase();

  if (runner?.active === true && runnerState === "W3_W5_RUNNER_ACTIVE") {
    return "🟢 W3/W5 RUNNER ACTIVE";
  }

  if (runner?.active === true) {
    return `🟢 ${formatText(runnerState || "RUNNER MODE ACTIVE")}`;
  }
  
const state = String(engine22?.state || "").toUpperCase();
const microW4State = String(engine22?.microW4Pullback?.state || "").toUpperCase();
const abcState = String(engine22?.abcState || "").toUpperCase();
  const status = String(engine22?.status || "").toUpperCase();
  const trendState = String(engine22?.trendVsWave?.state || "").toUpperCase();
  const zoneState = String(engine22?.zoneAbsorption?.state || "").toUpperCase();
  const microW4State = String(engine22?.microW4Pullback?.state || "").toUpperCase();

if (microW4State === "MICRO_W4_PULLBACK_ACTIVE") {
  return "🟡 MICRO W4 PULLBACK ACTIVE — WAIT FOR MICRO W5 TRIGGER";
}

if (microW4State === "MICRO_W4_RECLAIM_WATCH") {
  return "🟡 MICRO W4 RECLAIM WATCH — WAIT FOR CONFIRMATION";
}

if (microW4State === "MICRO_W5_TRIGGER_PENDING") {
  return "🟢 MICRO W5 TRIGGER PENDING — WAIT FOR ENGINE 3/4";
}

  // Correction states must come BEFORE zone states.
  // If Engine 22 is in Minute W4, the headline should explain the wave correction first.
  // Zone context can still display underneath as detail, but it should not override W4.
  if (state === "W4_ACTIVE_WAIT") {
    if (abcState === "W4_A_FORMING") {
      return "🟡 MINUTE W4 ACTIVE — WAIT FOR A LOW";
    }

    if (abcState === "W4_A_LOW_ACTIVE") {
      return "🟡 A LOW MARKED — WATCH B BOUNCE";
    }

    if (abcState === "W4_C_LEG_STARTING") {
      return "🟡 C LEG STARTING — WAIT FOR C LOW";
    }

    if (abcState === "W4_ABC_COMPLETE_WAIT_TRIGGER") {
      return "🟡 ABC COMPLETE — WAIT FOR W5 TRIGGER";
    }

    return "🟡 MINUTE W4 ACTIVE — WAIT FOR ABC STRUCTURE";
  }

   if (state === "MICRO_W4_PULLBACK_ACTIVE") {
    return "🟡 MICRO W4 PULLBACK ACTIVE — WAIT FOR MICRO W5 TRIGGER";
  }

  if (state === "MICRO_W4_RECLAIM_WATCH") {
    return "🟡 MICRO W4 RECLAIM WATCH — WAIT FOR CONFIRMATION";
  }

  if (state === "MICRO_W5_TRIGGER_PENDING") {
    return "🟢 MICRO W5 TRIGGER PENDING — WAIT FOR ENGINE 3/4";
  }
  
  if (state === "W2_ACTIVE_WAIT") {
    return "🟡 MINUTE W2 ACTIVE — WATCH CORRECTION";
}

if (state === "W4_B_BOUNCE_ACTIVE" || abcState === "W4_B_BOUNCE_ACTIVE") {
  return "🟢 W4 B-BOUNCE ACTIVE — REDUCED SIZE";
}

if (
  state === "W4_SHALLOW_CONTINUATION_WATCH" ||
  abcState === "W4_SHALLOW_CONTINUATION_WATCH"
) {
  return "🟡 SHALLOW W4 CONTINUATION WATCH";
}

if (
  state === "W5_CONTINUATION_WATCH" ||
  abcState === "W5_CONTINUATION_WATCH"
) {
  return "🟡 W5 CONTINUATION WATCH — WAIT FOR BREAK";
}

if (
  state === "W5_SHALLOW_TRIGGER_LONG" ||
  abcState === "W5_SHALLOW_TRIGGER_LONG"
) {
  return "🟢 W5 SHALLOW TRIGGER LONG";
}

if (
  state === "MINUTE_W5_ACTIVE_AFTER_SHALLOW_W4" ||
  abcState === "MINUTE_W5_ACTIVE_AFTER_SHALLOW_W4"
) {
  return "🟢 MINUTE W5 ACTIVE — SHALLOW W4 COMPLETE";
}

if (state === "A_TO_B_TRIGGER_LONG" || abcState === "A_TO_B_TRIGGER_LONG") {
  return "🟢 W4 B-BOUNCE LONG ACTIVE — REDUCED SIZE";
}

  // Trend-vs-wave states come after explicit W2/W4 correction states.
  if (trendState === "HTF_STRONG_LTF_PULLBACK") {
    return "🟡 HTF STRONG — LTF PULLBACK";
  }

  if (trendState === "W3_CONTINUATION_WATCH") {
    return "🟡 CONTINUATION WATCH — NO BLIND SHORTS";
  }

  if (trendState === "LATE_W3_CONSOLIDATION") {
    return "🟡 POSSIBLE W4 — TREND STILL SUPPORTED";
  }

  if (trendState === "W4_TRANSITION_WARNING") {
    return "🟠 W4 TRANSITION WARNING — NOT CONFIRMED";
  }

  if (trendState === "W4_CONFIRMED") {
    return "🔵 W4 CONFIRMED — WAIT FOR W5 TRIGGER";
  }

  // Zone states are important, but they should not override active W2/W4 correction wording.
  if (zoneState === "NEGOTIATED_ZONE_BUYING_ACTIVE") {
    return "🟢 NEGOTIATED ZONE BUYING ACTIVE";
  }

  if (zoneState === "NEGOTIATED_ZONE_REJECTION_WARNING") {
    return "🟠 NEGOTIATED ZONE REJECTION WARNING";
  }

  if (zoneState === "NEGOTIATED_ZONE_LOST") {
    return "🔴 NEGOTIATED ZONE LOST";
  }

  if (zoneState === "NEGOTIATED_ZONE_DECISION_POINT") {
    return "🟡 NEGOTIATED ZONE DECISION POINT";
  }

  if (state === "W3_READY") return "🟢 W3 SETUP READY — WAIT FOR BREAK";
  if (state === "W5_READY") return "🟢 W5 SETUP READY — WAIT FOR BREAK";
  if (state === "W3_TRIGGER_LONG") return "🟢 W3 LONG TRIGGER CONFIRMED";
  if (state === "W5_TRIGGER_LONG") return "🟢 W5 LONG TRIGGER CONFIRMED";

  if (status === "ENTRY_LONG") {
    if (state === "DIP_BUY_CONTINUATION") {
      const microState = String(engine22?.microContinuation?.state || "").toUpperCase();

      if (microState === "MICRO_W3_ACTIVE") {
        return "🟢 MICRO W3 ACTIVE — DIP-BUY CONTINUATION";
      }

      return "🟢 DIP-BUY CONTINUATION — ENTRY LONG";
    }

    return "🟢 SCALP ENTRY LONG";
  }

  if (status === "PROBE_LONG") return "🔵 SCALP PROBE LONG — READY TO TRIGGER";
  if (status === "ENTRY_SHORT") return "🔴 SCALP ENTRY SHORT — EXHAUSTION REJECTION";
  if (status === "PROBE_SHORT") return "🟠 SCALP PROBE SHORT — READY TO TRIGGER";
  if (status === "NO_SHORT") return "⛔ SHORTS BLOCKED — FINAL IMPULSE";
  if (status === "NO_SCALP") return "⚪ NO SCALP — STAND DOWN";

  return null;
}

function engine22Color(engine22) {
  const runner = engine22?.runnerMode || null;
  if (runner?.active === true) return "#22c55e";

  const state = String(engine22?.state || "").toUpperCase();
  const abcState = String(engine22?.abcState || "").toUpperCase();
  const status = String(engine22?.status || "").toUpperCase();
  const trendState = String(engine22?.trendVsWave?.state || "").toUpperCase();

  if (trendState === "W3_CONTINUATION_WATCH") return "#fbbf24";
  if (trendState === "LATE_W3_CONSOLIDATION") return "#fbbf24";
  if (trendState === "W4_TRANSITION_WARNING") return "#fb923c";
  if (trendState === "W4_CONFIRMED") return "#60a5fa";

  if (
    state.includes("TRIGGER_LONG") ||
    abcState === "A_TO_B_TRIGGER_LONG" ||
    status === "ENTRY_LONG"
  ) {
    return "#22c55e";
  }

  if (status === "ENTRY_SHORT") return "#ef4444";
  if (status === "PROBE_LONG") return "#60a5fa";
  if (status === "PROBE_SHORT") return "#f97316";
  if (state.includes("ACTIVE_WAIT") || abcState) return "#fbbf24";

  return "#9ca3af";
}

function getTrendVsWaveRead(engine22) {
  const trendVsWave = engine22?.trendVsWave || null;
  const state = String(trendVsWave?.state || "").toUpperCase();
  const e22State = String(engine22?.state || "").toUpperCase();
  const e22Status = String(engine22?.status || "").toUpperCase();
  const e22Setup = String(engine22?.setupType || "").toUpperCase();
  const e22Size = String(engine22?.sizeMode || "").toUpperCase();

  if (!trendVsWave || !state || state === "NO_TREND_WAVE_CONFLICT") {
    return null;
  }

  if (
    state === "W3_CONTINUATION_WATCH" &&
    (
      e22State === "DIP_BUY_CONTINUATION" ||
      e22State === "W3_DIP_BUY_TRIGGER_LONG" ||
      e22Setup === "DIP_BUY_CONTINUATION" ||
      e22Setup === "W3_DIP_BUY_CONTINUATION"
    ) &&
    e22Status === "ENTRY_LONG"
  ) {
    return {
      currentRead: "🟢 W3 DIP BUY CONTINUATION — LONG ACTIVE",
      confirmation:
        "Minor W3 is still active.\nMinute W5 is no longer heavy.\nPrice reclaimed EMA10/EMA20.\nHigher timeframe remains strong.\nW4 is not confirmed.\nDip-buy continuation is active.",
      details: [
        trendVsWave?.oneHourScore != null ? `1H Score: ${trendVsWave.oneHourScore}` : null,
        trendVsWave?.fourHourScore != null ? `4H Score: ${trendVsWave.fourHourScore}` : null,
        trendVsWave?.dailyScore != null ? `Daily Score: ${trendVsWave.dailyScore}` : null,
        e22Size ? `Size: ${formatText(e22Size)}` : null,
        trendVsWave?.priceAboveDailyEma10 === true ? "Daily 10 EMA holding" : null,
      ].filter(Boolean),
      action: "Action: Long continuation active — manage with EMA10.",
      needs: "Risk: No blind shorts while higher timeframe remains supportive.",
    };
  }

  if (state === "W3_CONTINUATION_WATCH") {
    return {
      currentRead: "🟡 MINOR W3 ACTIVE — MINUTE W5 HEAVY",
      confirmation:
        "Minor W3 is still active.\nMinute W5 is heavy.\nHigher timeframe is still strong.\nShort-term is weak.\nW4 is not confirmed.\nNo blind shorts.",
      details: [
        trendVsWave?.oneHourScore != null ? `1H Score: ${trendVsWave.oneHourScore}` : null,
        trendVsWave?.fourHourScore != null ? `4H Score: ${trendVsWave.fourHourScore}` : null,
        trendVsWave?.dailyScore != null ? `Daily Score: ${trendVsWave.dailyScore}` : null,
        trendVsWave?.priceAboveDailyEma10 === true ? "Daily 10 EMA holding" : null,
        trendVsWave?.priceAbove1hEma10 === false ? "1H EMA10 lost / weak" : null,
      ].filter(Boolean),
      action: "Action: Stand down. Wait for reclaim or confirmed breakdown.",
      needs:
        engine22?.needs && engine22.needs !== "WAIT_FOR_SETUP"
          ? `Needs: ${formatText(engine22.needs)}`
          : "Needs: Better reaction quality or stronger continuation confirmation.",
    };
  }

  if (state === "LATE_W3_CONSOLIDATION") {
    return {
      currentRead: "🟡 POSSIBLE W4 — TREND STILL SUPPORTED",
      confirmation:
        "Engine 2 suggests possible W4, but higher timeframe trend still supports W3.\nDo not confirm W4 yet.\nNo W4-specific entry until confirmation.",
      details: [
        trendVsWave?.fourHourScore != null ? `4H Score: ${trendVsWave.fourHourScore}` : null,
        trendVsWave?.dailyScore != null ? `Daily Score: ${trendVsWave.dailyScore}` : null,
        trendVsWave?.masterScore != null ? `Master Score: ${trendVsWave.masterScore}` : null,
        trendVsWave?.priceAboveDailyEma10 === true ? "Daily 10 EMA holding" : null,
      ].filter(Boolean),
      action: "Action: Do not confirm W4 yet.",
      needs: "Needs: True W4 confirmation or W3 continuation reclaim.",
    };
  }

  if (state === "W4_TRANSITION_WARNING") {
    return {
      currentRead: "🟠 W4 TRANSITION WARNING — NOT CONFIRMED",
      confirmation:
        "Short-term weakness is increasing, but W4 is not confirmed yet.\nStand down until stronger confirmation appears.",
      details: [
        trendVsWave?.fourHourScore != null ? `4H Score: ${trendVsWave.fourHourScore}` : null,
        trendVsWave?.dailyScore != null ? `Daily Score: ${trendVsWave.dailyScore}` : null,
        trendVsWave?.priceAbove4hEma10 === false ? "4H EMA10 lost" : null,
        trendVsWave?.priceAboveDailyEma10 === true ? "Daily 10 EMA still holding" : null,
      ].filter(Boolean),
      action: "Action: Watch only. Do not force W4 entry.",
      needs: "Needs: Daily EMA10 loss, manual W4 confirmation, or failed reclaim.",
    };
  }

  if (state === "W4_CONFIRMED") {
    return {
      currentRead: "🔵 W4 CONFIRMED — WAIT FOR W5 TRIGGER",
      confirmation:
        "W4 is confirmed.\nWait for W4 → W5 trigger structure.\nNo blind dip buy.",
      details: [
        trendVsWave?.priceAboveDailyEma10 === false ? "Daily 10 EMA lost" : null,
        trendVsWave?.priceAbove4hEma10 === false ? "4H EMA10 lost" : null,
      ].filter(Boolean),
      action: "Action: Wait for clean W5 trigger.",
      needs: "Needs: C low hold, EMA reclaim, and B high break.",
    };
  }

  return null;
}

function getZoneAbsorptionRead(engine22) {
  const zone = engine22?.zoneAbsorption || null;
  const state = String(zone?.state || "").toUpperCase();

  if (!zone || !state || state === "NO_ACTIVE_NEGOTIATED_ZONE") {
    return null;
  }

  if (state === "NEGOTIATED_ZONE_BUYING_ACTIVE") {
    return {
      label: "🟢 NEGOTIATED ZONE BUYING ACTIVE",
      currentRead: "🟢 W3 DIP BUY + NEGOTIATED ZONE BUYING",
      confirmation:
        "Price is being bought inside the negotiated zone.\nMinor W3 remains active.\nHigher timeframe remains strong.\nDip-buy continuation remains valid.",
      details: [
        zone?.zoneLo != null && zone?.zoneHi != null
          ? `Zone: ${formatLevel(zone.zoneLo)} – ${formatLevel(zone.zoneHi)}`
          : null,
        zone?.zoneMid != null ? `Mid: ${formatLevel(zone.zoneMid)}` : null,
        zone?.priceInsideZone === true ? "Price inside negotiated zone" : null,
        zone?.buyersAbsorbing === true ? "Buyers absorbing supply" : null,
      ].filter(Boolean),
      action: "Action: Hold long while EMA10 and negotiated zone support hold.",
      needs:
        zone?.zoneLo != null
          ? `Risk: If price loses ${formatLevel(zone.zoneLo)}, watch for failed breakout pullback.`
          : "Risk: If price loses the negotiated zone, watch for failed breakout pullback.",
    };
  }

  if (state === "NEGOTIATED_ZONE_REJECTION_WARNING") {
    return {
      label: "🟠 NEGOTIATED ZONE REJECTION WARNING",
      currentRead: "🟠 NEGOTIATED ZONE REJECTION WARNING",
      confirmation:
        "Price is inside the negotiated zone, but buyers are weakening.\nEMA10 is not holding and structure is failing.",
      details: [
        zone?.zoneLo != null && zone?.zoneHi != null
          ? `Zone: ${formatLevel(zone.zoneLo)} – ${formatLevel(zone.zoneHi)}`
          : null,
        zone?.sellersRejecting === true ? "Sellers rejecting zone" : null,
      ].filter(Boolean),
      action: "Action: Do not chase long until reclaim.",
      needs: "Needs: EMA10 reclaim or stronger buyer absorption.",
    };
  }

  if (state === "NEGOTIATED_ZONE_LOST") {
    return {
      label: "🔴 NEGOTIATED ZONE LOST",
      currentRead: "🔴 NEGOTIATED ZONE LOST — FAILED BREAKOUT RISK",
      confirmation:
        "Price lost the lower boundary of the negotiated zone.\nFailed breakout pullback risk is rising.",
      details: [
        zone?.zoneLo != null ? `Zone low lost: ${formatLevel(zone.zoneLo)}` : null,
        zone?.zoneHi != null ? `Zone high: ${formatLevel(zone.zoneHi)}` : null,
      ].filter(Boolean),
      action: "Action: Stand down on longs.",
      needs: "Needs: Reclaim the negotiated zone before long continuation is valid again.",
    };
  }

  if (state === "NEGOTIATED_ZONE_DECISION_POINT") {
  const e22State = String(engine22?.state || "").toUpperCase();
  const abcState = String(engine22?.abcState || "").toUpperCase();

  const isW4Active =
    e22State === "W4_ACTIVE_WAIT" ||
    abcState.startsWith("W4_");

  return {
    label: "🟡 NEGOTIATED ZONE DECISION POINT",
    currentRead: isW4Active
      ? "🟡 MINUTE W4 — NEGOTIATED ZONE DECISION POINT"
      : "🟡 NEGOTIATED ZONE DECISION POINT",
    confirmation: isW4Active
      ? "Price is interacting with the negotiated zone.\nMinor W5 remains active, but Minute W4 is pulling back.\nBuyers have not confirmed absorption yet.\nSellers have not confirmed rejection yet.\nWait for A-low / zone support confirmation."
      : "Price is interacting with the negotiated zone.\nHigher timeframe remains supportive.\nWait for buyers to absorb the zone or sellers to reject it.",
      details: [
        zone?.zoneLo != null && zone?.zoneHi != null
          ? `Zone: ${formatLevel(zone.zoneLo)} – ${formatLevel(zone.zoneHi)}`
          : null,
        zone?.zoneMid != null ? `Mid: ${formatLevel(zone.zoneMid)}` : null,
        zone?.priceInsideZone === true ? "Price inside negotiated zone" : null,
        isW4Active ? "Minute W4 pullback active" : "Higher timeframe supportive",
        "Do not force entry until zone resolves",
      ].filter(Boolean),
      action: "Action: Watch only until the zone resolves.",
      needs: "Needs: Buyer absorption for continuation or zone loss for rejection.",
    };
  }

  return null;
}

function getEngine22CurrentRead(engine22, wave3RetraceTimeline, fib = {}) {
  const state = String(engine22?.state || "").toUpperCase();
  const abcState = String(engine22?.abcState || "").toUpperCase();
  const type = String(engine22?.type || "").toUpperCase();
  const status = String(engine22?.status || "").toUpperCase();

  const debug = engine22?.debug || {};

  const currentPrice = debug?.latestClose ?? fib?.latestClose ?? null;

  const ema10_10m = debug?.ema10 ?? fib?.ema10 ?? null;
  const ema20_10m = debug?.ema20 ?? fib?.ema20 ?? null;

  const close30m =
    debug?.close30m ??
    fib?.close30m ??
    fib?.thirtyMinClose ??
    null;

  const ema10_30m =
    debug?.ema10_30m ??
    fib?.ema10_30m ??
    fib?.thirtyMinEma10 ??
    null;

  const ema20_30m =
    debug?.ema20_30m ??
    fib?.ema20_30m ??
    fib?.thirtyMinEma20 ??
    null;

  const hourlyClose =
    debug?.hourlyClose ??
    fib?.hourlyClose ??
    null;

  const ema10_1h =
    debug?.ema10_1h ??
    fib?.ema10_1h ??
    null;

  const ema20_1h =
    debug?.ema20_1h ??
    fib?.ema20_1h ??
    null;

  const aLow = debug?.aLow ?? null;
  const bHigh = debug?.bHigh ?? null;
  const cLow = debug?.cLow ?? null;

  const correctionLeg =
    engine22?.correctionLeg ||
    debug?.correctionLeg ||
    null;

  const nextFocus =
    engine22?.nextFocus ||
    debug?.nextFocus ||
    null;

  const tenMinStatus =
    Number(currentPrice) > Number(ema10_10m) &&
    Number(currentPrice) > Number(ema20_10m)
      ? "holding above 10m EMA10/20"
      : "watch 10m EMA support";

  const thirtyMinStatus =
    close30m != null && ema10_30m != null
      ? Number(close30m) > Number(ema10_30m)
        ? "30m confirming above EMA10"
        : "30m not confirming yet"
      : "30m EMA10/20 unavailable";

  const oneHourStatus =
    hourlyClose != null && ema10_1h != null
      ? Number(hourlyClose) > Number(ema10_1h)
        ? "1H holding above EMA10 — shallow continuation favored"
        : "1H below EMA10 — C-wave risk still active"
      : "1H EMA10 unavailable";

  const currentStructureText = getRegimeStructureText(engine22);
    if (
      effectiveState === "MICRO_W4_PULLBACK_ACTIVE" ||
      effectiveState === "MICRO_W4_RECLAIM_WATCH" ||
      effectiveState === "MICRO_W5_TRIGGER_PENDING"
    ) {

     const stateTitle =
       effectiveState === "MICRO_W4_PULLBACK_ACTIVE"
         ? "🟡 MICRO W4 PULLBACK ACTIVE — WAIT FOR MICRO W5 TRIGGER"
         : effectiveState === "MICRO_W4_RECLAIM_WATCH"
         ? "🟡 MICRO W4 RECLAIM WATCH — WAIT FOR CONFIRMATION"
         : "🟢 MICRO W5 TRIGGER PENDING — WAIT FOR ENGINE 3/4";
  
     const actionText =
       effectiveState === "MICRO_W5_TRIGGER_PENDING"
         ? "Action:\nMicro W4 appears to be resolving.\nWait for Engine 3 reaction confirmation and Engine 4 participation before entry.\nDo not treat this as an entry by itself."
         : effectiveState === "MICRO_W4_RECLAIM_WATCH"
         ? "Action:\nNo chase long.\nNo blind short.\nWait for 10m EMA20 reclaim, 1H support improvement, Engine 3 reaction, and Engine 4 participation."
         : "Action:\nNo chase long.\nNo blind short.\nWait for Micro W4 support/reclaim, then watch for Micro W5 trigger.";
      return {
        currentRead: stateTitle,
        confirmation:
          "Higher timeframe W5 is still active.\n" +
          "Micro W3 completed.\n" +
          "Micro W4 pullback is now active.\n\n" +
          currentStructureText +
          "\n\nMeaning:\n" +
          "EOD = permission.\n" +
          "1H = pullback health.\n" +
          "10m = trigger timing.\n\n" +
          actionText +
          "\n\nFailure:\n" +
          "If 1H remains below EMA10 and price loses deeper support, stand down.",
      };
    }
  
    if (
      state === "W4_SHALLOW_CONTINUATION_WATCH" ||
      abcState === "W4_SHALLOW_CONTINUATION_WATCH"
    ) {
      return {
        currentRead: "🟡 SHALLOW W4 CONTINUATION WATCH",
        confirmation:
          "Wave A low held inside Minute W4.\nB-bounce is strong.\n\n" +
          currentStructureText +
          "\n\nConfirmation stack:\n10m = early scalp timing.\n30m = strength confirmation.\n1H = decides whether C-wave is still likely.\n\nNeeds:\nHold 10m EMA10/20.\nBuild strength above 30m EMA10/20.\nHave 1H reclaim or hold EMA10 to reduce the odds of a full C-wave.\nBreak B-bounce high or continuation level for shallow W5 trigger.\n\nFailure:\nIf 10m loses EMA10/20, caution.\nIf 30m closes below EMA10/20, shallow continuation is weakening.\nIf 1H rejects below EMA10, resume waiting for C-low.",
      };
    }
  
  if (
    state === "W4_B_BOUNCE_ACTIVE" ||
    abcState === "W4_B_BOUNCE_ACTIVE"
  ) {
    return {
      currentRead: "🟢 W4 B-BOUNCE ACTIVE — REDUCED SIZE",
      confirmation:
        "Wave A low held inside Minute W4.\n10m reclaimed EMA10/EMA20.\nThis is a reduced-size B-bounce scalp, not full W5 confirmation yet.\n\nNext:\nHold 10m EMA10/20.\nWatch 1H EMA10 to decide if C-wave is still likely.\n\nIf B-bounce fails or 1H rejects below EMA10, resume waiting for C-low.",
    };
  }

  if (
    state === "W5_CONTINUATION_WATCH" ||
    abcState === "W5_CONTINUATION_WATCH"
  ) {
    return {
      currentRead: "🟡 W5 CONTINUATION WATCH — WAIT FOR BREAK",
      confirmation:
        "A-low held and B-bounce remains strong.\nC-low is not marked, but price is behaving like shallow W4 continuation.\n\nConfirmation stack:\n10m is the fast trigger layer.\n1H should reclaim or hold EMA10 to lower the odds of a full C-wave.\n\nNeeds: break B-high / continuation level for W5 shallow trigger.\nNo full-size chase until trigger confirms.",
    };
  }

  if (
    state === "W5_SHALLOW_TRIGGER_LONG" ||
    abcState === "W5_SHALLOW_TRIGGER_LONG"
  ) {
    return {
      currentRead: "🟢 W5 SHALLOW TRIGGER LONG",
      confirmation:
        "B-high / continuation level broke while 10m EMA10/20 held.\n1H should reclaim or hold EMA10 to confirm C-wave is less likely.\n\nThis confirms the shallow W4 continuation trigger from Engine 22.\nImportant: Engine 2 still needs official MARK,W4 for official wave confirmation.\nManage as caution-size W5 continuation.", 
    };
  }

  if (
   state === "MINUTE_W5_ACTIVE_AFTER_SHALLOW_W4" ||
   abcState === "MINUTE_W5_ACTIVE_AFTER_SHALLOW_W4"
 ) {
   return {
     currentRead: "🟢 MINUTE W5 ACTIVE — SHALLOW W4 COMPLETE",
     confirmation:
       "Price action says the C-wave likely failed to form.\nA-low held, 10m EMA10/20 reclaimed, 1H EMA10 is holding, and price pushed back above W3 high.\n\n" +
       currentStructureText +
       "\n\nMeaning:\nMinute W4 is still officially open until manually marked, but Engine 22 is treating Minute W5 as active after a shallow W4.\nDo not keep waiting blindly for C unless support fails.\n\nAction:\nDo not chase extension.\nLook for a controlled W5 dip-buy or clean continuation setup.\n\nFailure:\nIf 10m loses EMA10/20 and 1H rejects below EMA10, shallow W4 failed and C-wave risk returns.",
   };
 } 
  
  if (
    state === "A_TO_B_TRIGGER_LONG" ||
    abcState === "A_TO_B_TRIGGER_LONG" ||
    type === "CORRECTION_A_TO_B_LONG"
  ) {
    return {
      currentRead: "🟢 W4 B-BOUNCE LONG ACTIVE — REDUCED SIZE",
      confirmation:
        "Wave A low held inside Minute W4.\nB-bounce long is active, reduced size.\n\n" +
        currentStructureText +
        "\n\nMeaning:\n10m reclaimed EMA10/20 = B-bounce trigger is active.\n1H EMA10 holding = C-wave is not confirmed yet.\n\nNeeds:\nHold above 10m EMA10/20.\nMark B-high when momentum stalls.\nBreak B-high / continuation level for shallow W5 continuation.\n\nFailure:\nIf 10m loses EMA10/20, caution.\nIf 1H rejects below EMA10, resume waiting for C-low.",
    };
  } 

  if (state === "DIP_BUY_CONTINUATION" && status === "ENTRY_LONG") {
    const microState = String(engine22?.microContinuation?.state || "").toUpperCase();
    const microTarget =
      engine22?.microContinuation?.debug?.scalpExtension?.targetZone ||
      engine22?.microContinuation?.debug?.micro?.waveExtension?.targetZone ||
      null;

    const targetText =
      microTarget?.lo != null && microTarget?.hi != null
        ? `\nMicro target zone: ${formatLevel(microTarget.lo)} – ${formatLevel(microTarget.hi)}.`
        : "";

    return {
      currentRead:
        microState === "MICRO_W3_ACTIVE"
          ? "🟢 MICRO W3 ACTIVE — DIP-BUY CONTINUATION"
          : "🟢 DIP-BUY CONTINUATION — ENTRY LONG",
      confirmation:
        "Continuation mode is active.\n" +
        "The preferred trade is controlled dip-buy only — do not chase vertical extension candles." +
        targetText +
        "\n\n" +
        currentStructureText +
        "\n\nMeaning:\n" +
        "EOD = permission.\n" +
        "1H = pullback health.\n" +
        "10m = trigger timing.\n\n" +
        "Action:\n" +
        "Buy controlled pullbacks that hold 10m EMA10/20 or reclaim them cleanly.\n" +
        "Avoid chasing if price is extended away from the EMAs.\n\n" +
        "Failure:\n" +
        "If 1H loses EMA10, stand down.\n" +
        "If EOD loses Daily EMA10, continuation dip-buy permission turns off.",
    };
  }

  if (
    state === "MICRO_W3_ACTIVE" ||
    state === "MICRO_W3_PULLBACK_TEST" ||
    state === "MICRO_W3_WEAKENING" ||
    state === "MICRO_W3_FAILED"
  ) {
    const stateTitle =
      state === "MICRO_W3_ACTIVE"
        ? "🟢 MICRO W3 ACTIVE — BUY CONTROLLED DIPS"
        : state === "MICRO_W3_PULLBACK_TEST"
        ? "🟡 MICRO W3 PULLBACK TEST — HOLD 10m EMA20"
        : state === "MICRO_W3_WEAKENING"
        ? "🟠 MICRO W3 WEAKENING — WAIT FOR RECLAIM"
        : "🔴 MICRO W3 FAILED — STAND DOWN";

    const actionText =
      state === "MICRO_W3_ACTIVE"
        ? "Action: Buy controlled dips only. Do not chase vertical candles."
        : state === "MICRO_W3_PULLBACK_TEST"
        ? "Action: Normal dip test. Hold 10m EMA20 or reclaim 10m EMA10."
        : state === "MICRO_W3_WEAKENING"
        ? "Action: Do not chase. Wait for 10m EMA10/20 reclaim."
        : "Action: Stand down until structure resets.";

    return {
      currentRead: stateTitle,
      confirmation:
        "Minute W5 is active and Micro W3 is the execution leg.\n\n" +
        currentStructureText +
        "\n\nMeaning:\n" +
        "EOD = permission.\n" +
        "1H = pullback health.\n" +
        "10m = trigger timing.\n\n" +
        actionText +
        "\n\nFailure:\n" +
        "If 1H loses EMA10, Micro W3 continuation has failed.\n" +
        "If EOD loses Daily EMA10, continuation dip-buy permission turns off.",
    };
  }
  
  if (state === "W4_ACTIVE_WAIT") {
    if (abcState === "W4_A_FORMING") {
      return {
        currentRead: "🟡 MINUTE W4 ACTIVE — WAIT FOR A LOW",
        confirmation:
          "Minor W5 remains active.\nMinute W4 pullback is forming.\nDo not buy yet.\nWait for A-low to confirm support.\nAfter A-low, watch B-bounce.\nAfter B-bounce, wait for C-low.\nOnly after C-low + reclaim / breakout confirmation does W5 trigger.",
      };
    }

   if (abcState === "W4_A_LOW_ACTIVE") {
    return {
      currentRead: "🟡 WAVE A COMPLETE — WATCH B BOUNCE",
      confirmation:
        "A-low is marked, but B-bounce is not confirmed yet.\n\n" +
        currentStructureText +
        "\n\nMeaning:\nIf 10m reclaims EMA10/20 and 1H EMA10 holds, B-bounce can restart.\nIf 10m loses support and 1H rejects below EMA10, C-wave risk returns.\n\nNeeds:\n10m reclaim above EMA10/20.\n1H EMA10 holding.\nThen watch for B-bounce confirmation.",
    };
  } 

    if (abcState === "W4_C_LEG_STARTING") {
      return {
        currentRead: "WAVE C LEG STARTING — NO LONG",
        confirmation:
          "B high rejected. C leg is starting. Wait for C low before looking for W5.",
      };
    }

    if (abcState === "W4_ABC_COMPLETE_WAIT_TRIGGER") {
      return {
        currentRead: "ABC COMPLETE — WAIT FOR W5 TRIGGER",
        confirmation:
          "ABC correction is marked. Wait for EMA reclaim and break above B high.",
      };
    }

    return {
      currentRead: "MINUTE W4 ACTIVE — PULLBACK PHASE",
      confirmation:
        wave3RetraceTimeline?.message ||
        "Wait for A low → B bounce → C low → W5 trigger.",
    };
  }

  if (state === "W2_ACTIVE_WAIT") {
    return {
      currentRead: "MINUTE W2 ACTIVE — PULLBACK PHASE",
      confirmation:
        wave3RetraceTimeline?.message ||
        "Wait for A low → B bounce → C low → W3 trigger.",
    };
  }

  if (state === "W5_READY") {
    return {
      currentRead: "W5 SETUP READY — WAIT FOR TRIGGER",
      confirmation: engine22?.triggerType
        ? formatText(engine22.triggerType)
        : "W4 held. Wait for break above B high.",
    };
  }

  if (state === "W5_TRIGGER_LONG") {
  return {
    currentRead: "🟢 W5 LONG TRIGGER CONFIRMED — BUY CONTROLLED DIPS",
    confirmation:
      (engine22?.entryTriggerLevel
        ? `Break above ${formatLevel(engine22.entryTriggerLevel)} confirmed W5 launch.\n`
        : "W4 to W5 long trigger confirmed.\n") +
      "\n" +
      currentStructureText +
      "\n\nAction:\nContinuation mode is active, but fresh entries should come from controlled pullbacks, not chasing extended candles.\n\nFailure:\nIf 10m and 1H support fail, stand down.",
  };
}

if (status === "NO_SHORT") {
  return {
    currentRead: "FINAL IMPULSE — SHORTS BLOCKED",
    confirmation: "Higher wave context remains bullish. No countertrend short.",
  };
}

return null;
}

function newsRiskDisplay(newsRisk) {

  const ok = newsRisk?.ok === true;
  const active = newsRisk?.active === true;
  const stale = newsRisk?.stale === true;
  const riskLevel = String(newsRisk?.riskLevel || "UNKNOWN").toUpperCase();
  const category = String(newsRisk?.category || "UNKNOWN").toUpperCase();
  const headline = newsRisk?.headline || null;
  const source = newsRisk?.source || "News";
  const ageMinutes = newsRisk?.ageMinutes ?? null;

  const hardBlock =
    ok &&
    active &&
    stale !== true &&
    riskLevel === "HIGH";

  const showCaution =
    ok &&
    headline &&
    (riskLevel === "MEDIUM" || riskLevel === "HIGH" || stale === true);

  if (!hardBlock && !showCaution) return null;

  if (hardBlock) {
    return {
      title: `🚨 NEWS SHOCK ACTIVE — ${category}`,
      message: headline,
      detail:
        ageMinutes != null
          ? `${source} • ${ageMinutes} min old • HIGH risk`
          : `${source} • HIGH risk`,
      color: "#fecaca",
      background: "rgba(127, 29, 29, 0.42)",
      border: "1px solid rgba(239, 68, 68, 0.75)",
    };
  }

  return {
    title: stale
      ? `⚠️ STALE NEWS CAUTION — ${category}`
      : `⚠️ NEWS CAUTION — ${category}`,
    message: headline,
    detail:
      ageMinutes != null
        ? `${source} • ${ageMinutes} min old • no hard block`
        : `${source} • no hard block`,
    color: "#fde68a",
    background: "rgba(120, 53, 15, 0.32)",
    border: "1px solid rgba(251, 191, 36, 0.65)",
  };
}

function CorrectionDetails({ engine22, wave3Retrace, wave3RetraceTimeline, wave3RetraceZone }) {
  const state = String(engine22?.state || "").toUpperCase();
  const abcState = String(engine22?.abcState || "").toUpperCase();

  const abcLevels = engine22?.abcLevels || {};
  const debug = engine22?.debug || {};

  const aLow = abcLevels?.aLow ?? debug?.aLow ?? null;
  const bHigh = abcLevels?.bHigh ?? debug?.bHigh ?? null;
  const cLow = abcLevels?.cLow ?? debug?.cLow ?? null;

  if (state === "A_TO_B_TRIGGER_LONG" || abcState === "A_TO_B_TRIGGER_LONG") {
    return (
      <>
        <div>Wave A Complete — B Bounce Long Active</div>
        <div>A low held. 10m reclaimed EMA10/EMA20.</div>
        <div>1H EMA10 is holding, so C-wave is not confirmed yet.</div>
        <div>Action: Reduced-size B-long scalp active.</div>
        <div>Needs: hold 10m EMA10/20, then mark B-high when momentum stalls.</div>
        <div>If 1H rejects below EMA10, resume waiting for C-low.</div>
      </>
    );
  }

  if (state === "W4_ACTIVE_WAIT") {
    if (abcState === "W4_A_FORMING") {
      return (
        <>
          <div>State: WAIT — A low not confirmed yet</div>
          <div>Structure: A leg forming → waiting for A low</div>
          {wave3RetraceZone && (
            <div>
              {`Wave A Watch Zone: ${formatLevel(wave3RetraceZone.lo)} – ${formatLevel(
                wave3RetraceZone.hi
              )}`}
            </div>
          )}
          {wave3Retrace?.currentPrice != null && (
            <div>{`Current Price: ${formatLevel(wave3Retrace.currentPrice)}`}</div>
          )}
          <div>Next: Mark A low only after price confirms support.</div>
        </>
      );
    }

    if (abcState === "W4_A_LOW_ACTIVE") {
    return (
      <>
        <div>Wave A Complete — watching for B bounce</div>
        <div>{`A Low: ${formatLevel(aLow)}`}</div>
        <div>Needs: 10m reclaim EMA10/20 for B-bounce confirmation.</div>
        <div>1H EMA10 decides whether C-wave risk is returning.</div>
        <div>Next: If B bounce confirms, trade reduced size and later mark B high.</div>
      </>
    );
  }

    if (abcState === "W4_C_LEG_STARTING") {
      return (
        <>
          <div>B high rejected — C leg starting</div>
          <div>{`A Low: ${formatLevel(aLow)} | B High: ${formatLevel(bHigh)}`}</div>
          <div>State: NO LONG during C leg.</div>
          <div>Next: Wait for C low, then watch for W5 setup.</div>
        </>
      );
    }

    if (abcState === "W4_ABC_COMPLETE_WAIT_TRIGGER") {
      return (
        <>
          <div>ABC correction complete — W5 setup building</div>
          <div>{`A Low: ${formatLevel(aLow)} | B High: ${formatLevel(bHigh)} | C Low: ${formatLevel(cLow)}`}</div>
          <div>Needs: EMA reclaim + break above B high.</div>
          <div>Next: W5 trigger only after B high breaks.</div>
        </>
      );
    }

    return (
      <>
        <div>State: WAIT — A low not confirmed yet</div>
        <div>Structure: A low → B bounce → C low → W5 trigger</div>
        {wave3RetraceTimeline?.label && <div>{wave3RetraceTimeline.label}</div>}
        {wave3RetraceZone && (
          <div>
            {`Wave A Watch Zone: ${formatLevel(wave3RetraceZone.lo)} – ${formatLevel(
              wave3RetraceZone.hi
            )}`}
          </div>
        )}
      </>
    );
  }

  if (["W2_ACTIVE_WAIT", "W3_READY", "W5_READY"].includes(state)) {
    return (
      <>
        <div>
          {engine22?.needs ? `Needs: ${formatText(engine22.needs)}` : "Needs: Wait for correction trigger"}
        </div>
        {wave3RetraceTimeline?.label && <div>{wave3RetraceTimeline.label}</div>}
        {wave3Retrace?.currentPrice != null && (
          <div>{`Current Price: ${formatLevel(wave3Retrace.currentPrice)}`}</div>
        )}
        {wave3RetraceZone && (
          <div>
            {`Wave A Watch Zone: ${formatLevel(wave3RetraceZone.lo)} – ${formatLevel(
              wave3RetraceZone.hi
            )}`}
          </div>
        )}
        {wave3RetraceTimeline?.nextFocus && <div>{wave3RetraceTimeline.nextFocus}</div>}
      </>
    );
  }

  return null;
}

function TrendVsWaveDetails({ trendRead }) {
  if (!trendRead) return null;

  return (
    <div
      style={{
        fontSize: 18,
        lineHeight: 1.4,
        marginBottom: 8,
        color: "#fde68a",
        fontWeight: 800,
        whiteSpace: "pre-line",
      }}
    >
      {Array.isArray(trendRead.details) && trendRead.details.length > 0 && (
        <div style={{ color: "#cbd5e1", marginBottom: 4 }}>
          {trendRead.details.join(" • ")}
        </div>
      )}
      {trendRead.action && <div>{trendRead.action}</div>}
      {trendRead.needs && <div>{trendRead.needs}</div>}
      {Array.isArray(trendRead.extra) &&
        trendRead.extra.length > 0 &&
        trendRead.extra.slice(0, 4).map((line, idx) => (
          <div key={idx} style={{ color: "#94a3b8", fontSize: 16 }}>
            {line}
          </div>
        ))}
    </div>
  );
}

export default function Engine17DecisionTimeline({
  overlayData,
  visible = true,
  chartMode = "SCALP",
}) {
  if (!visible || !overlayData?.ok) return null;

  const fib = overlayData?.fib || {};
  const engine22 = fib?.engine22Scalp || null;

  const newsRisk =
    overlayData?.newsRisk ||
    fib?.newsRisk ||
    null;

  const newsRiskCard = newsRiskDisplay(newsRisk);

  const wave3Retrace =
    fib?.wave3Retrace ||
    fib?.waveContext?.wave3Retrace ||
    fib?.engine2State?.minute?.wave3Retrace ||
    overlayData?.engine2State?.minute?.wave3Retrace ||
    null;

  const wave3RetraceTimeline = wave3Retrace?.timeline || null;
  const wave3RetraceZone = wave3Retrace?.zone || null;

  const isScalpMode = chartMode === "SCALP";

  const waveSource = getTimelineWaveSource({ engine22, fib, overlayData });

  const primary = formatWave(
    waveSource?.primaryPhase ||
    waveSource?.primary?.phase
  );

  const intermediate = formatWave(
    waveSource?.intermediatePhase ||
    waveSource?.intermediate?.phase
  );

  const minor = formatWave(
    waveSource?.minorPhase ||
    waveSource?.minor?.phase
  );

  const minutePhaseRaw =
    waveSource?.minutePhase ||
    waveSource?.minute?.phase ||
    "UNKNOWN";

  const microPhaseRaw =
    waveSource?.microPhase ||
    waveSource?.micro?.phase ||
    "UNKNOWN";

  const minute = prettyMinute(minutePhaseRaw);
  const micro = formatWave(microPhaseRaw);

  const trend4h = formatText(fib?.trendState_4h, "—");
  const trend4hRaw = String(fib?.trendState_4h || "").toUpperCase();

  const prepBias = String(fib?.prepBias || "NONE").toUpperCase();
  const readiness = formatText(fib?.readinessLabel, "WAIT");
  const executionBias = formatText(fib?.executionBias, "—");
  const strategyType = String(fib?.strategyType || "NONE").toUpperCase();

  const watchShort = !!fib?.continuationWatchShort;
  const watchLong = !!fib?.continuationWatchLong;
  const triggerShort = !!fib?.continuationTriggerShort;
  const triggerLong = !!fib?.continuationTriggerLong;

  const breakdownRef = formatLevel(fib?.breakdownRef);
  const lastHigherLow = formatLevel(fib?.lastHigherLow);
  const lastLowerHigh = formatLevel(fib?.lastLowerHigh);
  const wave3Status = String(fib?.wave3Status || "").toUpperCase();

  const conditionLines = Array.isArray(fib?.waveReasonCodes)
    ? fib.waveReasonCodes.map(conditionText).filter(Boolean).slice(0, 2)
    : [];

  let currentRead = isScalpMode
    ? "WAIT — NO SCALP SETUP"
    : "WAIT — NO SWING SETUP";

  let confirmation = isScalpMode
    ? "Waiting for fast scalp structure to form"
    : "Waiting for swing structure to form";

  if (wave3Status === "ACTIVE_EXTENSION") {
    currentRead = "Wave 3 Active";
    confirmation = "Watching for extension";
  }

  if (
    fib?.exhaustionTriggerShort &&
    executionBias === "LONG ONLY" &&
    trend4hRaw === "LONG_ONLY"
  ) {
    currentRead = "Trend remains long-only";
    confirmation =
      "Short risk present\nCountertrend short blocked\nWait for HTF breakdown";
  }

  if (wave3Status === "FIRST_WARNING") {
    currentRead = "Minor W3 Warning";
    confirmation = "Possible W4 forming";
  }

  if (prepBias === "SHORT_PREP" && watchShort) {
    currentRead = isScalpMode
      ? "WATCH — SHORT BREAKDOWN FORMING"
      : "Short prep active — watching for breakdown";

    confirmation =
      breakdownRef !== "—"
        ? `Break below ${breakdownRef} confirms structure breakdown`
        : lastHigherLow !== "—"
        ? `Break below ${lastHigherLow} confirms downside continuation`
        : "Break below structure confirms breakdown";
  }

  if (prepBias === "LONG_PREP" && watchLong) {
    currentRead = isScalpMode
      ? "WATCH — LONG BREAKOUT FORMING"
      : "Long prep active — watching for breakout";

    confirmation =
      lastLowerHigh !== "—"
        ? `Break above ${lastLowerHigh} confirms upside continuation`
        : "Break above structure confirms upside continuation";
  }

  if (strategyType === "EXHAUSTION" && wave3Status !== "ACTIVE_EXTENSION") {
    currentRead = isScalpMode
      ? "EXHAUSTION — REVERSAL ZONE"
      : "Exhaustion setup active";

    if (executionBias === "LONG ONLY" || executionBias === "LONG_ONLY") {
      confirmation = "Watching for downside reversal";
    } else if (executionBias === "SHORT ONLY" || executionBias === "SHORT_ONLY") {
      confirmation = "Watching for upside reversal";
    } else {
      confirmation = "Watching for reversal confirmation";
    }
  }

  if (triggerShort) {
    currentRead = isScalpMode
      ? "CONFIRMED SHORT — CONTINUATION"
      : "Downside continuation confirmed";

    confirmation =
      breakdownRef !== "—"
        ? `Break below ${breakdownRef} confirmed downside continuation`
        : lastHigherLow !== "—"
        ? `Break below ${lastHigherLow} confirmed downside continuation`
        : "Downside structure break confirmed";
  }

  if (triggerLong) {
    currentRead = isScalpMode
      ? "CONFIRMED LONG — CONTINUATION"
      : "Upside continuation confirmed";

    confirmation =
      lastLowerHigh !== "—"
        ? `Break above ${lastLowerHigh} confirmed upside continuation`
        : "Upside structure break confirmed";
  }

  const runnerRead =
    isScalpMode && engine22 ? getRunnerModeRead(engine22) : null;

  const zoneAbsorptionRead =
    isScalpMode && engine22 ? getZoneAbsorptionRead(engine22) : null;

  const trendVsWaveRead =
    isScalpMode && engine22 ? getTrendVsWaveRead(engine22) : null;

  const reactionVolumeContextText =
    isScalpMode && engine22 ? buildReactionVolumeContextText(engine22) : null;

  if (isScalpMode && engine22) {
  const e22Override = getEngine22CurrentRead(engine22, wave3RetraceTimeline, fib);
    
  const e22State = String(engine22?.state || "").toUpperCase();
  const e22AbcState = String(engine22?.abcState || "").toUpperCase();

  const isW4CorrectionActive =
    e22State === "W4_ACTIVE_WAIT" ||
    e22AbcState.startsWith("W4_");

 const microW4State = String(engine22?.microW4Pullback?.state || "").toUpperCase();

 const isMicroW4WorkflowActive =
   e22State === "MICRO_W4_PULLBACK_ACTIVE" ||
   e22State === "MICRO_W4_RECLAIM_WATCH" ||
   e22State === "MICRO_W5_TRIGGER_PENDING" ||
   microW4State === "MICRO_W4_PULLBACK_ACTIVE" ||
   microW4State === "MICRO_W4_RECLAIM_WATCH" ||
   microW4State === "MICRO_W5_TRIGGER_PENDING"; 

  if (runnerRead) {
    currentRead = runnerRead.currentRead;
    confirmation = runnerRead.confirmation;
  } else if ((isW4CorrectionActive || isMicroW4WorkflowActive) && e22Override) {
    currentRead = e22Override.currentRead;
    confirmation = e22Override.confirmation;
  } else if (trendVsWaveRead) {
    currentRead = trendVsWaveRead.currentRead;
    confirmation = trendVsWaveRead.confirmation;
  } else if (zoneAbsorptionRead) {
    currentRead = zoneAbsorptionRead.currentRead;
    confirmation = zoneAbsorptionRead.confirmation;
  } else if (e22Override) {
    currentRead = e22Override.currentRead;
    confirmation = e22Override.confirmation;
  }
}

  const e22Label = isScalpMode && engine22 ? engine22StateLabel(engine22) : null;
  const e22State = String(engine22?.state || "").toUpperCase();
  const e22AbcState = String(engine22?.abcState || "").toUpperCase();

  const showCorrectionDetails =
    isScalpMode &&
    engine22 &&
    !runnerRead &&
    !trendVsWaveRead &&
    (
      ["W2_ACTIVE_WAIT", "W4_ACTIVE_WAIT", "W3_READY", "W5_READY"].includes(e22State) ||
      e22AbcState ||
      e22State === "A_TO_B_TRIGGER_LONG"
    );

  const correctionDetails = showCorrectionDetails ? (
    <CorrectionDetails
      engine22={engine22}
      wave3Retrace={wave3Retrace}
      wave3RetraceTimeline={wave3RetraceTimeline}
      wave3RetraceZone={wave3RetraceZone}
    />
  ) : null;

   return (
  <>
    {reactionVolumeContextText && (
      <div
        style={{
          position: "absolute",
          top: 160,
          left: "calc(50% - 760px)",
          zIndex: 110,
          width: 350,
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
          fontSize: 16,
          lineHeight: 1.42,
          fontWeight: 800,
          whiteSpace: "pre-line",
          letterSpacing: "0.01em",
        }}
      >
        {reactionVolumeContextText}
      </div>
    )}

    <div
      style={{
        position: "absolute",
        top: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 109,
        width: 760,
        maxWidth: "64%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(6,10,20,0.94)",
        padding: "16px 20px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 28,
          lineHeight: 1.35,
          marginBottom: 10,
          color: "#f8fafc",
        }}
      >
        {`Primary ${primary} | Intermediate ${intermediate} | Minor ${minor} | ${minute} | Micro ${micro}`}
      </div>

      <div
        style={{
          fontSize: 22,
          lineHeight: 1.45,
          marginBottom: 8,
          color: "#cbd5e1",
          fontWeight: 800,
        }}
      >
        {`HTF Bias: ${trend4h}`}
      </div>

      <div
        style={{
          fontSize: 22,
          lineHeight: 1.45,
          marginBottom: 8,
          color: "#e5e7eb",
          fontWeight: 800,
          whiteSpace: "pre-line",
        }}
      >
        {currentRead}
      </div>

      {e22Label && e22Label !== currentRead && (
        <div
          style={{
            fontSize: 20,
            lineHeight: 1.4,
            marginBottom: 6,
            fontWeight: 900,
            color: engine22Color(engine22),
            textShadow:
              String(engine22?.runnerMode?.active || "").toUpperCase() === "TRUE" ||
              String(engine22?.state || "").toUpperCase().includes("TRIGGER") ||
              String(engine22?.abcState || "").toUpperCase().includes("TRIGGER") ||
              String(engine22?.status || "").toUpperCase().includes("ENTRY")
                ? "0 0 12px rgba(34,197,94,0.65)"
                : "none",
          }}
        >
          {e22Label}
        </div>
      )}

      {runnerRead ? (
        <TrendVsWaveDetails trendRead={runnerRead} />
      ) : correctionDetails ? null : zoneAbsorptionRead ? (
        <TrendVsWaveDetails trendRead={zoneAbsorptionRead} />
      ) : (
        trendVsWaveRead && <TrendVsWaveDetails trendRead={trendVsWaveRead} />
      )}

      {correctionDetails && (
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.35,
            marginBottom: 8,
            color: "#cbd5e1",
            fontWeight: 700,
          }}
        >
          {correctionDetails}
        </div>
      )}

      {isScalpMode &&
        engine22 &&
        !runnerRead &&
        !correctionDetails &&
        !trendVsWaveRead && (
          <div
            style={{
              fontSize: 18,
              lineHeight: 1.35,
              marginBottom: 8,
              color: "#cbd5e1",
              fontWeight: 700,
            }}
          >
            {String(engine22.status || "").toUpperCase() === "NO_SCALP" ? (
              "Waiting for long or short scalp trigger"
            ) : (
              <>
                <div>
                  {engine22.quality?.grade
                    ? `🟢 ${engine22.quality.grade} QUALITY`
                    : "⚪ QUALITY PENDING"}
                  {engine22.risk?.riskReward != null
                    ? ` | R:R ${engine22.risk.riskReward}`
                    : ""}
                </div>

                <div>
                  {String(engine22.status || "").toUpperCase() === "ENTRY_LONG" ||
                  String(engine22.status || "").toUpperCase() === "PROBE_LONG"
                    ? "Needs: continuation hold + EMA10 management"
                    : String(engine22.status || "").toUpperCase() === "ENTRY_SHORT" ||
                      String(engine22.status || "").toUpperCase() === "PROBE_SHORT"
                    ? "Needs: Seller distribution + fail high"
                    : ""}
                  {engine22.risk?.target != null
                    ? ` | Target: $${engine22.risk.target}`
                    : ""}
                  {engine22.risk?.stop != null
                    ? ` | Stop: $${engine22.risk.stop}`
                    : ""}
                </div>

                <div>
                  {engine22.management?.exitRule
                    ? `Exit: ${formatText(engine22.management.exitRule)}`
                    : "Exit: EMA10 management"}
                </div>
              </>
            )}
          </div>
        )}

      <div
        style={{
          fontSize: 20,
          lineHeight: 1.45,
          marginBottom: 8,
          color: "#cbd5e1",
          fontWeight: 700,
          whiteSpace: "pre-line",
        }}
      >
        {confirmation}
      </div>

           
      {conditionLines.length > 0 && !runnerRead && !zoneAbsorptionRead && !trendVsWaveRead && (
        <div
          style={{
            fontSize: 19,
            lineHeight: 1.4,
            marginBottom: 8,
            color: "#fbbf24",
            fontWeight: 700,
          }}
        >
          {conditionLines.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}

      <div
        style={{
          fontSize: 18,
          lineHeight: 1.4,
          color: "#94a3b8",
          fontWeight: 700,
        }}
      >
        {`Execution (LTF): ${executionBias} | Readiness: ${readiness}`}
      </div>
    </div>
  </>
);
}
