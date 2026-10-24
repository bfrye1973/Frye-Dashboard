// src/pages/rows/RowStrategies/Engine27TraderIntelligenceV2.jsx
// Engine 27 V2 — six-degree trader intelligence presentation.
// Read-only. Consumes additive backend contract:
// snapshot.engine27Strategies.engine27TraderIntelligenceV2
//
// Existing Engine 27A–27E production contracts remain untouched.

import React from "react";

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
function CurrentWorkingAlignmentCard({ degree, read }) {
  const direction = read?.available ? read.waveDirection : "NOT_PUBLISHED";
  const tone = toneForDirection(direction);
  return (
    <div style={{background:"#0a1018",border:"1px solid #334155",borderTop:`4px solid ${tone}`,borderRadius:10,padding:9,minWidth:0,display:"grid",gap:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
        <strong style={{fontSize:12,color:"#e2e8f0"}}>{degree.toUpperCase()} ALIGNMENT</strong>
        <SmallBadge text="WORKING" tone="#92400e" />
      </div>
      <Cell label="Wave / direction" value={`${pretty(read?.activeWave)} • ${pretty(direction)}`} tone={tone} />
      <Cell label="Schwab strategy account" value={`••••${CURRENT_ACCOUNT_ENDINGS[degree]}`} detail="Account identity only — live position/thesis not reclassified" />
      <Cell label="Structural state" value={pretty(read?.currentCondition)} tone="#fbbf24" />
      <Cell label="Confirmation" value={pretty(read?.confirmationNeeded?.status)} tone="#fbbf24" />
      <div style={{fontSize:10,color:"#cbd5e1"}}>{read?.traderRead?.summary || "Engine 22 current model unavailable"}</div>
    </div>
  );
}
function SeparateStrategyAlignments({ snapshot, workingSeven = null }) {
  if (workingSeven?.engine === "engine27.workingSevenDegrees.v1") {
    return (
      <div style={{display:"grid",gap:7}}>
        <div style={{fontSize:11,color:"#cbd5e1",fontWeight:1000}}>SEVEN CURRENT STRUCTURAL STRATEGY ALIGNMENTS — READ ONLY</div>
        <div className="engine27-strategy-alignment-grid">
          {workingSeven.degreeOrder.map(degree => (
            <CurrentWorkingAlignmentCard key={degree} degree={degree} read={workingSeven.degrees?.[degree]} />
          ))}
        </div>
        <div style={{color:"#fbbf24",fontSize:10}}>Seven current structural reads do not infer broker positions or rewrite legacy thesis states. Existing account monitoring remains available below.</div>
        <details style={{border:"1px solid #334155",borderRadius:8,padding:7}}>
          <summary style={{cursor:"pointer",color:"#94a3b8",fontSize:11,fontWeight:900}}>LEGACY SIX-ROLE POSITION & THESIS MONITORING — expand for original records</summary>
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
