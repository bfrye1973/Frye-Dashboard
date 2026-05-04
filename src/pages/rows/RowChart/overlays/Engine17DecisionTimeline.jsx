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

function engine22StateLabel(engine22) {
  const state = String(engine22?.state || "").toUpperCase();
  const abcState = String(engine22?.abcState || "").toUpperCase();
  const status = String(engine22?.status || "").toUpperCase();

  if (state === "A_TO_B_TRIGGER_LONG" || abcState === "A_TO_B_TRIGGER_LONG") {
    return "🟢 WAVE B LONG ACTIVE — REDUCED SIZE";
  }

  if (state === "W2_ACTIVE_WAIT") return "🟡 W2 ACTIVE — WATCH CORRECTION";
  if (state === "W4_ACTIVE_WAIT") {
    if (abcState === "W4_A_FORMING") return "🟡 W4 ACTIVE — WATCHING FOR A LOW";
    if (abcState === "W4_A_LOW_ACTIVE") return "🟡 A LOW MARKED — WATCH B BOUNCE";
    if (abcState === "W4_C_LEG_STARTING") return "🟡 C LEG STARTING — WAIT FOR C LOW";
    if (abcState === "W4_ABC_COMPLETE_WAIT_TRIGGER") return "🟡 ABC COMPLETE — WAIT FOR W5 TRIGGER";
    return "🟡 W4 ACTIVE — WAIT FOR B BOUNCE";
  }

  if (state === "W3_READY") return "🟢 W3 SETUP READY — WAIT FOR BREAK";
  if (state === "W5_READY") return "🟢 W5 SETUP READY — WAIT FOR BREAK";
  if (state === "W3_TRIGGER_LONG") return "🟢 W3 LONG TRIGGER CONFIRMED";
  if (state === "W5_TRIGGER_LONG") return "🟢 W5 LONG TRIGGER CONFIRMED";

  if (status === "ENTRY_LONG") return "🟢 SCALP ENTRY LONG — EXHAUSTION / CONTINUATION";
  if (status === "PROBE_LONG") return "🔵 SCALP PROBE LONG — READY TO TRIGGER";
  if (status === "ENTRY_SHORT") return "🔴 SCALP ENTRY SHORT — EXHAUSTION REJECTION";
  if (status === "PROBE_SHORT") return "🟠 SCALP PROBE SHORT — READY TO TRIGGER";
  if (status === "NO_SHORT") return "⛔ SHORTS BLOCKED — FINAL IMPULSE";
  if (status === "NO_SCALP") return "⚪ NO SCALP — STAND DOWN";

  return null;
}

function engine22Color(engine22) {
  const state = String(engine22?.state || "").toUpperCase();
  const abcState = String(engine22?.abcState || "").toUpperCase();
  const status = String(engine22?.status || "").toUpperCase();

  if (state.includes("TRIGGER_LONG") || abcState === "A_TO_B_TRIGGER_LONG" || status === "ENTRY_LONG") {
    return "#22c55e";
  }
  if (status === "ENTRY_SHORT") return "#ef4444";
  if (status === "PROBE_LONG") return "#60a5fa";
  if (status === "PROBE_SHORT") return "#f97316";
  if (state.includes("ACTIVE_WAIT") || abcState) return "#fbbf24";
  return "#9ca3af";
}

function getEngine22CurrentRead(engine22, wave3RetraceTimeline) {
  const state = String(engine22?.state || "").toUpperCase();
  const abcState = String(engine22?.abcState || "").toUpperCase();
  const type = String(engine22?.type || "").toUpperCase();
  const status = String(engine22?.status || "").toUpperCase();

  if (state === "A_TO_B_TRIGGER_LONG" || abcState === "A_TO_B_TRIGGER_LONG" || type === "CORRECTION_A_TO_B_LONG") {
    return {
      currentRead: "🟢 WAVE B LONG ACTIVE — REDUCED SIZE",
      confirmation:
        "Wave A low held. Price reclaimed EMA10 and EMA20. Hold above the continuation level, then break recent B-bounce highs.",
    };
  }

  if (state === "W4_ACTIVE_WAIT") {
    if (abcState === "W4_A_FORMING") {
      return {
        currentRead: "MINUTE W4 ACTIVE — WATCHING FOR A LOW",
        confirmation:
          wave3RetraceTimeline?.message ||
          "Minute W4 is active. Watch for Wave A low before looking for B bounce.",
      };
    }

    if (abcState === "W4_A_LOW_ACTIVE") {
      return {
        currentRead: "WAVE A COMPLETE — WATCH B BOUNCE",
        confirmation:
          "A low is marked. Watch for EMA reclaim and B-bounce confirmation.",
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
      currentRead: "🟢 W5 LONG TRIGGER CONFIRMED",
      confirmation: engine22?.entryTriggerLevel
        ? `Break above ${formatLevel(engine22.entryTriggerLevel)} confirmed W5 launch`
        : "W4 to W5 long trigger confirmed.",
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
        <div>A low held. Price reclaimed EMA10 and EMA20.</div>
        <div>EMA10 reclaimed above EMA20, strengthening the B-bounce signal.</div>
        <div>Action: Reduced-size B-long scalp active.</div>
        <div>Needs: hold above continuation level, then break recent B-bounce highs.</div>
        <div>Next: Ride the B bounce. Mark B high when momentum stalls.</div>
      </>
    );
  }

  if (state === "W4_ACTIVE_WAIT") {
    if (abcState === "W4_A_FORMING") {
      return (
        <>
          <div>State: WAIT — no blind dip buys</div>
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
          <div>Needs: EMA10 reclaim + price above EMA20 for B-long scalp.</div>
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
        <div>State: WAIT — no blind dip buys</div>
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

export default function Engine17DecisionTimeline({
  overlayData,
  visible = true,
  chartMode = "SCALP",
}) {
  if (!visible || !overlayData?.ok) return null;

  const fib = overlayData?.fib || {};
  const engine22 = fib?.engine22Scalp || null;

  const wave3Retrace =
    fib?.wave3Retrace ||
    fib?.waveContext?.wave3Retrace ||
    fib?.engine2State?.minute?.wave3Retrace ||
    overlayData?.engine2State?.minute?.wave3Retrace ||
    null;

  const wave3RetraceTimeline = wave3Retrace?.timeline || null;
  const wave3RetraceZone = wave3Retrace?.zone || null;

  const isScalpMode = chartMode === "SCALP";
  const wave = fib?.waveContext || {};

  const primary = formatWave(wave?.primaryPhase);
  const intermediate = formatWave(wave?.intermediatePhase);
  const minor = formatWave(wave?.minorPhase);

  const minutePhaseRaw =
    fib?.waveContext?.minutePhase ||
    fib?.engine2State?.minute?.phase ||
    overlayData?.engine2State?.minute?.phase ||
    "UNKNOWN";

  const minute = prettyMinute(minutePhaseRaw);

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

  if (isScalpMode && engine22) {
    const e22Override = getEngine22CurrentRead(engine22, wave3RetraceTimeline);

    if (e22Override) {
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
    <div
      style={{
        position: "absolute",
        top: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 109,
        width: 760,
        maxWidth: "72%",
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
        {`Primary ${primary} | Intermediate ${intermediate} | Minor ${minor} | ${minute}`}
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
        }}
      >
        {currentRead}
      </div>

      {e22Label && (
        <div
          style={{
            fontSize: 20,
            lineHeight: 1.4,
            marginBottom: 6,
            fontWeight: 900,
            color: engine22Color(engine22),
            textShadow:
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

      {isScalpMode && engine22 && !correctionDetails && (
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
                  ? "Needs: Buyer absorption + hold support"
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

      {conditionLines.length > 0 && (
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
  );
}
