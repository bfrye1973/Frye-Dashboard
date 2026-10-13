import React from "react";

const FS = {
  title: 14,
  small: 12,
  micro: 10,
  tiny: 11,
};

const DEFAULT_DEGREE_ORDER = ["submicro", "micro", "subminute", "minute", "minor", "intermediate", "primary"];

function wavePrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function toneForDegree(degree, state) {
  const direction = String(state?.direction || "").toUpperCase();
  const badge = String(state?.badge || "").toUpperCase();

  if (degree === "micro") return "watch";
  if (direction === "DOWN") return "short";
  if (direction === "UP") return "long";
  if (badge.includes("W5") || badge.includes("W3")) return "long";
  return state?.active === true ? "watch" : "wait";
}

function subtitleForDegree(degree, state) {
  if (state?.subtitle) return state.subtitle;
  if (degree === "micro") return "Immediate timing";
  if (degree === "subminute") return "Immediate wave path";
  if (degree === "minute") return "Tactical wave";
  if (degree === "minor") return "Parent impulse candidate";
  if (degree === "intermediate") return "Higher-timeframe context";
  if (degree === "primary") return "Highest-timeframe context";
  return "Structural context";
}

function Badge({ text, tone = "watch" }) {
  const palette =
    tone === "short"
      ? { color: "#fca5a5", border: "#7f1d1d", background: "#2a0d0d" }
      : tone === "long"
      ? { color: "#86efac", border: "#166534", background: "#071b0d" }
      : tone === "wait"
      ? { color: "#94a3b8", border: "#334155", background: "#0f172a" }
      : { color: "#bfdbfe", border: "#1d4ed8", background: "#0b1736" };

  return (
    <span
      style={{
        color: palette.color,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        borderRadius: 999,
        padding: "3px 7px",
        fontSize: FS.micro,
        fontWeight: 1000,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {text || "CTX"}
    </span>
  );
}

function Engine22Line({ label, value, tone = "default" }) {
  const color =
    tone === "short"
      ? "#fca5a5"
      : tone === "long"
      ? "#86efac"
      : tone === "warning" || tone === "warn" || tone === "watch"
      ? "#fbbf24"
      : tone === "muted"
      ? "#94a3b8"
      : "#e5e7eb";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "68px minmax(0,1fr)",
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

function Engine22TargetGrid({ title, levels }) {
  const rows = Array.isArray(levels)
    ? levels.filter((level) => Number.isFinite(Number(level?.price)))
    : [];

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
        <div
          style={{
            color: "#86efac",
            fontSize: FS.micro,
            fontWeight: 1000,
          }}
        >
          {title}
        </div>

        <Badge text="LEVELS" tone="long" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          gap: 5,
        }}
      >
        {rows.map((level, index) => (
          <div
            key={`${level.label || "level"}-${index}`}
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
              {level.label}
            </div>

            <div
              style={{
                color: "#f8fafc",
                fontSize: FS.small,
                fontWeight: 1000,
                lineHeight: 1.1,
              }}
            >
              {wavePrice(level.price)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RulesBox({ rules }) {
  if (!Array.isArray(rules) || !rules.length) return null;

  return (
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
      <div
        style={{
          color: "#fbbf24",
          fontSize: FS.micro,
          fontWeight: 1000,
        }}
      >
        Structural rules
      </div>

      {rules.map((rule, index) => (
        <Engine22Line
          key={`${index}-${rule}`}
          label={index === 0 ? "Rule" : ""}
          value={rule}
          tone="warn"
        />
      ))}
    </div>
  );
}

function FibTransitionColumn({ title, subtitle, levels, tone = "long" }) {
  const rows = Array.isArray(levels)
    ? levels.filter((item) => Number.isFinite(Number(item?.price)))
    : [];

  const accent =
    tone === "short"
      ? "#f87171"
      : "#86efac";

  const border =
    tone === "short"
      ? "rgba(239,68,68,.34)"
      : "rgba(34,197,94,.34)";

  const background =
    tone === "short"
      ? "rgba(69,10,10,.22)"
      : "rgba(5,46,22,.22)";

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 9,
        padding: 7,
        background,
        minWidth: 0,
      }}
    >
      <div style={{ color: accent, fontSize: 11, fontWeight: 1000 }}>
        {title}
      </div>
      <div style={{ color: "#94a3b8", fontSize: 9, fontWeight: 800, marginTop: 2, marginBottom: 5 }}>
        {subtitle}
      </div>

      <div style={{ display: "grid", gap: 3 }}>
        {rows.map((item) => (
          <div
            key={item.key || `${title}-${item.label}`}
            style={{
              display: "grid",
              gridTemplateColumns: "42px 1fr auto",
              gap: 5,
              alignItems: "center",
              borderTop: "1px solid rgba(148,163,184,.08)",
              paddingTop: 3,
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: 9, fontWeight: 900 }}>
              {item.label || "—"}
            </span>
            <span style={{ color: "#f8fafc", fontSize: 10, fontWeight: 1000 }}>
              {wavePrice(item.price)}
            </span>
            <span
              style={{
                color: item.status === "TOUCHED" ? "#86efac" : "#fbbf24",
                fontSize: 9,
                fontWeight: 1000,
              }}
            >
              {item.status || "WATCH"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MicroTransitionFibPanel({ transition }) {
  if (transition?.available !== true) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(56,189,248,.45)",
        borderRadius: 10,
        padding: 7,
        background: "rgba(8,47,73,.18)",
        display: "grid",
        gap: 6,
      }}
    >
      <div>
        <div style={{ color: "#7dd3fc", fontSize: 11, fontWeight: 1000 }}>
          {transition?.headline || "W2 DOWN + W3 UP — transition confirming"}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 9, fontWeight: 800, marginTop: 2 }}>
          Both Fib maps stay visible while canonical W3 is still developing.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 6,
        }}
      >
        <FibTransitionColumn
          title="W2 DOWN FIBS"
          subtitle={`W2 ${transition?.w2Down?.state || "—"} • low ${wavePrice(transition?.anchors?.w2Low)}`}
          levels={transition?.w2Down?.levels}
          tone="short"
        />
        <FibTransitionColumn
          title="W3 UP FIBS"
          subtitle={`Launch from ${wavePrice(transition?.anchors?.w2Low)} • W1 length ${wavePrice(transition?.anchors?.w1Length)}`}
          levels={transition?.w3Up?.levels}
          tone="long"
        />
      </div>
    </div>
  );
}

function MicroMidlineBanner({ confluence }) {
  if (confluence?.active !== true) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(250,204,21,.70)",
        borderLeft: "4px solid #facc15",
        borderRadius: 9,
        background: "rgba(113,63,18,.22)",
        padding: "7px 8px",
      }}
    >
      <div style={{ color: "#fde047", fontSize: 12, fontWeight: 1000 }}>
        A++ TRADING HAPPENING
      </div>
      <div style={{ color: "#fef3c7", fontSize: 10, fontWeight: 900, marginTop: 2 }}>
        Micro {confluence?.activeWave || "—"} + negotiated midpoint {wavePrice(confluence?.negotiatedZone?.midline)}
        {Number.isFinite(Number(confluence?.distanceToMidline))
          ? ` • distance ${Number(confluence.distanceToMidline).toFixed(2)} pts`
          : ""}
      </div>
      <div style={{ color: "#94a3b8", fontSize: 9, fontWeight: 800, marginTop: 2 }}>
        Confluence quality only — Engine 6 permission still required.
      </div>
    </div>
  );
}

function MicroPositionBanner({ context }) {
  if (!context || context.positionPresent !== true) return null;

  const severity = String(context?.conflictSeverity || "NONE").toUpperCase();
  const conflict = context?.positionConflict === true;
  const critical = severity === "CRITICAL";
  const high = severity === "HIGH";

  const color =
    critical
      ? "#fca5a5"
      : high
      ? "#fdba74"
      : conflict
      ? "#fde68a"
      : "#86efac";

  const border =
    critical
      ? "rgba(239,68,68,.68)"
      : high
      ? "rgba(249,115,22,.62)"
      : conflict
      ? "rgba(251,191,36,.52)"
      : "rgba(34,197,94,.42)";

  const positions = Array.isArray(context?.positions)
    ? context.positions
    : [];

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 9,
        background: conflict ? "rgba(69,10,10,.16)" : "rgba(5,46,22,.16)",
        padding: "7px 8px",
        display: "grid",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ color, fontSize: 11, fontWeight: 1000 }}>
          MICRO POSITION AWARENESS
        </div>
        <Badge
          text={conflict ? `CONFLICT ${severity}` : "ALIGNED"}
          tone={conflict ? "short" : "long"}
        />
      </div>

      {positions.slice(0, 3).map((position, index) => (
        <div
          key={position?.tradeId || index}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 7,
            fontSize: 10,
            fontWeight: 900,
          }}
        >
          <span style={{ color: "#e5e7eb" }}>
            {String(position?.direction || "—").toUpperCase()} × {position?.remainingQty ?? "?"}
            {position?.accountMode ? ` • ${position.accountMode}` : ""}
          </span>
          <span style={{ color }}>
            {position?.microAlignment || "—"}
          </span>
        </div>
      ))}

      <div style={{ color: "#cbd5e1", fontSize: 10, fontWeight: 900 }}>
        Micro posture: {String(context?.tradePosture || "NEUTRAL").replaceAll("_", " ")}
      </div>

      {context?.doNotAddAgainstImpulse === true ? (
        <div style={{ color: "#fca5a5", fontSize: 11, fontWeight: 1000 }}>
          DO NOT ADD AGAINST THE EMERGING MICRO IMPULSE
        </div>
      ) : null}
    </div>
  );
}

// Read-only SUBMICRO display; no canonical wave state or trading changes.
function submicroW4Display(shadow, transition) {
  if (shadow?.available !== true || shadow?.w3OneToOne?.touched !== true ||
      shadow?.w4DownCandidate !== true || transition?.available !== true ||
      shadow?.w3OneToOne?.countId !== transition?.sourceCountId) return null;
  const peak = Number(shadow?.w4CandidateEvidence?.peakHigh);
  const origin = Number(transition?.anchors?.w2Low);
  if (!Number.isFinite(peak) || !Number.isFinite(origin) || peak <= origin) return null;
  // Only completed-candle lows published for this same W3/W4 observation
  // may mark a retracement touched. A price rebound cannot erase the touch.
  const evidence = shadow?.w4CandidateEvidence;
  const completedLow = evidence?.minimumPostPeakLow;
  const hasVerifiedLow = evidence?.sourceCountId === transition?.sourceCountId &&
    typeof completedLow === "number" && Number.isFinite(completedLow);
  return {peak, fibs: [0.236, 0.382, 0.5, 0.618, 0.786].map(ratio => {
    const price = Math.round((peak - (peak - origin) * ratio) * 4) / 4;
    return {
      key: "w4-" + ratio, label: ratio.toFixed(3), price,
      status: hasVerifiedLow && completedLow <= price ? "TOUCHED" : "WATCH",
    };
  })};
}

function Engine22DegreeCard({
  degree,
  state,
  wavelength,
  microW2W3TransitionFibs = null,
  microMidlineConfluence = null,
  microPositionContext = null,
  microW3TouchW4Shadow = null,
  legacyMicroWidgets = false,
  waveDegreeOverride = undefined,
  v3Shadow = null,
}) {
  const ownerW2Correction = degree === "submicro" &&
    v3Shadow?.ownerCorrectionState === "SUBMICRO_W2_OWNER_CORRECTED";
  const active = state?.active === true;
  const tone = toneForDegree(degree, state);
  const waveDegree = waveDegreeOverride !== undefined ? waveDegreeOverride : wavelength?.degrees?.[degree] || null;
  // The old W3/W4 operational hypothesis is superseded on this card by the
  // owner correction. Do not edit the legacy structural source or trading inputs.
  const w4 = legacyMicroWidgets && !ownerW2Correction
    ? submicroW4Display(microW3TouchW4Shadow, microW2W3TransitionFibs) : null;
  const fibLevels = Array.isArray(waveDegree?.levels) ? waveDegree.levels : [];

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 1000,
              fontSize: FS.small,
              color: "#e5e7eb",
            }}
          >
            {String(state?.label || degree || "").toUpperCase()}
          </div>

          <div
            style={{
              fontWeight: 900,
              fontSize: FS.micro,
              color: "#9ca3af",
            }}
          >
            {subtitleForDegree(degree, state)}
          </div>
        </div>

        <Badge text={state?.badge || "CTX"} tone={tone} />
      </div>

      <div
        style={{
          fontWeight: 1000,
          fontSize: FS.small,
          color:
            tone === "short"
              ? "#fca5a5"
              : active
              ? "#bfdbfe"
              : "#9ca3af",
          lineHeight: 1.15,
        }}
      >
        {w4 ? "W4 DOWN — CURRENT DEVELOPING (UNCONFIRMED)" : state?.headline || `${String(degree || "").toUpperCase()} structure not published.`}
      </div>

      {w4 ? <Engine22Line label="Wave" value="W4 DOWN — DEVELOPING" tone="short" /> : null}
      {(state?.rows || []).filter(item => !w4 || !/^(wave|state|status)$/i.test(String(item.label || ""))).map((item, index) => (
        <Engine22Line
          key={`${item.label || "row"}-${index}`}
          label={item.label}
          value={item.value}
          tone={item.tone || "default"}
        />
      ))}

      {v3Shadow?.shadowOnly === true ? (
        <div style={{border:"1px solid #475569",borderRadius:8,padding:7,display:"grid",gap:4,background:"#101823"}}>
          <div style={{fontSize:11,color:"#c4b5fd",fontWeight:1000}}>
            V3 SHADOW — {String(v3Shadow.dataStatus || "EVIDENCE_PENDING").replaceAll("_"," ")}
          </div>
          <Engine22Line label="Wave" value={ownerW2Correction ? "W2 DOWN — DEVELOPING" : v3Shadow.activeWave || "UNCONFIRMED"} tone={ownerW2Correction ? "short" : "watch"} />
          {ownerW2Correction ? (
            <>
              <Engine22Line label="W1 High" value={Number(v3Shadow.ownerW1High?.price).toFixed(2)} />
              <Engine22Line label="W1 High Time" value={v3Shadow.ownerW1High?.time || "PENDING"} />
              <Engine22Line label="W1 Low" value={wavePrice(v3Shadow.ownerW1Low?.price)} />
            </>
          ) : null}
          <Engine22Line label="Lifecycle" value={v3Shadow.lifecycle || "EVIDENCE_PENDING"} tone="watch" />
          <Engine22Line label="Candle" value={v3Shadow.sourceTimeframe || "—"} />
          <Engine22Line label="Swing nodes" value={`${v3Shadow.swingHighCount ?? 0} HIGH / ${v3Shadow.swingLowCount ?? 0} LOW`} />
          {v3Shadow.waveCandidate ? <Engine22Line label="Candidate" value={`${v3Shadow.waveCandidate.activeWave || "—"} ${v3Shadow.waveCandidate.side || ""} — UNCONFIRMED`} tone="warning" /> : null}
          {v3Shadow.fibonacci?.available === true ? (
            <>
              <div style={{fontSize:10,color:"#bfdbfe",fontWeight:900}}>
                {v3Shadow.fibonacci.modelType} — {v3Shadow.fibonacci.provisional ? "PROVISIONAL" : "SHADOW ONLY"}
              </div>
              {v3Shadow.fibonacci.anchorOnly === true ? (
                <div style={{fontSize:10,color:"#fbbf24"}}>
                  OWNER ANCHORS ONLY — CANDLE TOUCHES UNVERIFIED
                </div>
              ) : null}
              {(v3Shadow.levels || []).map(fib => (
                <Engine22Line key={fib.key} label={fib.key}
                  value={`${Number(fib.price).toFixed(2)} — ${fib.status}`}
                  tone={fib.status === "TOUCHED" ? "long" : "watch"} />
              ))}
            </>
          ) : (
            <div style={{fontSize:10,color:"#fbbf24"}}>
              {ownerW2Correction
                ? "W2 RETRACEMENT LEVELS PENDING — VALID W1 LOW REQUIRED"
                : v3Shadow.dataStatus === "PROVISIONAL_NODE_EVIDENCE"
                ? "PIVOT EVIDENCE ONLY — VERIFIED FIB HISTORY PENDING"
                : v3Shadow.dataStatus === "INSUFFICIENT_HISTORY"
                ? "INSUFFICIENT VALIDATED HISTORY"
                : (v3Shadow.fibonacci?.reasonCodes || v3Shadow.reasonCodes || ["EVIDENCE_PENDING"])[0]}
            </div>
          )}
          <div style={{fontSize:9,color:"#94a3b8"}}>
            Independent V3 observation only. No approved anchor, official Fib, or trading permission changed.
          </div>
        </div>
      ) : null}

      {legacyMicroWidgets && !ownerW2Correction ? (
        <>
          <MicroMidlineBanner confluence={microMidlineConfluence} />
          <MicroPositionBanner context={microPositionContext} />
          {!w4 ? <MicroTransitionFibPanel
            transition={microW2W3TransitionFibs?.available === true &&
              microW3TouchW4Shadow?.available === true &&
              microW3TouchW4Shadow?.w3OneToOne?.touched === true &&
              microW3TouchW4Shadow?.w3OneToOne?.countId === microW2W3TransitionFibs?.sourceCountId
                ? {...microW2W3TransitionFibs,
                    w3Up:{...microW2W3TransitionFibs.w3Up,
                      levels:microW2W3TransitionFibs.w3Up.levels.map(level=>
                        level.key === "e1000" ? {...level,status:"TOUCHED"} : level)}}
                : microW2W3TransitionFibs}
          /> : null}
          {microW3TouchW4Shadow?.available === true &&
           microW3TouchW4Shadow?.w3OneToOne?.touched === true ? (
            <div style={{fontSize:11,color:"#bfdbfe",fontWeight:900}}>
              W3 1.000 VERIFIED TOUCH • {microW3TouchW4Shadow.w3OneToOne.target}
              {microW3TouchW4Shadow.w4DownCandidate === true
                ? " • W4 DOWN CURRENT (DEVELOPING, NOT CONFIRMED)"
                : " • W4 TRANSITION NOT CONFIRMED"}
            </div>
          ) : null}
        </>
      ) : null}

      {w4 ? (
        <div style={{border:"1px solid #7f1d1d",borderRadius:9,padding:7,background:"#1b1013",display:"grid",gap:5}}>
          <div style={{color:"#fca5a5",fontSize:11,fontWeight:1000}}>CURRENT W4 DOWN FIB RETRACEMENTS — WATCH ONLY</div>
          <Engine22Line label="W3 peak" value={wavePrice(w4.peak)} />
          <Engine22Line label="W2 origin" value={wavePrice(microW2W3TransitionFibs?.anchors?.w2Low)} />
          {w4.fibs.map(fib => <Engine22Line key={fib.key} label={fib.label} value={wavePrice(fib.price) + " — " + fib.status} tone={fib.status === "TOUCHED" ? "long" : "warning"} />)}
          <div style={{fontSize:9,color:"#94a3b8"}}>Observational W4 developing display; no confirmed W4 anchor or trading permission.</div>
        </div>
      ) : null}

      <Engine22TargetGrid
        title={`${String(state?.label || degree || "").toUpperCase()} levels`}
        levels={state?.levels}
      />

      {waveDegree && !w4 && !ownerW2Correction ? (
        <div style={{border: "1px solid #344156", borderRadius: 8, padding: 6, display: "grid", gap: 4}}>
          <div style={{color: "#bfdbfe", fontWeight: 900, fontSize: 11}}>FIB EXTENSIONS — {waveDegree.activeWave || "—"}</div>
          <Engine22Line label="State" value={waveDegree.state} tone="watch" />
          <Engine22Line label="Confirm" value={waveDegree.confirmationStatus} tone="watch" />
          {fibLevels.map((fib) => (
            <Engine22Line key={fib.key} label={fib.label} value={`${fib.price == null ? "ANCHOR PENDING" : Number(fib.price).toFixed(2)} — ${fib.status}`} tone={fib.status === "TOUCHED" ? "long" : "watch"} />
          ))}
          {waveDegree.fibAnchorStatus ? <Engine22Line label="Anchor" value="W1 MARKS PENDING" tone="warning" /> : null}
          {waveDegree.nextLevel ? <Engine22Line label="Next" value={`${waveDegree.nextLevel.label} @ ${waveDegree.nextLevel.price}`} /> : null}
        </div>
      ) : null}
      <RulesBox rules={state?.rules} />
    </div>
  );
}

export default function Engine22MarketStructureCard({
  engine22V3Projection = null,
  engine22Display,
  currentWavelength = null,
  microW2W3TransitionFibs = null,
  microMidlineConfluence = null,
  microPositionContext = null,
  microW3TouchW4Shadow = null,
}) {
  if (
    !engine22Display ||
    engine22Display.version !== "engine22Display.v1" ||
    !engine22Display.degrees
  ) {
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
        Engine 22 structure not published.
      </div>
    );
  }

  const publishedDegreeOrder =
    Array.isArray(engine22Display.degreeOrder) && engine22Display.degreeOrder.length
      ? engine22Display.degreeOrder
      : DEFAULT_DEGREE_ORDER;
  // Seven distinct degree cards. SUBMICRO tracks the internal ABC context
  // inside MICRO W2; never borrow the legacy Micro timing/Fib widgets for it.
  const degreeOrder = ["submicro", ...publishedDegreeOrder.filter(degree => degree !== "submicro")];
  const columnCount = Math.max(1, degreeOrder.length);
  const v3ShadowDegrees = engine22V3Projection?.available === true &&
    engine22V3Projection?.shadowOnly === true &&
    engine22V3Projection?.v3LiveShadow?.shadowOnly === true
      ? engine22V3Projection.v3LiveShadow.degrees : null;

  const ownerMicro = v3ShadowDegrees?.micro;
  const ownerSubmicro = v3ShadowDegrees?.intraday_submicro;
  const ownerSubminute = v3ShadowDegrees?.subminute;
  const submicroABC = ownerSubmicro?.ownerCorrectionState === "SUBMICRO_ABC_INSIDE_MICRO_W2";
  const microW2 = ownerMicro?.ownerCorrectionState === "MICRO_W2_OWNER_RECOUNT";
  const subminuteW3 = ownerSubminute?.ownerCorrectionState === "SUBMINUTE_W3_OWNER_CONTEXT";
  const submicroState = {
    degree:"submicro",label:"Submicro",subtitle:"Internal correction within MICRO W2",
    active:true,badge:"ABC DOWN",headline:"A–B–C DOWN — INSIDE MICRO W2 (SHADOW)",
    rows:[
      {label:"Parent",value:"MICRO W2"},
      {label:"Internal path",value:"A → B → C — LEG UNCONFIRMED"},
      {label:"Role",value:"Watch for possible MICRO W2 completion"},
      {label:"Confirmation",value:"MICRO structural confirmation still required"},
    ],levels:[],rules:[],
  };
  const microW2State = {
    degree:"micro",label:"Micro",subtitle:"Independent MICRO corrective structure",
    active:true,badge:"W2 DOWN",headline:"W2 DOWN — DEVELOPING (OWNER SHADOW)",
    rows:[
      {label:"W1 Low",value:"7677.25"},
      {label:"W1 Low Time",value:"2026-10-01 08:30"},
      {label:"W1 High",value:String(ownerMicro?.ownerW1HighPrice ?? "PENDING")},
      {label:"W1 High Time",value:"UNVERIFIED — PRICE ONLY"},
      {label:"Current",value:"W2 CORRECTIVE RETRACEMENT"},
    ],levels:[],rules:[],
  };
  const subminuteW3State = {
    degree:"subminute",label:"Subminute",subtitle:"Owner's larger-degree W3 context",
    active:true,badge:"W3 WATCH",headline:"W3 DEVELOPING — OWNER SHADOW (UNCONFIRMED)",
    rows:[
      {label:"Wave",value:"W3 — OWNER CONTEXT"},
      {label:"W2 Bottom",value:"~7700 (APPROXIMATE)"},
      {label:"Source",value:"AWAITING VERIFIED STRUCTURAL HISTORY"},
    ],levels:[],rules:[],
  };
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
        <div
          style={{
            fontWeight: 1000,
            fontSize: FS.title,
            color: "#e5e7eb",
          }}
        >
          Engine 22 Wave Degrees
        </div>

        <div
          style={{
            color: "#9ca3af",
            fontSize: FS.tiny,
            fontWeight: 900,
          }}
        >
          Structural display only — no execution permission
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columnCount}, minmax(180px,1fr))`,
          overflowX: "auto",
          gap: 8,
        }}
      >
        {degreeOrder.map((degree) => (
          <Engine22DegreeCard
            key={degree}
            degree={degree}
            state={degree === "submicro" && submicroABC ? submicroState :
              degree === "micro" && microW2 ? microW2State :
              degree === "subminute" && subminuteW3 ? subminuteW3State :
              engine22Display.degrees?.[degree] || {
                degree,label:degree,active:false,
                headline:`${String(degree).toUpperCase()} structure not published.`,
                rows:[],levels:[],rules:[],
              }}
            v3Shadow={degree === "submicro" ? ownerSubmicro :
              degree === "micro" ? ownerMicro :
              degree === "subminute" ? ownerSubminute :
              v3ShadowDegrees?.[degree] || null}
            wavelength={currentWavelength}
            waveDegreeOverride={["submicro","micro","subminute"].includes(degree) ? null : undefined}
            legacyMicroWidgets={degree === "micro" && !microW2}
            microW2W3TransitionFibs={microW2W3TransitionFibs}
            microMidlineConfluence={microMidlineConfluence}
            microPositionContext={microPositionContext}
            microW3TouchW4Shadow={degree === "micro" && !microW2 ? microW3TouchW4Shadow : null}
          />
        ))}
      </div>
    </div>
  );
}
