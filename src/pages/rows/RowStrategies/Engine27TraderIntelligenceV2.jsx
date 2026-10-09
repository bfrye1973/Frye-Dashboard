// src/pages/rows/RowStrategies/Engine27TraderIntelligenceV2.jsx
// Engine 27 V2 — six-degree trader intelligence presentation.
// Read-only. Consumes additive backend contract:
// snapshot.engine27Strategies.engine27TraderIntelligenceV2
//
// Existing Engine 27A–27E production contracts remain untouched.

import React from "react";

const DEGREE_ORDER = [
  "micro",
  "subminute",
  "minute",
  "minor",
  "intermediate",
  "primary",
];

const LABELS = {
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
  if (c.includes("LOCKED") || c.includes("CONFIRMED")) return "#22c55e";
  if (c.includes("CANDIDATE") || c.includes("PENDING") || c.includes("DEVELOP")) return "#f59e0b";
  if (c.includes("FAILED") || c.includes("INVALID")) return "#ef4444";
  return "#3b82f6";
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
              border: "1px solid rgba(34,197,94,.20)",
              borderRadius: 7,
              background: "#071008",
              padding: "5px 6px",
              minWidth: 0,
            }}
          >
            <div style={{ color: "#86efac", fontSize: 9, fontWeight: 1000 }}>
              {level?.label || "Level"}
            </div>
            <div style={{ color: "#f8fafc", fontSize: 12, fontWeight: 1000 }}>
              {price(level?.price)}
            </div>
            {level?.status ? (
              <div style={{ color: "#94a3b8", fontSize: 9, fontWeight: 800 }}>
                {pretty(level.status)}
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
        <div style={{ color: "#86efac", fontSize: 10, fontWeight: 1000, marginBottom: 5 }}>
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
          SOURCE: {pretty(provenance?.structuralSource)}
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
  const engine27 = snapshot?.engine27Strategies || null;
  const v2 = engine27?.engine27TraderIntelligenceV2 || null;

  if (!v2 || !v2?.degrees) return null;

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
          grid-template-columns: repeat(6, minmax(220px, 1fr));
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
            ENGINE 27 — TRADER INTELLIGENCE V2
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900, marginTop: 2 }}>
            Six-degree Elliott Wave interpretation — Engine 22 structural authority preserved
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <SmallBadge text="READ ONLY" tone="#334155" />
          <SmallBadge text="6 DEGREES" tone="#1d4ed8" />
          <SmallBadge text="NO EXECUTION" tone="#7f1d1d" />
        </div>
      </div>

      <div className="engine27-v2-summary">
        <Summary engine27={engine27} />
      </div>

      <div className="engine27-v2-grid">
        {DEGREE_ORDER.map((degree) => (
          <DegreeCard
            key={degree}
            degree={degree}
            data={v2?.degrees?.[degree] || null}
          />
        ))}
      </div>
    </div>
  );
}
