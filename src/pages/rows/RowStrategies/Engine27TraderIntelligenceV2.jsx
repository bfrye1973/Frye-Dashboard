// src/pages/rows/RowStrategies/Engine27TraderIntelligenceV2.jsx
// Engine 27 V2 — six-degree trader intelligence presentation.
// Read-only. Consumes additive backend contract:
// snapshot.engine27Strategies.engine27TraderIntelligenceV2
//
// Existing Engine 27A–27E production contracts remain untouched.

import React, { useEffect, useState } from "react";
import { API_BASE } from "../../journal/journalConstants.js";

const DEGREE_ORDER = [
  "submicro",
  "micro",
  "subminute",
  "minute",
  "minor",
  "intermediate",
  "primary",
];

const LABELS = {
  submicro: "SUBMICRO",
  micro: "MICRO",
  subminute: "SUBMINUTE",
  minute: "MINUTE",
  minor: "MINOR",
  intermediate: "INTERMEDIATE",
  primary: "PRIMARY",
};

function txt(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function pretty(value, fallback = "—") {
  const raw = txt(value, "");
  return raw ? raw.replaceAll("_", " ") : fallback;
}

function price(value, fallback = "—") {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : fallback;
}

function toneForDirection(direction) {
  const d = String(direction || "").toUpperCase();
  if (d === "UP") return "#22c55e";
  if (d === "DOWN") return "#ef4444";
  if (d === "NEUTRAL") return "#f59e0b";
  return "#64748b";
}

function conditionTone(condition) {
  const c = String(condition || "").toUpperCase();
  if (c.includes("UNCONFIRMED") || c.includes("NOT_CONFIRMED")) return "#f59e0b";
  if (c.includes("LOCKED") || c.includes("CONFIRMED")) return "#22c55e";
  if (c.includes("CANDIDATE") || c.includes("PENDING") || c.includes("DEVELOP")) return "#f59e0b";
  if (c.includes("FAILED") || c.includes("INVALID")) return "#ef4444";
  return "#3b82f6";
}


const STRATEGY_ALIGNMENT_ORDER = [
  "INTRADAY",
  "SUBMINUTE",
  "MINUTE",
  "MINOR",
  "INTERMEDIATE",
  "PRIMARY",
];

function toneForThesis(state) {
  const value = String(state || "").toUpperCase();

  if (value === "ALIGNED") return "#22c55e";
  if (value === "LOWER_DEGREE_PULLBACK") return "#eab308";
  if (value === "EARLY_WARNING") return "#f59e0b";
  if (value === "THESIS_WEAKENING") return "#f97316";
  if (value === "THESIS_BROKEN") return "#ef4444";
  if (value === "FLAT") return "#64748b";
  return "#64748b";
}

function toneForAccountAlignment(value) {
  const alignment = String(value || "").toUpperCase();
  if (alignment === "ALIGNED") return "#22c55e";
  if (alignment === "CONFLICT") return "#ef4444";
  if (alignment === "FLAT") return "#64748b";
  return "#f59e0b";
}

function accountPositionLabel(account) {
  const position = account?.position || {};
  if (position?.positionPresent !== true) return "FLAT";

  const direction = pretty(position?.direction, "UNKNOWN");
  const contracts = Number(position?.contracts);

  return Number.isFinite(contracts)
    ? `${direction} ${contracts} MES`
    : direction;
}

function accountStructuralRead(account) {
  const structure = account?.structure || {};
  const wave = pretty(structure?.activeWave, "—");
  const direction = pretty(structure?.direction, "—");
  const condition =
    pretty(
      structure?.timingState ||
      structure?.lifecycle,
      "—"
    );

  return `${wave} • ${direction} • ${condition}`;
}

function StrategyAlignmentCard({ account }) {
  const thesisState =
    account?.thesisState || "FLAT";

  const thesisTone =
    toneForThesis(thesisState);

  const accountAlignmentTone =
    toneForAccountAlignment(
      account?.alignment
    );

  const brokerStatus =
    account?.brokerBinding?.status ||
    "UNBOUND";

  const comparisons =
    Array.isArray(
      account?.campaignComparisons
    )
      ? account.campaignComparisons
      : [];

  const activeComparison =
    comparisons[0] || null;

  const lowerPressure =
    Array.isArray(
      activeComparison?.opposedLowerDegrees
    )
      ? activeComparison.opposedLowerDegrees
      : [];

  const higherPressure =
    Array.isArray(
      activeComparison?.opposedHigherDegrees
    )
      ? activeComparison.opposedHigherDegrees
      : [];

  const liveRead =
    thesisState === "FLAT"
      ? `${account?.structuralOwner || "STRUCTURE"} currently ${pretty(account?.structure?.direction, "unavailable")} — account is flat.`
      : activeComparison?.guidance ||
        "Live strategy thesis monitoring active.";

  return (
    <div
      style={{
        border: `1px solid ${thesisTone}88`,
        borderTop: `4px solid ${thesisTone}`,
        borderRadius: 10,
        background: "#0a1018",
        padding: 8,
        minWidth: 0,
        display: "grid",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#f8fafc",
              fontSize: 12,
              fontWeight: 1000,
            }}
          >
            {account?.displayName?.toUpperCase() || account?.accountRole || "STRATEGY"} ALIGNMENT
          </div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: 9,
              fontWeight: 900,
              marginTop: 1,
            }}
          >
            {account?.structuralOwner || "—"} structural owner • live read
          </div>
        </div>

        <SmallBadge
          text={pretty(thesisState)}
          tone={thesisTone}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
          gap: 4,
        }}
      >
        <Cell
          label="Position"
          value={accountPositionLabel(account)}
          tone={accountAlignmentTone}
        />

        <Cell
          label="Account Alignment"
          value={pretty(account?.alignment)}
          tone={accountAlignmentTone}
        />

        <Cell
          label="Current Structure"
          value={accountStructuralRead(account)}
          tone={toneForDirection(
            account?.structure?.direction
          )}
        />

        <Cell
          label="Broker Slot"
          value={pretty(brokerStatus)}
          detail={
            account?.brokerBinding
              ?.brokerAccountLabel ||
            "Not bound yet"
          }
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
          gap: 4,
        }}
      >
        <Cell
          label="Lower-Degree Pressure"
          value={
            lowerPressure.length
              ? lowerPressure
                  .map(pretty)
                  .join(" • ")
              : "NONE"
          }
          tone={
            lowerPressure.length
              ? "#fbbf24"
              : "#86efac"
          }
        />

        <Cell
          label="Higher-Degree Conflict"
          value={
            higherPressure.length
              ? higherPressure
                  .map(pretty)
                  .join(" • ")
              : "NONE"
          }
          tone={
            higherPressure.length
              ? "#fb923c"
              : "#86efac"
          }
        />
      </div>

      <div
        style={{
          border:
            "1px solid rgba(148,163,184,.22)",
          borderRadius: 7,
          background: "#080d14",
          padding: "6px 7px",
        }}
      >
        <div
          style={{
            color: "#94a3b8",
            fontSize: 9,
            fontWeight: 1000,
          }}
        >
          STRATEGY READ
        </div>
        <div
          style={{
            color: "#f8fafc",
            fontSize: 10,
            fontWeight: 900,
            lineHeight: 1.24,
            marginTop: 2,
          }}
        >
          {liveRead}
        </div>
      </div>
    </div>
  );
}

const CURRENT_ACCOUNT_ENDINGS = Object.freeze({
  submicro:"0747", micro:"6380", subminute:"7727", minute:"3914",
  minor:"5671", intermediate:"2888", primary:"0144",
});
function CurrentWorkingAlignmentCard({ degree, read, performance, invalidationRecord, marketContext, reactions }) {
  const assessment = read?.directionAssessment || null;
  const protection = read?.bearishProtection || null;
  const protectionTone = ["HIGH_BEARISH_RISK","MAJOR_BEARISH_RISK"].includes(protection?.status)
    ? "#ef4444" : ["WARNING","BEARISH_RISK_CONFIRMED"].includes(protection?.status)
      ? "#f59e0b" : protection?.status === "BULLISH_STRUCTURE_ABOVE_WARNING" ? "#22c55e" : "#94a3b8";
  const alignment = assessment?.status || "UNCONFIRMED";
  const alignmentTone = alignment === "ALIGNED" ? "#22c55e" : alignment === "CONFLICT" ? "#ef4444" : "#f59e0b";
  const reviewZone = invalidationRecord?.review?.zone || assessment?.reviewZone;
  const zoneLabel = reviewZone && Number.isFinite(reviewZone.low) && Number.isFinite(reviewZone.high)
    ? (reviewZone.low === reviewZone.high ? price(reviewZone.low) : `${price(reviewZone.low)}–${price(reviewZone.high)}`)
    : "NOT PUBLISHED";
  const direction = read?.available ? read.waveDirection : "NOT_PUBLISHED";
  const tone = toneForDirection(direction);
  return (
    <div style={{background:"#0a1018",border:"1px solid #334155",borderTop:`4px solid ${tone}`,borderRadius:10,padding:9,minWidth:0,display:"grid",gap:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
        <strong style={{fontSize:12,color:"#e2e8f0"}}>{degree.toUpperCase()} ALIGNMENT</strong>
        <SmallBadge text={alignment} tone={alignmentTone} />
      </div>
      <Cell label="Wave / direction" value={`${pretty(read?.activeWave)} • ${pretty(direction)}`} tone={tone} />
      <Cell label="Expected wave" value={pretty(assessment?.expectedWaveDirection || direction)} tone={tone} />
      <Cell label="Price action" value={pretty(assessment?.observedPriceDirection || "UNCONFIRMED")} detail={assessment ? `${assessment.timeframe === "1d" ? "DAILY ONLY" : assessment.timeframe} • ${assessment.lookback ? `${assessment.lookback} completed closes • ` : ""}${pretty(assessment.evidence)}` : "Completed-candle evidence pending"} tone={alignmentTone} />
      <Cell label="Direction alignment" value={alignment} detail="Price action versus wave direction; not trade permission" tone={alignmentTone} />
      <Cell label="Engine 22 review / structural reference" value={zoneLabel} detail={`${pretty(invalidationRecord?.review?.zone?.kind || "NOT_PUBLISHED")} • REVIEW ONLY — not an approved invalidation or stop`} tone="#fbbf24" />
      <Cell label="Official invalidation" value={invalidationRecord?.status === "PUBLISHED" && invalidationRecord?.price != null ? price(invalidationRecord.price) : "NOT PUBLISHED"} detail="Only Engine 22 can approve structural invalidation" tone="#94a3b8" />
      <Cell label="QQQ price reaction" value={reactions?.instruments?.QQQ?.events?.length ? reactions.instruments.QQQ.events.map(e => pretty(e.event)).join(", ") : pretty(reactions?.instruments?.QQQ?.state || "UNAVAILABLE")}
        detail={`Direct QQQ • completed hourly candles • ${reactions?.instruments?.QQQ?.lastCompletedAt || "source not verified"} • zone reactions only`}
        tone="#94a3b8" />
      <Cell label="VIX price reaction" value={reactions?.instruments?.VIX?.events?.length ? reactions.instruments.VIX.events.map(e => pretty(e.event)).join(", ") : pretty(reactions?.instruments?.VIX?.state || "UNAVAILABLE")}
        detail={`Direct I:VIX • completed hourly candles • ${reactions?.instruments?.VIX?.lastCompletedAt || "source not verified"} • no automatic ES confirmation`}
        tone="#94a3b8" />
      <Cell label="Cross-market" value={marketContext?.crossMarket?.QQQ?.status === "ZONES_AVAILABLE" && marketContext?.crossMarket?.VIX?.status === "ZONES_AVAILABLE" ? "QQQ / VIX ZONES AVAILABLE" : "PARTIAL / UNAVAILABLE"} detail={`QQQ: ${marketContext?.crossMarket?.QQQ?.levelCount ?? 0} zones • VIX: ${marketContext?.crossMarket?.VIX?.levelCount ?? 0} zones • evidence only`} tone="#94a3b8" />
      <Cell label="Engine 25 / 29" value={`Breadth: ${pretty(marketContext?.participation?.state || "UNAVAILABLE")} • Tactical: ${pretty(marketContext?.tactical?.overallState || "UNAVAILABLE")}`}
        detail={`Market-wide background, not a separate degree signal • ${["minute","minor","intermediate","primary"].includes(degree) ? `${assessment?.lookback ?? "—"}-daily-close interpretation shown above` : "Intraday interpretation shown above"} • E25 ${marketContext?.participation?.fresh ? "CURRENT" : "STALE"} / E29 ${marketContext?.tactical?.fresh ? "CURRENT" : "STALE"}`}
        tone="#94a3b8" />
       {(degree === "intermediate" || degree === "primary") && (
         <Cell label="7200 bearish protection" value={pretty(protection?.status || "UNCONFIRMED")}
           detail={protection
             ? `${protection.timeframe} completed close: ${protection.latestCompletedClose == null ? "unavailable" : price(protection.latestCompletedClose)} • Deep risk below 6800 • Structural reference ${price(protection.structuralReference)} remains separate`
             : "Engine 22 completed-candle protection unavailable"}
           tone={protectionTone} />
       )}
      <Cell label="Schwab strategy account" value={`••••${CURRENT_ACCOUNT_ENDINGS[degree]}`} detail="Account identity only — live position/thesis not reclassified" />
      <Cell label="Engine 10 open contracts" value={performance?.available ? String(performance?.openContracts ?? "—") : "UNAVAILABLE"} detail={performance?.available ? "Current REAL performance section" : "No verified Engine 10 group response"} />
      <Cell label="Trade thesis" value={performance?.available && performance.openContracts === 0 ? "FLAT" : "ENTRY_STRUCTURE_UNAVAILABLE"} detail={performance?.available && performance.openContracts > 0 ? "Open contracts exist; original entry structure not matched to this working count" : "No inferred thesis from broker account identity"} tone="#fbbf24" />
      <Cell label="Structural state" value={pretty(read?.currentCondition)} tone="#fbbf24" />
      <Cell label="Confirmation" value={pretty(read?.confirmationNeeded?.status)} tone="#fbbf24" />
      <div style={{fontSize:10,color:"#cbd5e1"}}>{read?.traderRead?.summary || "Engine 22 current model unavailable"}</div>
    </div>
  );
}
function SeparateStrategyAlignments({ snapshot, workingSeven = null, performanceSections = null, invalidations = null, marketContext = null, reactions = null }) {
  if (workingSeven?.engine === "engine27.workingSevenDegrees.v1") {
    return (
      <div style={{display:"grid",gap:7}}>
        <div style={{fontSize:11,color:"#cbd5e1",fontWeight:1000}}>SEVEN CURRENT STRUCTURAL STRATEGY ALIGNMENTS — READ ONLY</div>
        <div className="engine27-strategy-alignment-grid">
          {workingSeven.degreeOrder.map(degree => (
            <CurrentWorkingAlignmentCard key={degree} degree={degree} read={workingSeven.degrees?.[degree]} invalidationRecord={invalidations?.degrees?.[degree]} marketContext={marketContext} reactions={reactions} performance={performanceSections?.[degree.toUpperCase()] || null} />
          ))}
        </div>
        <div style={{color:"#fbbf24",fontSize:10}}>These current structural views do not infer broker positions or rewrite historical thesis states.</div>
        <details style={{border:"1px solid #334155",borderRadius:8,padding:7}}>
          <summary style={{cursor:"pointer",color:"#94a3b8",fontSize:11,fontWeight:900}}>LEGACY SIX-ROLE POSITION & THESIS MONITORING — expand original records</summary>
          <LegacyStrategyAlignments snapshot={snapshot} />
        </details>
      </div>
    );
  }
  return <LegacyStrategyAlignments snapshot={snapshot} />;
}

function LegacyStrategyAlignments({ snapshot }) {
  const monitor =
    snapshot?.strategyAccountMonitoring ||
    null;

  const accounts =
    Array.isArray(monitor?.accounts)
      ? monitor.accounts
      : [];

  if (!accounts.length) return null;

  const byRole =
    Object.fromEntries(
      accounts.map((account) => [
        account?.accountRole,
        account,
      ])
    );

  return (
    <div
      style={{
        display: "grid",
        gap: 7,
      }}
    >
      <div
        style={{
          color: "#cbd5e1",
          fontSize: 11,
          fontWeight: 1000,
          letterSpacing: ".03em",
        }}
      >
        SEPARATE LIVE STRATEGY ALIGNMENTS
      </div>

      <div className="engine27-strategy-alignment-grid">
        {STRATEGY_ALIGNMENT_ORDER.map(
          (role) => {
            const account = byRole[role];
            if (!account) return null;

            return (
              <StrategyAlignmentCard
                key={role}
                account={account}
              />
            );
          }
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, detail = null, tone = "#e5e7eb" }) {
  return (
    <div
      style={{
        border: "1px solid rgba(51,65,85,.48)",
        borderRadius: 8,
        background: "#0a1018",
        padding: "7px 8px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 10,
          fontWeight: 1000,
          textTransform: "uppercase",
          letterSpacing: ".035em",
          marginBottom: 3,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: tone,
          fontSize: 13,
          fontWeight: 1000,
          lineHeight: 1.14,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>

      {detail ? (
        <div
          style={{
            color: "#94a3b8",
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1.2,
            marginTop: 3,
            wordBreak: "break-word",
          }}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function SmallBadge({ text, tone = "#475569" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        background: tone,
        color: "#f8fafc",
        border: "1px solid rgba(255,255,255,.16)",
        padding: "3px 7px",
        fontSize: 10,
        fontWeight: 1000,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function CompletionLevels({ completion }) {
  const levels = Array.isArray(completion?.levels)
    ? completion.levels.filter((level) => Number.isFinite(Number(level?.price)))
    : [];

  if (!levels.length) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>
        {completion?.summary || "No Engine 22 completion levels published."}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 5 }}>
      {completion?.nextLevel ? (
        <div
          style={{
            border: "1px solid rgba(34,197,94,.35)",
            borderRadius: 8,
            background: "#07120a",
            padding: "6px 7px",
          }}
        >
          <div style={{ color: "#86efac", fontSize: 10, fontWeight: 1000 }}>
            NEXT PUBLISHED LEVEL
          </div>
          <div style={{ color: "#f8fafc", fontSize: 13, fontWeight: 1000 }}>
            {completion.nextLevel.label || "Level"} {price(completion.nextLevel.price)}
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 4,
        }}
      >
        {levels.slice(0, 6).map((level, index) => (
          <div
            key={`${level?.label || "level"}-${index}`}
            style={{
              border: level?.status === "TOUCHED" && level?.touchEvidenceAvailable === true && !level?.provisional ? "1px solid rgba(34,197,94,.35)" : "1px solid rgba(245,158,11,.30)",
              borderRadius: 7,
              background: level?.status === "TOUCHED" && level?.touchEvidenceAvailable === true && !level?.provisional ? "#071008" : "#171205",
              padding: "5px 6px",
              minWidth: 0,
            }}
          >
            <div style={{ color: level?.status === "TOUCHED" && level?.touchEvidenceAvailable === true && !level?.provisional ? "#86efac" : "#fbbf24", fontSize: 9, fontWeight: 1000 }}>
              {level?.label || "Level"}
            </div>
            <div style={{ color: "#f8fafc", fontSize: 12, fontWeight: 1000 }}>
              {price(level?.price)}
            </div>
            {level?.status ? (
              <div style={{ color: level?.status === "TOUCHED" && level?.touchEvidenceAvailable === true && !level?.provisional ? "#86efac" : "#fbbf24", fontSize: 9, fontWeight: 800 }}>
                {level.status === "TOUCHED" && (level.provisional || level.touchEvidenceAvailable !== true) ? "TOUCH REPORTED — EVIDENCE UNVERIFIED" : pretty(level.status)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmationBox({ confirmation }) {
  const evidence = Array.isArray(confirmation?.evidence)
    ? confirmation.evidence.filter(Boolean)
    : [];

  return (
    <div
      style={{
        border: "1px solid rgba(245,158,11,.38)",
        borderRadius: 8,
        background: "#171005",
        padding: "7px 8px",
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ color: "#fbbf24", fontSize: 10, fontWeight: 1000 }}>
        CONFIRMATION NEEDED
      </div>

      <div style={{ color: "#f8fafc", fontSize: 12, fontWeight: 1000 }}>
        {pretty(confirmation?.status, "Not published")}
      </div>

      {confirmation?.rule ? (
        <div style={{ color: "#fde68a", fontSize: 10, fontWeight: 800 }}>
          {pretty(confirmation.rule)}
        </div>
      ) : null}

      {confirmation?.note ? (
        <div style={{ color: "#d1d5db", fontSize: 10, fontWeight: 800 }}>
          {confirmation.note}
        </div>
      ) : null}

      {evidence.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {evidence.map((item) => (
            <SmallBadge key={item} text={pretty(item)} tone="#92400e" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ParentContext({ parent }) {
  const summary =
    parent?.displayText ||
    [
      parent?.parentDegree ? pretty(parent.parentDegree) : null,
      parent?.parentWave ? pretty(parent.parentWave) : null,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div
      style={{
        border: "1px solid rgba(59,130,246,.30)",
        borderRadius: 8,
        background: "#08111f",
        padding: "7px 8px",
      }}
    >
      <div style={{ color: "#93c5fd", fontSize: 10, fontWeight: 1000 }}>
        PARENT CONTEXT
      </div>
      <div style={{ color: "#dbeafe", fontSize: 11, fontWeight: 900, marginTop: 3 }}>
        {summary || "Top degree / parent not published"}
      </div>
    </div>
  );
}

function Strategy1Readiness({ read }) {
  if (!read) return null;

  const permissionTone = read?.permission?.allowed ? "#22c55e" : "#f59e0b";
  const expected =
    read?.expectedReversal
      ? `${pretty(read.expectedReversal)} — WATCH ONLY`
      : "None published";

  return (
    <div
      style={{
        border: "1px solid #35506f",
        borderRadius: 9,
        background: "#08111b",
        padding: 7,
        display: "grid",
        gap: 6,
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
        <div style={{ color: "#bfdbfe", fontSize: 11, fontWeight: 1000 }}>
          STRATEGY 1 READINESS
        </div>
        <SmallBadge
          text={read?.permission?.allowed ? "PERMISSION ALLOWED" : "NO PERMISSION"}
          tone={permissionTone}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,minmax(0,1fr))",
          gap: 5,
        }}
      >
        <Cell
          label="Strategy Direction"
          value={pretty(read?.strategyDirection)}
          tone={toneForDirection(
            String(read?.strategyDirection || "").toUpperCase() === "LONG"
              ? "UP"
              : String(read?.strategyDirection || "").toUpperCase() === "SHORT"
              ? "DOWN"
              : "NEUTRAL"
          )}
        />
        <Cell label="Expected Reversal" value={expected} tone="#fbbf24" />
        <Cell
          label="Location"
          value={pretty(read?.location?.status)}
          detail={read?.location?.currentPrice != null ? `Price ${price(read.location.currentPrice)}` : null}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,minmax(0,1fr))",
          gap: 5,
        }}
      >
        <Cell
          label="Engine 3"
          value={read?.reaction?.confirmed ? "CONFIRMED" : read?.reaction?.armed ? "ARMED / WAITING" : "WAITING"}
          detail={pretty(read?.reaction?.state)}
          tone={read?.reaction?.confirmed ? "#86efac" : "#fbbf24"}
        />
        <Cell
          label="Engine 4"
          value={read?.participation?.confirmed ? "CONFIRMED" : read?.participation?.armed ? "ARMED / WAITING" : "WAITING"}
          detail={pretty(read?.participation?.state)}
          tone={read?.participation?.confirmed ? "#86efac" : "#fbbf24"}
        />
        <Cell
          label="Engine 6"
          value={read?.permission?.allowed ? "ALLOWED" : "FALSE"}
          detail={pretty(read?.permission?.decision)}
          tone={read?.permission?.allowed ? "#86efac" : "#fbbf24"}
        />
        <Cell
          label="Engine 26B"
          value={read?.geometry?.ready ? "READY" : "WAITING"}
          detail={pretty(read?.geometry?.lifecycleStatus)}
          tone={read?.geometry?.ready ? "#86efac" : "#fbbf24"}
        />
      </div>
    </div>
  );
}

function DegreeCard({ degree, data }) {
  const directionTone = toneForDirection(data?.waveDirection);
  const statusTone = conditionTone(data?.currentCondition);

  const invalidationText =
    data?.invalidation?.price != null
      ? price(data.invalidation.price)
      : data?.invalidation?.displayText || "Not published";

  const provenance = data?.provenance || {};
  const freshness = provenance?.freshness || {};

  return (
    <div
      style={{
        background: "#0b1018",
        border: "1px solid #263244",
        borderTop: `4px solid ${statusTone}`,
        borderRadius: 11,
        padding: 8,
        minWidth: 0,
        display: "grid",
        alignContent: "start",
        gap: 7,
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
        <div>
          <div style={{ color: "#f8fafc", fontSize: 13, fontWeight: 1000 }}>
            {LABELS[degree] || degree.toUpperCase()}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900 }}>
            Elliott Wave Read
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <SmallBadge text={pretty(data?.activeWave)} tone="#334155" />
          <SmallBadge text={pretty(data?.waveDirection)} tone={directionTone} />
        </div>
      </div>

      <div
        style={{
          color: "#e5e7eb",
          fontSize: 11,
          fontWeight: 1000,
          lineHeight: 1.25,
          minHeight: 28,
        }}
      >
        {data?.traderRead?.headline || "Engine 22 structure not published."}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 5,
        }}
      >
        <Cell
          label="Active Wave"
          value={pretty(data?.activeWave)}
        />
        <Cell
          label="Wave Direction"
          value={pretty(data?.waveDirection)}
          tone={directionTone}
        />
        <Cell
          label="Current Condition"
          value={pretty(data?.currentCondition)}
          tone={statusTone}
        />
        <Cell
          label="Invalidation"
          value={invalidationText}
          tone="#fbbf24"
        />
      </div>

      <div
        style={{
          border: "1px solid rgba(34,197,94,.28)",
          borderRadius: 8,
          background: "#07110a",
          padding: 7,
        }}
      >
        <div style={{ color: "#fbbf24", fontSize: 10, fontWeight: 1000, marginBottom: 5 }}>
          POTENTIAL COMPLETION
        </div>
        <CompletionLevels completion={data?.potentialCompletion} />
      </div>

      <ConfirmationBox confirmation={data?.confirmationNeeded} />

      <ParentContext parent={data?.parentContext} />

      <div
        style={{
          border: "1px solid rgba(148,163,184,.24)",
          borderRadius: 8,
          background: "#0a0f16",
          padding: "7px 8px",
        }}
      >
        <div style={{ color: "#cbd5e1", fontSize: 10, fontWeight: 1000 }}>
          TRADER READ
        </div>
        <div style={{ color: "#f8fafc", fontSize: 11, fontWeight: 900, lineHeight: 1.25, marginTop: 3 }}>
          {data?.traderRead?.summary || "No trader read published."}
        </div>
      </div>

      {degree === "minute" ? (
        <Strategy1Readiness read={data?.strategy1Readiness} />
      ) : null}

      <div
        style={{
          borderTop: "1px solid rgba(51,65,85,.45)",
          paddingTop: 6,
          display: "grid",
          gap: 2,
        }}
      >
        <div style={{ color: "#64748b", fontSize: 9, fontWeight: 800 }}>
          SOURCE: {pretty(provenance?.workingSource || provenance?.structuralSource)}
        </div>
        <div style={{ color: "#64748b", fontSize: 9, fontWeight: 800 }}>
          CONFIRMATION: {pretty(provenance?.confirmationStatus)}
        </div>
        <div style={{ color: "#64748b", fontSize: 9, fontWeight: 800 }}>
          FRESHNESS: {pretty(freshness?.status)}
          {freshness?.evidenceTimestamp ? ` • ${freshness.evidenceTimestamp}` : ""}
        </div>
      </div>
    </div>
  );
}

function Summary({ engine27 }) {
  const alignment = engine27?.engine27Alignment || {};
  const story = engine27?.engine27MarketStory || {};
  const warnings = Array.isArray(alignment?.lowerDegreeWarnings)
    ? alignment.lowerDegreeWarnings.filter(Boolean)
    : [];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 2fr 2fr",
        gap: 7,
      }}
    >
      <Cell label="Alignment" value={pretty(alignment?.alignmentState)} />
      <Cell label="Confidence" value={pretty(alignment?.confidence)} />
      <Cell label="Market Story" value={story?.headline || "—"} />
      <Cell
        label="Warnings"
        value={warnings.length ? warnings.map(pretty).join(" • ") : story?.warningSummary || "None"}
        tone={warnings.length ? "#fbbf24" : "#e5e7eb"}
      />
    </div>
  );
}

export default function Engine27TraderIntelligenceV2({ snapshot }) {
  const [performanceSections, setPerformanceSections] = useState(null);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(API_BASE + "/api/v1/trade-journal/real-performance", {cache:"no-store"});
        if (!response.ok) throw new Error("Engine 10 unavailable");
        const payload = await response.json();
        if (!payload?.ok || payload?.schema !== "engine10.realPerformanceSections.v1") throw new Error("Unexpected Engine 10 contract");
        const entries = Object.fromEntries(
          ["SUBMICRO","MICRO","SUBMINUTE","MINUTE","MINOR","INTERMEDIATE","PRIMARY"].map(group => [
            group, payload.sections?.[group]
              ? {available:true,openContracts:payload.sections[group].openContracts}
              : {available:false}
          ])
        );
        if (active) setPerformanceSections(entries);
      } catch {
        if (active) setPerformanceSections(null);
      }
    }
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);
  const engine27 = snapshot?.engine27Strategies || null;
  const v2 = engine27?.engine27TraderIntelligenceV2 || null;
  const workingSeven = engine27?.engine27WorkingSevenDegrees || null;
  const invalidations = engine27?.engine27SevenInvalidations || null;
  const marketContext = engine27?.engine27UnifiedMarketContext || null;
  const reactions = engine27?.engine27LiveCrossMarketReactions || null;
  const currentInterpretation = workingSeven?.engine === "engine27.workingSevenDegrees.v1" ? workingSeven : v2;
  const showWorking = currentInterpretation === workingSeven;

  if (!currentInterpretation?.degrees) return null;

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 10,
        background: "#070c13",
        display: "grid",
        gap: 9,
      }}
    >
      <style>{`
        .engine27-v2-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(220px, 1fr));
          gap: 8px;
          align-items: stretch;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .engine27-strategy-alignment-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(220px, 1fr));
          gap: 8px;
          align-items: stretch;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        @media (max-width: 1180px) {
          .engine27-v2-summary {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .engine27-v2-summary {
            grid-template-columns: minmax(0,1fr) !important;
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
          <div style={{ color: "#f8fafc", fontSize: 20, fontWeight: 1000 }}>
            ENGINE 27 — TRADER INTELLIGENCE
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900, marginTop: 2 }}>
            {showWorking ? "Seven current owner working interpretations — Engine 22 authority preserved" : "Legacy Engine 27 V2 interpretation — Engine 22 authority preserved"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <SmallBadge text="READ ONLY" tone="#334155" />
          <SmallBadge text={showWorking ? "7 DEGREES" : "6 DEGREES"} tone="#1d4ed8" />
          <SmallBadge text="NO EXECUTION" tone="#7f1d1d" />
        </div>
      </div>

      {showWorking ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr 2fr",gap:7}}>
          <Cell label="CURRENT WAVE ALIGNMENT" value={pretty(workingSeven?.workingAlignment?.alignmentState)} tone="#fbbf24" />
          <Cell label="CONFIDENCE" value={pretty(workingSeven?.workingAlignment?.confidence)} detail="Historical calibration not yet published" tone="#fbbf24" />
          <Cell label="MARKET STORY" value={workingSeven?.workingAlignment?.marketStory || "Current story unavailable"} />
          <Cell label="WARNINGS" value={(workingSeven?.workingAlignment?.warnings || []).map(pretty).join(" • ") || "No published working-count warnings"} tone="#fbbf24" />
        </div>
      ) : <div className="engine27-v2-summary"><Summary engine27={engine27} /></div>}
      {showWorking ? (
        <div style={{color:"#fbbf24",fontSize:12,fontWeight:800,padding:8,border:"1px solid #92400e",borderRadius:7}}>
          CURRENT ENGINE 22 WORKING STRUCTURE — {currentInterpretation.degreeOrder.map(degree => `${degree.toUpperCase()}: ${currentInterpretation.degrees?.[degree]?.activeWave || "NOT PUBLISHED"} ${currentInterpretation.degrees?.[degree]?.waveDirection || ""}`).join(" | ")}. Working counts are not confirmed completions. Legacy account-thesis readings below are compatibility context pending separate synchronization, not current directional authority.
        </div>
      ) : null}

      <SeparateStrategyAlignments
        snapshot={snapshot}
        workingSeven={showWorking ? workingSeven : null}
        performanceSections={performanceSections}
        invalidations={invalidations}
        marketContext={marketContext}
        reactions={reactions}
      />

      <div className="engine27-v2-grid">
        {DEGREE_ORDER.map((degree) => (
          <DegreeCard
            key={degree}
            degree={degree}
            data={currentInterpretation?.degrees?.[degree] || null}
          />
        ))}
      </div>
    </div>
  );
}
