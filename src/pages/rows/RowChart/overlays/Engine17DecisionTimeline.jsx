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

function engine22StateLabel(engine22) {
  const state = String(engine22?.state || "").toUpperCase();
  const status = String(engine22?.status || "").toUpperCase();

  if (state === "W2_ACTIVE_WAIT") return "🟡 W2 ACTIVE — WAIT FOR W3 TRIGGER";
  if (state === "W4_ACTIVE_WAIT") return "🟡 W4 ACTIVE — WAIT FOR W5 TRIGGER";
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
  const status = String(engine22?.status || "").toUpperCase();

  if (state.includes("TRIGGER_LONG") || status === "ENTRY_LONG") return "#22c55e";
  if (status === "ENTRY_SHORT") return "#ef4444";
  if (status === "PROBE_LONG") return "#60a5fa";
  if (status === "PROBE_SHORT") return "#f97316";
  if (state.includes("ACTIVE_WAIT")) return "#fbbf24";
  return "#9ca3af";
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
  const wave3RetraceLevels = wave3Retrace?.levels || null;

  const isScalpMode = chartMode === "SCALP";
  const wave = fib?.waveContext || {};

  const primary = formatWave(wave?.primaryPhase);
  const intermediate = formatWave(wave?.intermediatePhase);
  const minor = formatWave(wave?.minorPhase);
  const minutePhase =
    fib?.waveContext?.minutePhase ||
    fib?.engine2State?.minute?.phase ||
    "Minute —";

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

  // Engine 22 correction priority — SCALP only.
  if (isScalpMode && engine22) {
    const e22Type = String(engine22.type || "").toUpperCase();
    const e22State = String(engine22.state || "").toUpperCase();
    const e22Status = String(engine22.status || "").toUpperCase();

    if (e22State === "W2_ACTIVE_WAIT" || e22Type === "W2_ACTIVE_WAIT") {
      currentRead = "MINUTE W2 ACTIVE — NO BLIND DIP BUY";
      confirmation =
        wave3RetraceTimeline?.message ||
        "Minute W2 is active. Wait for W3 trigger structure.";
    }

    if (e22State === "W4_ACTIVE_WAIT") {
      currentRead = "MINUTE W4 ACTIVE — WAIT FOR B BOUNCE";
      confirmation =
        "A low forming → waiting for B bounce (lower high).";
    }

    if (e22State === "W3_READY" || e22Type === "W3_READY") {
      currentRead = "W3 SETUP READY — WAIT FOR TRIGGER";
      confirmation = engine22.triggerType
        ? formatText(engine22.triggerType)
        : "W2 held. Wait for break above B high.";
    }

    if (e22State === "W5_READY" || e22Type === "W5_READY") {
      currentRead = "W5 SETUP READY — WAIT FOR TRIGGER";
      confirmation = engine22.triggerType
        ? formatText(engine22.triggerType)
        : "W4 held. Wait for break above B high.";
    }

    if (e22State === "W3_TRIGGER_LONG" || e22Type === "W2_TO_W3_LONG") {
      currentRead = "🟢 W3 LONG TRIGGER CONFIRMED";
      confirmation = engine22.entryTriggerLevel
        ? `Break above ${formatLevel(engine22.entryTriggerLevel)} confirmed W3 launch`
        : "W2 to W3 long trigger confirmed.";
    }

    if (e22State === "W5_TRIGGER_LONG" || e22Type === "W4_TO_W5_LONG") {
      currentRead = "🟢 W5 LONG TRIGGER CONFIRMED";
      confirmation = engine22.entryTriggerLevel
        ? `Break above ${formatLevel(engine22.entryTriggerLevel)} confirmed W5 launch`
        : "W4 to W5 long trigger confirmed.";
    }

    if (e22Status === "NO_SHORT") {
      currentRead = "FINAL IMPULSE — SHORTS BLOCKED";
      confirmation = "Higher wave context remains bullish. No countertrend short.";
    }
  }

  const e22Label = isScalpMode && engine22 ? engine22StateLabel(engine22) : null;
  const e22State = String(engine22?.state || "").toUpperCase();
  const showCorrectionDetails =
    isScalpMode &&
    engine22 &&
    ["W2_ACTIVE_WAIT", "W4_ACTIVE_WAIT", "W3_READY", "W5_READY"].includes(e22State);

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
        {`Primary ${primary} | Intermediate ${intermediate} | Minor ${minor} | ${minutePhase}`}
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
              String(engine22?.status || "").toUpperCase().includes("ENTRY")
                ? "0 0 12px rgba(34,197,94,0.65)"
                : "none",
          }}
        >
          {e22Label}
        </div>
      )}

      {showCorrectionDetails && (
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.35,
            marginBottom: 8,
            color: "#cbd5e1",
            fontWeight: 700,
          }}
        >
        <div>
          {(() => {
            if (e22State === "W2_ACTIVE_WAIT" || e22State === "W4_ACTIVE_WAIT") {
              return "Needs: A low → B bounce";
            }

            if (engine22?.needs) {
              return `Needs: ${formatText(engine22.needs)}`;
            }

             return "Needs: Wait for correction trigger";
           })()}
         </div>

        {wave3RetraceTimeline?.label && (
         <div>{wave3RetraceTimeline.label}</div>
        )}

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

        {wave3RetraceTimeline?.nextFocus && (
          <div>{wave3RetraceTimeline.nextFocus}</div>
        )}
        </div>
      )} 
         
      {isScalpMode && engine22 && !showCorrectionDetails && (
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
