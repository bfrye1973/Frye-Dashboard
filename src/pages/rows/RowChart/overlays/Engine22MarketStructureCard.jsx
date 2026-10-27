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
        {rows.map((level, index) => {
          // Owner-only Micro/Subminute projections have explicit WATCH status.
          // Never color those cards as a confirmed green touch by default.
          const ownerObserved = level.status === "OWNER_OBSERVED_TOUCH" &&
            level.touchEvidenceType === "OWNER_CHART_OBSERVATION";
          const observedTouch = level.status === "TOUCHED" &&
            level.touchEvidenceAvailable === true &&
            typeof level.touchEvidenceType === "string";
          const verified = level.status === "TOUCHED" &&
            level.touchEvidence?.verified === true;
          const pending = !ownerObserved && !observedTouch && !verified;
          const color = pending ? "#fbbf24" : "#86efac";
          return (
            <div
              key={`${level.key || level.label || "level"}-${index}`}
              style={{
                border: pending ? "1px solid rgba(245,158,11,.45)" : "1px solid rgba(34,197,94,.35)",
                borderRadius: 8,
                background: pending ? "#19150b" : "#081509",
                padding: "5px 6px",
                minWidth: 0,
              }}
            >
              <div style={{color,fontSize:11,fontWeight:1000,lineHeight:1}}>
                {level.label}
              </div>
              <div style={{color:"#f8fafc",fontSize:FS.small,fontWeight:1000,lineHeight:1.1}}>
                {wavePrice(level.price)}
              </div>
              {pending ? <div style={{color,fontSize:FS.tiny,fontWeight:900}}>WATCH</div> : null}
              {ownerObserved ? <div style={{color,fontSize:FS.tiny,fontWeight:900}}>TOUCHED · OWNER CHART</div> : null}
              {observedTouch ? <div style={{color,fontSize:FS.tiny,fontWeight:900}}>{level.touchEvidenceType === "ES_CURRENT_SNAPSHOT_AT_OR_ABOVE_LEVEL" || level.touchEvidenceType === "ES_CURRENT_PRICE" ? "REACHED · ES SNAPSHOT" : "TOUCHED · ES PRICE"}</div> : null}
              {verified ? <div style={{color,fontSize:FS.tiny,fontWeight:900}}>TOUCHED · VERIFIED</div> : null}
            </div>
          );
        })}
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

// Unified, read-only risk strip for all seven degrees.
// Warning is separate from a wave-count boundary and from trade permission.
function Engine22WaveRiskStrip({degree,wavelength,protection,invalidations}) {
  const higher=degree==="intermediate"||degree==="primary";
  const minute=degree==="minute";
  const minor=degree==="minor";
  const ownerMinute=wavelength?.degrees?.minute?.ownerMinuteW2Retracement;
  const ownerMinor=wavelength?.degrees?.minor?.ownerW5StructuralReference;
  const higherRead=protection?.degrees?.[degree] || null;
  const readiness=invalidations?.degrees?.[degree]?.invalidationReadiness || null;
  const ownerBoundary=minute && ownerMinute?.version==="engine22.minuteW2RetracementOwner.v1"
    ? ownerMinute.structuralReference
    : minor && ownerMinor?.version==="engine22.minorW5StructuralReference.v1"
    ? ownerMinor.price : null;
  const higherBoundary=higherRead?.structuralReference;
  const structural=Number.isFinite(ownerBoundary) && ownerBoundary>0 ? ownerBoundary
    : higher && Number.isFinite(higherBoundary) && higherBoundary>0 ? higherBoundary : null;
  const review=readiness?.candidateZone;
  const reviewPrice=review && Number.isFinite(review.low) && Number.isFinite(review.high)
    ? review.low===review.high ? wavePrice(review.low) : wavePrice(review.low)+"–"+wavePrice(review.high)
    : null;
  const subminuteD=degree==="subminute" && wavelength?.degrees?.subminute?.ownerCurrentDUp?.version==="engine22.subminuteDUpOwnerWorking.v1";
  const lowerC=["submicro","micro"].includes(degree) || (degree==="subminute" && !subminuteD);
  const lowerB=lowerC && review && Number.isFinite(review.low) && review.low>0 &&
    review.low===review.high ? review.low : null;
  const status=higher ? (higherRead?.status || "UNCONFIRMED")
    : structural ? "OWNER REFERENCE" : lowerB!==null ? "C DOWN RECOUNT" : "UNCONFIRMED";
  const stateTone=["HIGH_BEARISH_RISK","MAJOR_BEARISH_RISK"].includes(status)?"#f87171"
    : ["WARNING","BEARISH_RISK_CONFIRMED"].includes(status)?"#fbbf24"
    : status==="BULLISH_STRUCTURE_ABOVE_WARNING"?"#86efac":"#94a3b8";
  const primary=degree==="primary";
  const referenceText=structural!==null?wavePrice(structural):
    lowerB!==null?wavePrice(lowerB):"NOT PUBLISHED";
  const referenceBasis=minute?"W1 origin • W2 count":minor?"W4 origin • W5 review"
    :higher?(primary?"Primary W4 low":"Intermediate W2 low")
    :lowerB!==null?"C down • B-high recount":subminuteD?"D UP • no approved invalidation":"No approved hard invalidation";
  const warningValue=higher?"7200.00":"NOT SET";
  const warningDetail=higher?(primary?"Daily close below":"4H close below"):"No early-warning rule approved";
  const last=higherRead?.latestCompletedClose;
  const evidence=higher
    ? (higherRead?.sourceFresh && Number.isFinite(last)
      ? (primary?"Daily":"4H")+" close "+wavePrice(last)+" • 2 closes confirm • deep risk 6800"
      : "Completed-candle evidence unavailable • deep risk 6800")
    : minute?"Below W1 origin breaches current Minute W2 count"
    :minor?"Below W4 origin requires W5 recount review"
    :subminuteD?"D UP working • monitor 7865–7875 completion watch, not confirmed"
    :lowerB!==null?"Above B high requires current C-down recount • not parent invalidation"
    :reviewPrice?"Recount review "+reviewPrice+" • not a hard invalidation"
    :"No current structural rule approved";
  return (
    <div style={{border:"1px solid #344156",borderRadius:8,padding:7,background:"#0b1420",display:"grid",gap:5}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4,flexWrap:"wrap"}}>
        <strong style={{fontSize:10,color:"#e2e8f0"}}>INVALIDATION ZONES - WAVE RISK / PROTECTION</strong>
        <span style={{fontSize:9,color:stateTone,fontWeight:900}}>{status.replaceAll("_"," ")}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:5}}>
        <div style={{padding:6,borderRadius:6,background:"#19150b",border:"1px solid rgba(245,158,11,.45)",minWidth:0}}>
          <div style={{fontSize:9,fontWeight:900,color:"#fbbf24"}}>EARLY WARNING</div>
          <div style={{fontSize:14,fontWeight:1000,color:"#fde68a"}}>{warningValue}</div>
          <div style={{fontSize:9,color:"#cbd5e1"}}>{warningDetail}</div>
        </div>
        <div style={{padding:6,borderRadius:6,background:"#1b1013",border:"1px solid #7f1d1d",minWidth:0}}>
          <div style={{fontSize:9,fontWeight:900,color:"#fca5a5"}}>{lowerB!==null?"C-DOWN INVALIDATION REVIEW":"STRUCTURAL REFERENCE"}</div>
          <div style={{fontSize:14,fontWeight:1000,color:"#fecaca"}}>{referenceText}</div>
          <div style={{fontSize:9,color:"#cbd5e1"}}>{referenceBasis}</div>
        </div>
      </div>
      <div style={{fontSize:9,color:"#94a3b8"}}>{evidence}</div>
      <div style={{fontSize:9,color:"#64748b"}}>Read only • Not a trade stop or permission</div>
    </div>
  );
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
  higherDegreeBearishProtection = null,
  sevenDegreeInvalidations = null,
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
                  value={`${Number(fib.price).toFixed(2)} — ${fib.ownerReportedTouch ? "OWNER TOUCH (UNVERIFIED)" : fib.status}`}
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
        title={degree==="minute"?"MINUTE W2 RETRACEMENT FIB LEVELS":
          `${String(state?.label || degree || "").toUpperCase()} levels`}
        levels={degree==="minor" && waveDegree?.state==="MINOR_W5_ACTIVE_CANDIDATE" ? fibLevels : state?.levels}
      />
      {waveDegree && degree!=="minor" && !w4 && !ownerW2Correction ? (
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
      <Engine22WaveRiskStrip degree={degree} wavelength={wavelength}
        protection={higherDegreeBearishProtection} invalidations={sevenDegreeInvalidations} />
      {degree!=="minute" && degree!=="minor" ? <RulesBox rules={state?.rules} /> : null}
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
  higherDegreeBearishProtection = null,
  sevenDegreeInvalidations = null,
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
  // Owner-directed current count, presentation only. The previous V3 shadow
  // remains unconfirmed in the backend and never supplies execution authority.
  // Owner-directed new Submicro cycle (Oct 15). Prior C ended at 7718.00,
  // while the new five-wave move is assessed as Submicro W1 near 8000.
  // Do not fabricate an exact W1 high or W2 Fib geometry without its pivot.
  // This presentation is not a canonical candle-confirmed count.
  // Engine 22's owner-locked Submicro W1 pivot and W2 retracement map.
  // No Fibonacci computation or touch inference in the frontend.
  const submicroW2 = currentWavelength?.degrees?.submicro?.ownerSubmicroW2;
  const submicroW2Levels =
    submicroW2?.version === "engine22.submicroW2OwnerProjection.v1" &&
    Array.isArray(submicroW2.levels)
      ? submicroW2.levels : [];
  const minuteW2Hypothesis =
    currentWavelength?.degrees?.minute?.ownerMinuteW2Hypothesis;
  const parentMinuteW2 = minuteW2Hypothesis?.version ===
    "engine22.minuteW2ComplexCorrectionWatch.v1";
  const parentReviewRow = degree => parentMinuteW2 &&
    minuteW2Hypothesis?.childDegreeContext?.[degree]?.noReset === true
      ? [{label:"Minute Parent",value:"W2 COMPLEX CORRECTION CANDIDATE — LOWER-WAVE RECOUNT PENDING; HISTORY PRESERVED"}]
      : [];
  const microW3Owner = currentWavelength?.degrees?.micro?.ownerMicroW3Up;
  const microW3OwnerActive =
    microW3Owner?.version === "engine22.microW3UpOct27Owner.v1" &&
    microW3Owner?.activeWave === "W3" &&
    microW3Owner?.parentWave === "D" &&
    microW3Owner?.stage === "DEVELOPING_CANDIDATE" &&
    currentWavelength?.degrees?.subminute?.ownerCurrentDUp?.version ===
      "engine22.subminuteDUpOwnerWorking.v1";
  const microW3OwnerState = microW3OwnerActive ? {
    degree:"micro",label:"Micro",
    subtitle:"Bullish Micro structure developing inside Subminute D UP",
    active:true,badge:"W3 UP CANDIDATE",
    headline:"MICRO W3 UP — DEVELOPING / UNCONFIRMED",
    rows:[
      {label:"Parent",value:"SUBMINUTE D UP — DEVELOPING / MINUTE W2 NOT COMPLETE"},
      {label:"W1 low",value:wavePrice(microW3Owner.wave1?.low)},
      {label:"W1 low time",value:"OCT 25 2026, 3:00 PM AZ — OWNER REFERENCE"},
      {label:"W1 high",value:"EXACT PRICE PENDING — CHART MARKED"},
      {label:"W1 high time",value:"OCT 26 2026, 8:00 AM AZ — OWNER REFERENCE"},
      {label:"W2 low",value:wavePrice(microW3Owner.wave2?.low)},
      {label:"W2 low time",value:"OCT 27 2026, 1:00 AM AZ — OWNER REFERENCE"},
      {label:"Current",value:"W3 UP — OWNER WORKING CANDIDATE / NOT CONFIRMED"},
      {label:"Fibonacci",value:"W3 EXTENSIONS PENDING EXACT W1 HIGH"},
      {label:"History",value:"OLDER MICRO C DOWN COUNT AND FIB TOUCHES PRESERVED"},
    ],
    levels:[],rules:[],
  } : null;
  const microCDown = currentWavelength?.degrees?.micro?.ownerMicroCDown;
  const microCDownActive = microCDown?.version === "engine22.microCDownOwnerWatch.v1";
  const microCDownState = microCDownActive ? {
    degree:"micro",label:"Micro",
    subtitle:"Current corrective subdivision of Subminute C DOWN",
    active:true,badge:"C DOWN WATCH",
    headline:"MICRO C DOWN — DEVELOPING / ABCDE WATCH",
    rows:[
      {label:"Parent",value:"SUBMINUTE C DOWN / MINUTE W2 CORRECTION"},
      {label:"A high",value:wavePrice(microCDown.waveA.high)},
      {label:"A low",value:wavePrice(microCDown.waveA.low)},
      {label:"A low time",value:microCDown.waveA.lowLocalTime},
      {label:"B high",value:wavePrice(microCDown.waveB.high)},
      {label:"B high time",value:microCDown.waveB.highLocalTime},
      {label:"Current",value:"C DOWN DEVELOPING — NOT CONFIRMED COMPLETE"},
      {label:"Pattern",value:"ABC / ABCDE CORRECTIVE ALTERNATIVE — UNCONFIRMED"},
      {label:"Next",value:"D / E ONLY IF CORRECTIVE STRUCTURE CONFIRMS; NOT STARTED"},
      {label:"History",value:"OLDER MICRO B DOWN AND C UP MODELS RETAINED"},
    ],
    levels:microCDown.levels,rules:[],
  } : null;
  const microBDown = currentWavelength?.degrees?.micro?.ownerMicroBDown;
  const submicroCDown = currentWavelength?.degrees?.submicro?.ownerSubmicroCDown;
  const submicroCActive = submicroCDown?.version === "engine22.submicroCDownOwnerWatch.v1";
  const submicroCState = submicroCActive ? {
    degree:"submicro",label:"Submicro",active:true,badge:"C DOWN WATCH",
    subtitle:"Fast corrective C leg inside Micro C DOWN",
    headline:"SUBMICRO C DOWN — DEVELOPING / ABCDE WATCH",
    rows:[
      {label:"Parent",value:"MICRO C DOWN — SUBMINUTE C DOWN"},
      {label:"A high",value:wavePrice(submicroCDown.waveA.high)},
      {label:"A time",value:submicroCDown.waveA.highLocalTime},
      {label:"A low",value:wavePrice(submicroCDown.waveA.low)},
      {label:"A low time",value:submicroCDown.waveA.lowLocalTime},
      {label:"B high",value:wavePrice(submicroCDown.waveB.high)},
      {label:"B time",value:submicroCDown.waveB.highLocalTime},
      {label:"Current",value:"C DOWN DEVELOPING — COMPLETION NOT CONFIRMED"},
      {label:"Pattern",value:"ABC / ABCDE ALTERNATIVE — UNCONFIRMED"},
      {label:"History",value:"OLDER SUBMICRO A DOWN / C UP LEVELS PRESERVED"},
    ],
    levels:submicroCDown.levels,rules:[],
  } : null;
  const submicroADown = currentWavelength?.degrees?.submicro?.ownerSubmicroADown;
  const microBActive = microBDown?.version === "engine22.microBDownOwnerWatch.v1";
  const submicroAActive = submicroADown?.version === "engine22.submicroADownOwnerWatch.v1";
  const microBState = microBActive ? {
    degree:"micro",label:"Micro",active:true,badge:"B DOWN WATCH",
    subtitle:"Micro ABC inside Minute D — owner working count",
    headline:"MICRO A COMPLETED — B DOWN DEVELOPING",
    rows:[
      {label:"A low",value:wavePrice(microBDown.waveA.low)},
      {label:"A high",value:wavePrice(microBDown.waveA.high)},
      {label:"A high time",value:microBDown.waveA.highLocalTime},
      {label:"Current",value:"B DOWN — DEVELOPING / NOT STRUCTURALLY CONFIRMED"},
      {label:"Historical",value:"OLDER MICRO C UP LEVELS RETAINED IN BACKEND"},
    ],
    levels:microBDown.levels,rules:[],
  } : null;
  const submicroAState = submicroAActive ? {
    degree:"submicro",label:"Submicro",active:true,badge:"A DOWN WATCH",
    subtitle:"Immediate correction inside Micro B",
    headline:"SUBMICRO A DOWN — DEVELOPING / WATCH",
    rows:[
      {label:"Parent",value:"MICRO B DOWN"},
      {label:"Origin high",value:wavePrice(submicroADown.originHigh)},
      {label:"Reference low",value:wavePrice(submicroADown.referenceLow)},
      {label:"Basis",value:"PROVISIONAL DOWNSIDE RETRACEMENT REFERENCES"},
      {label:"Completion",value:"NOT CONFIRMED"},
      {label:"Historical",value:"OLDER SUBMICRO C UP LEVELS RETAINED"},
    ],
    levels:submicroADown.levels,rules:[],
  } : null;
  const submicroAbc = currentWavelength?.degrees?.submicro?.ownerSubmicroAbc;
  const submicroAbcActive = parentMinuteW2 &&
    submicroAbc?.version === "engine22.submicroAbcMicroC.v1";
  const submicroAbcState = submicroAbcActive ? {
    degree:"submicro",label:"Submicro",
    subtitle:"ABC UP nested within Micro C UP",
    active:true,badge:"C UP WATCH",
    headline:"SUBMICRO C UP — DEVELOPING (OWNER WORKING COUNT)",
    rows:[
      {label:"Parent",value:"MICRO C UP — INSIDE MINUTE D UP"},
      {label:"A start",value:wavePrice(submicroAbc.waveA.startPrice)},
      {label:"A high",value:wavePrice(submicroAbc.waveA.high)},
      {label:"A time",value:submicroAbc.waveA.highLocalTime},
      {label:"B low",value:wavePrice(submicroAbc.waveB.low)},
      {label:"B time",value:submicroAbc.waveB.lowLocalTime},
      {label:"Current",value:"C UP DEVELOPING — COMPLETION NOT CONFIRMED"},
      {label:"History",value:"OLDER SUBMICRO W2 MODEL PRESERVED — NOT CURRENT COUNT"},
    ],
    levels:submicroAbc.levels,rules:[],
  } : null;
  const submicroState = {
    degree:"submicro",label:"Submicro",subtitle:"Owner-locked W1 / W2 retracement watch",
    active:true,badge:parentMinuteW2 ? "TIMING WATCH" : "W2 DOWN WATCH",
    headline:parentMinuteW2
      ? "SUBMICRO — IMMEDIATE WAVES INSIDE MINUTE W2"
      : "SUBMICRO W1 COMPLETE — W2 RETRACEMENT WATCH",
    rows:[
      {label:"Prior Wave C",value:"COMPLETED AT 7718.00 — OWNER COUNT"},
      {label:"W1 Low",value:wavePrice(submicroW2?.anchors?.w1Low)},
      {label:"W1 High",value:wavePrice(submicroW2?.anchors?.w1High)},
      {label:"W1",value:"COMPLETE — OWNER WORKING COUNT"},
      {label:"Current",value:parentMinuteW2 ? "IMMEDIATE WAVE TURN WATCH; OLD W2 COUNT PRESERVED" : "W2 DOWN — WATCH"},
      ...parentReviewRow("submicro"),
      {label:"W2 observed low",value:"7772.50 — OWNER CHART"},
      {label:"Touches",value:"0.236 CROSSED ON OWNER CHART; LIVE VERIFICATION PENDING"},
    ],
    levels:submicroW2Levels,rules:[],
  };
  // Read corrected owner projection directly from the Engine 22 backend.
  // Display-only: all levels WATCH until a separately verified touch contract exists.
  const microW3 = currentWavelength?.degrees?.micro?.ownerMicroW3;
  const microW3Levels = microW3?.version === "engine22.microW3OwnerProjection.v1" &&
    Array.isArray(microW3?.levels)
    ? microW3.levels
    : [];
  const microAbc = currentWavelength?.degrees?.micro?.ownerMicroAbc;
  const microAbcActive = parentMinuteW2 &&
    microAbc?.version === "engine22.microAbcMinuteD.v1";
  const microAbcState = microAbcActive ? {
    degree:"micro",label:"Micro",
    subtitle:"Internal ABC UP inside Minute D",
    active:true,badge:"C UP WATCH",
    headline:"MICRO C UP — DEVELOPING (OWNER WORKING COUNT)",
    rows:[
      {label:"Parent",value:"MINUTE W2 INTERNAL D UP"},
      {label:"A start",value:wavePrice(microAbc.waveA.startPrice)},
      {label:"A high",value:wavePrice(microAbc.waveA.high)},
      {label:"A time",value:microAbc.waveA.highLocalTime},
      {label:"B low",value:wavePrice(microAbc.waveB.low)},
      {label:"B time",value:microAbc.waveB.lowLocalTime},
      {label:"Current",value:"MICRO C UP — DEVELOPING / NOT CONFIRMED"},
      {label:"History",value:"OLDER MICRO W3 MODEL PRESERVED — NOT CURRENT COUNT"},
      ...parentReviewRow("micro"),
    ],
    levels:microAbc.levels,rules:[],
  } : null;
  const microW3State = {
    degree:"micro",label:"Micro",subtitle:parentMinuteW2 ? "Smaller subdivisions of Subminute corrective swings" : "Owner-locked W3 projection",
    active:true,
    badge:parentMinuteW2 ? "RECOUNT WATCH" : "W3 UP WATCH",
    headline:parentMinuteW2
      ? "MICRO — INTERNAL WAVES / CURRENT RECOUNT PENDING"
      : "MICRO W3 UP — OWNER PROJECTION",
    rows:[
      {label:"W1 Low",value:wavePrice(microW3?.anchors?.w1Low)},
      {label:"W1 High",value:wavePrice(microW3?.anchors?.w1High)},
      {label:"W2 State",value:"COMPLETED — OWNER WORKING COUNT"},
      {label:"W2 Low",value:wavePrice(microW3?.anchors?.w2Low)},
      {label:"W2 Time",value:microW3?.anchors?.w2LowLocalTime || "—"},
      ...(parentMinuteW2 ? [{label:"Old Fib Model",value:"HISTORICAL MICRO W3 PROJECTION — NOT CURRENT COUNT"}] : []),
      ...parentReviewRow("micro"),
      {label:"Touches",value:"WATCH — CANDLE VERIFICATION PENDING"},
    ],
    levels:microW3Levels,rules:[],
  };
  const microW2State = {
    degree:"micro",label:"Micro",subtitle:"Independent MICRO corrective structure",
    active:true,badge:"W2 DOWN",headline:"W2 DOWN — DEVELOPING (OWNER SHADOW)",
    rows:[
      {label:"W1 Low",value:"7677.25"},
      {label:"W1 High",value:String(ownerMicro?.ownerW1HighPrice ?? "PENDING")},
      {label:"Current",value:"W2 CORRECTIVE RETRACEMENT"},
    ],
    levels:[],rules:[],
  };
  // Prefer the Engine 22-owned Minute W2 hypothesis for this owner's
  // presentation. The historical W3 context and Fibs remain in the backend
  // but cannot be presented as the CURRENT wave while W2 is under review.
  const minuteW2Owner = currentWavelength?.degrees?.minute?.ownerMinuteW2Retracement;
  const ownerMinuteReady = minuteW2Owner?.version === "engine22.minuteW2RetracementOwner.v1";
  const minuteW2Watch = ownerMinuteReady ||
    minuteW2Hypothesis?.version === "engine22.minuteW2ComplexCorrectionWatch.v1";
  const largerCDown = currentWavelength?.degrees?.minute?.ownerLargerCDownScenario;
  const largerCDownWatch = largerCDown?.version === "engine22.largerCorrectionCDownWatch.v1";
  const minuteW2State = minuteW2Watch ? {
    degree:"minute",label:"Minute",
    subtitle:"Owner working count — larger correction",
    active:true,badge:ownerMinuteReady ? "W2 DOWN" : largerCDownWatch ? "C DOWN WATCH" : "D UP WATCH",
    headline:ownerMinuteReady ? "MINUTE W1 COMPLETE — W2 DOWN DEVELOPING — W3 NOT STARTED" :
      largerCDownWatch ? "MINUTE W2 — LARGER C DOWN SCENARIO / ABCDE ALTERNATIVE" : "MINUTE W2 — INTERNAL D UP DEVELOPING (TRIANGLE CANDIDATE)",
    rows:[
      ...(ownerMinuteReady ? [
        {label:"W1",value:"COMPLETE — JUL 30 12:00 → AUG 13 09:00 AZ"},
        {label:"W1 low",value:wavePrice(minuteW2Owner.anchors.w1Low)},
        {label:"W1 high",value:wavePrice(minuteW2Owner.anchors.w1High)},
        {label:"Current",value:"W2 DOWN — DEVELOPING / RETRACEMENT IN PROGRESS"},
        {label:"W3",value:"NOT STARTED"},
        {label:"Invalidation",value:"BELOW 7419.50 — MINUTE W1 ORIGIN"},
        {label:"Internal",value:"ABC / ABCDE STRUCTURES UNCONFIRMED — SECONDARY DETAIL"},
      ] : [
        {label:"Current",value:largerCDownWatch ? "C DOWN — PROVISIONAL LARGER CORRECTION; DEGREE NOT YET CONFIRMED" : "MINUTE W2 STILL DEVELOPING — OWNER WORKING COUNT"},
      ]),
      ...(!ownerMinuteReady ? [
      ...(largerCDownWatch ? [
        {label:"A high",value:wavePrice(largerCDown.anchors.aHigh)},
        {label:"A low",value:wavePrice(largerCDown.anchors.aLow)},
        {label:"B high",value:wavePrice(largerCDown.anchors.bHigh)},
        {label:"Support",value:"7618 BODY / 7575 WICK — WATCH ONLY"},
        {label:"ABC/ABCDE",value:"COMPETING CORRECTION PATTERNS — UNCONFIRMED"},
        {label:"Old D UP",value:"PREVIOUS HYPOTHESIS PRESERVED FOR RECOUNT"},
      ] : []),
      {label:"Internal",value:"CONTRACTING ABCDE TRIANGLE CANDIDATE (B/X PLACEMENT UNRESOLVED)"},
      {label:"Wave A",value:"COMPLETION CANDIDATE"},
      {label:"Wave B",value:"COMPLETION CANDIDATE"},
      {label:"Wave C",value:largerCDownWatch?"C DOWN — DEVELOPING / NOT CONFIRMED":"COMPLETION CANDIDATE"},
      {label:"Wave D",value:largerCDownWatch?"POTENTIAL NEXT LEG — NOT STARTED":"UP DEVELOPING — OWNER WORKING COUNT"},
      {label:"B high",value:wavePrice(minuteW2Hypothesis?.priorPivotB?.price)},
      {label:"C low",value:wavePrice(minuteW2Hypothesis?.priorPivotC?.price)},
      {label:"C low time",value:minuteW2Hypothesis?.priorPivotC?.localTime || "PENDING"},
      {label:"Wave E",value:"ANTICIPATED — NOT STARTED"},
      {label:"Minute W3",value:"NOT CONFIRMED / NOT STARTED IN CURRENT OWNER HYPOTHESIS"},
      {label:"Range",value:"~7910 UPPER / ~7557 LOWER — REFERENCES ONLY"},
      {label:"Authority",value:"OWNER HYPOTHESIS — CANDLE / PATTERN CONFIRMATION PENDING"},
      ] : []),
    ],levels:ownerMinuteReady ? minuteW2Owner.levels :
      largerCDownWatch ? largerCDown.levels : (minuteW2Hypothesis?.internalDProjection?.levels || []),
      rules:ownerMinuteReady ? ["Minute W2 invalid below W1 origin 7419.50 — structural boundary only; not a trade stop."] : [],

  } : null;
  const approvedMinor = currentWavelength?.degrees?.minor?.ownerW5StructuralReference;
  const minorDisplay = engine22Display?.degrees?.minor;
  const minorW5State = approvedMinor?.version === "engine22.minorW5StructuralReference.v1"
    && minorDisplay ? {
    ...minorDisplay,
    rows:[...(minorDisplay.rows || []).filter(row=>String(row?.label||"").toLowerCase()!=="invalidation"),
      {label:"W4 origin",value:"7398.00 — OWNER APPROVED REFERENCE"},
      {label:"W5 risk",value:"BELOW 7398.00 → RECOUNT / STRUCTURAL REVIEW"}],
    rules:[...(minorDisplay.rules || []),
      "Minor W5 active candidate: a breach below 7398.00 requires structural review; not a trade stop."],
  } : null;
  const minuteW3Owner = v3ShadowDegrees?.minute?.ownerCorrectionState ===
    "MINUTE_W3_OWNER_CONTEXT" &&
    v3ShadowDegrees?.minute?.activeWave === "W3";
  const minuteW3State = minuteW3Owner ? {
    ...(engine22Display.degrees?.minute || {}),
    degree:"minute",
    label:"Minute",
    active:true,
    badge:"W3 UP",
    subtitle:"Tactical wave — owner W3 context",
    headline:"WAVE 3 UP — STARTED, CONFIRMATION PENDING",
    rows:[
      {label:"Current wave",value:"W3 UP — DEVELOPING"},
      {label:"Confirmation",value:"7848.50 RECLAIM / 7906.25 CONFIRM"},
      ...(engine22Display.degrees?.minute?.rows || []).filter(
        row => !/^(current wave|confirmation)$/i.test(String(row.label||""))
      ),
    ],
  } : null;
  const subminuteW3Levels = currentWavelength?.degrees?.subminute
    ?.fibAnchorStatus === "OWNER_COORDINATES_CONFIRMED_PRICE_BASIS_PENDING" &&
    Array.isArray(currentWavelength?.degrees?.subminute?.levels)
      ? currentWavelength.degrees.subminute.levels : [];
  const subminuteDUp = currentWavelength?.degrees?.subminute?.ownerCurrentDUp;
  const subminuteDUpActive = subminuteDUp?.version === "engine22.subminuteDUpOwnerWorking.v1" &&
    subminuteDUp?.activeWave === "D" && subminuteDUp?.direction === "UP" &&
    subminuteDUp?.parentWave === "W2" && subminuteDUp?.minuteW3Started === false &&
    minuteW2Watch;
  const subminuteDUpState = subminuteDUpActive ? {
    degree:"subminute",label:"Subminute",
    subtitle:"Owner working D UP inside unfinished Minute W2",
    active:true,badge:"D UP CANDIDATE",
    headline:"SUBMINUTE D UP — DEVELOPING / MINUTE W2 NOT COMPLETE",
    rows:[
      {label:"Parent",value:"MINUTE W2 — COMPLEX CORRECTION NOT COMPLETE"},
      {label:"Current",value:"D UP — OWNER WORKING CANDIDATE / UNCONFIRMED"},
      {label:"Prior C low",value:wavePrice(subminuteDUp.proposedPriorC?.endingPrice)},
      {label:"C low time",value:"OCT 23 2026, 7:00 AM ARIZONA — OWNER REFERENCE"},
      {label:"Prior C status",value:"ENDING NOMINATED — NOT STRUCTURALLY VERIFIED"},
      {label:"Structure",value:"ABCDE TRIANGLE CANDIDATE — UNCONFIRMED"},
      {label:"Next",value:"E DOWN POSSIBLE — NOT STARTED"},
      {label:"History",value:"PRIOR C DOWN FIB LEVELS AND OLD SUBMINUTE W3 PRESERVED"},
      {label:"Minute W3",value:"NOT STARTED"},
      {label:"D Fibonacci basis",value:"B HIGH 7897.50 → C LOW 7648.50 / PROVISIONAL"},
      {label:"D completion watch",value:"7865.00–7875.00 — WATCH ONLY / NOT CONFIRMED"},
    ],
    levels:Array.isArray(subminuteDUp.levels)?subminuteDUp.levels:[],
    rules:[],
  } : null;
  const subminuteCDown = currentWavelength?.degrees?.subminute?.ownerCurrentCDown;
  const subminuteCDownActive = subminuteCDown?.version === "engine22.subminuteCurrentCDownReference.v1" &&
    largerCDownWatch && Array.isArray(largerCDown?.levels);
  const subminuteCDownState = subminuteCDownActive ? {
    degree:"subminute",label:"Subminute",
    subtitle:"Current corrective leg of unfinished Minute W2",
    active:true,badge:"C DOWN WATCH",
    headline:"SUBMINUTE C DOWN — DEVELOPING / MINUTE W2 ABCDE WATCH",
    rows:[
      {label:"Parent",value:"MINUTE W2 — COMPLEX CORRECTION NOT COMPLETE"},
      {label:"Current",value:"C DOWN — PROVISIONAL WORKING LEG / NOT CONFIRMED"},
      {label:"A high",value:wavePrice(largerCDown.anchors.aHigh)},
      {label:"A low",value:wavePrice(largerCDown.anchors.aLow)},
      {label:"B high",value:wavePrice(largerCDown.anchors.bHigh)},
      {label:"Structure",value:"ABC OR ABCDE — C LEG DEVELOPING; D/E NOT CONFIRMED"},
      {label:"Degree",value:"PROVISIONAL PLACEMENT — OWNER WORKING INTERPRETATION"},
      {label:"History",value:"OLDER SUBMINUTE W3 PROJECTION PRESERVED"},
    ],
    levels:largerCDown.levels,
    rules:[],
  } : null;
  const subminuteW3State = {
    degree:"subminute",label:"Subminute",subtitle:parentMinuteW2 ? "Larger internal swings of Minute W2" : "Owner-locked W3 projection",
    active:true,
    badge:parentMinuteW2 ? "ABCDE WATCH" : "W3 UP WATCH",
    headline:parentMinuteW2
      ? "SUBMINUTE ABC UP — BUILDING MINUTE D"
      : "SUBMINUTE W3 — PRIOR C COMPLETION (OWNER ASSESSMENT)",
    rows:[
      {label:"Prior Wave C",value:"COMPLETE — OWNER WORKING COUNT; NOT CANDLE-CONFIRMED"},
      {label:"W1 Low",value:"7616.25"},
      {label:"W1 High",value:"7847.00"},
      {label:"W2 Low",value:"7673.25"},
      ...(parentMinuteW2 ? [{label:"Old Fib Model",value:"HISTORICAL SUBMINUTE W3 PROJECTION — NOT CURRENT COUNT"}] : []),
      ...(parentMinuteW2 ? [{label:"Current ABC",value:"ABC UP — DEVELOPING INSIDE MINUTE D; A CANDIDATE / B,C PENDING"}] : []),
      ...parentReviewRow("subminute"),
      {label:"Touches",value:"WATCH — CANDLE VERIFICATION PENDING"},
    ],
    levels:subminuteW3Levels,rules:[],
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
            state={degree === "micro" && microW3OwnerActive ? microW3OwnerState :
              degree === "micro" && microCDownActive ? microCDownState :
              degree === "micro" && microBActive ? microBState :
              degree === "submicro" && submicroCActive ? submicroCState :
              degree === "submicro" && submicroAActive ? submicroAState :
              degree === "micro" && microAbcActive ? microAbcState :
              degree === "micro" && microW3Levels.length ? microW3State :
              degree === "subminute" && subminuteDUpActive ? subminuteDUpState :
              degree === "subminute" && subminuteCDownActive ? subminuteCDownState :
              degree === "subminute" && subminuteW3Levels.length ? subminuteW3State :
              degree === "submicro" && submicroAbcActive ? submicroAbcState :
              degree === "submicro" ? submicroState :
              degree === "micro" && microW2 ? microW2State :
              degree === "subminute" && subminuteW3 ? subminuteW3State :
              degree === "minute" && minuteW2Watch ? minuteW2State :
              degree === "minor" && minorW5State ? minorW5State :
              degree === "minute" && minuteW3Owner ? minuteW3State :
              engine22Display.degrees?.[degree] || {
                degree,label:degree,active:false,
                headline:`${String(degree).toUpperCase()} structure not published.`,
                rows:[],levels:[],rules:[],
              }}
            v3Shadow={degree === "submicro" && submicroABC ? null :
              degree === "micro" && microW3Levels.length ? null :
              degree === "subminute" && subminuteW3Levels.length ? null :
              degree === "minute" && minuteW2Watch ? null :
              degree === "submicro" ? ownerSubmicro :
              degree === "micro" ? ownerMicro :
              degree === "subminute" ? ownerSubminute :
              v3ShadowDegrees?.[degree] || null}
            wavelength={currentWavelength}
            higherDegreeBearishProtection={higherDegreeBearishProtection}
            sevenDegreeInvalidations={sevenDegreeInvalidations}
            waveDegreeOverride={["submicro","micro","subminute"].includes(degree) || (degree === "minute" && minuteW2Watch) ? null : undefined}
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
