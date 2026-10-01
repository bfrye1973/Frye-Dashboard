// src/pages/redline/WaveDegreesPage.jsx
// Redline Wave Degrees page.
// Reuses the canonical combined RowStrategies presentation so Engine 22 Wave Degrees
// and Engine 27 Trader Intelligence stay together and read the same live snapshot.

import React from "react";
import RowStrategies from "../rows/RowStrategies";
import { useDashboardSnapshot } from "../../hooks/useDashboardSnapshot";

function fmtLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function clean(value, fallback = "—") {
  const s = String(value ?? "").trim();
  return s ? s.replaceAll("_", " ") : fallback;
}

function KV({ label, value, color = "#f8fafc" }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "5px 0",
        borderBottom: "1px solid rgba(148,163,184,.10)",
        fontSize: 12,
      }}
    >
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <strong style={{ color, textAlign: "right" }}>{value}</strong>
    </div>
  );
}

export default function WaveDegreesPage() {
  const qs = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );

  const candidateId = qs.get("candidateId") || "";
  const strategyId = qs.get("strategyId") || "";
  const setupClass = qs.get("setupClass") || "";
  const symbol = (qs.get("symbol") || "ES").toUpperCase();
  const tf = qs.get("tf") || "10m";

  const { data: snapshot } = useDashboardSnapshot(symbol, {
    pollMs: 20000,
    timeoutMs: 20000,
    includeContext: 1,
  });

  const strategyNode =
    snapshot?.strategies?.["intraday_scalp@10m"] || null;

  const engine26Candidate =
    strategyNode?.engine26LocationCandidate || null;

  const engine26Geometry =
    strategyNode?.engine26ProposedGeometry || null;

  const engine26Zone =
    engine26Candidate?.entryZone ||
    engine26Candidate?.zone ||
    engine26Candidate?.location ||
    null;

  const zoneLow =
    engine26Zone?.low ??
    engine26Zone?.lo ??
    null;

  const zoneHigh =
    engine26Zone?.high ??
    engine26Zone?.hi ??
    null;

  const zoneText =
    Number.isFinite(Number(zoneLow)) &&
    Number.isFinite(Number(zoneHigh))
      ? `${fmtLevel(zoneLow)}–${fmtLevel(zoneHigh)}`
      : "—";

  const direction =
    engine26Candidate?.currentObservationDirection ||
    engine26Candidate?.direction ||
    "NEUTRAL";

  const plannerReady =
    engine26Geometry?.geometryReady === true ||
    (
      engine26Geometry?.active === true &&
      String(engine26Geometry?.lifecycleStatus || "").toUpperCase() ===
        "PROPOSED_GEOMETRY_AVAILABLE"
    );

  const targets =
    Array.isArray(engine26Geometry?.proposedTargets)
      ? engine26Geometry.proposedTargets
      : [];

  return (
    <div style={{ maxWidth: 1900, margin: "0 auto", minWidth: 0 }}>
      <div
        style={{
          border: "1px solid rgba(239,68,68,.24)",
          borderLeft: "4px solid #ef4444",
          borderRadius: 12,
          padding: "12px 14px",
          background:
            "linear-gradient(90deg, rgba(127,29,29,.16), rgba(10,13,17,.96) 32%)",
          marginBottom: 14,
        }}
      >
        <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>
          STRATEGIES
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
          Engine22 Wave Degrees and Engine27 Trader Intelligence in one synchronized strategy view.
        </div>
      </div>

      {candidateId ? (
        <div
          style={{
            border: "1px solid rgba(251,191,36,.34)",
            background: "rgba(120,53,15,.14)",
            borderRadius: 12,
            padding: "10px 12px",
            marginBottom: 14,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <strong style={{ color: "#fde68a" }}>
            LINKED ENGINE26 SETUP
          </strong>
          <span style={{ color: "#f8fafc", fontWeight: 900 }}>
            {candidateId}
          </span>
          <span style={{ color: "#94a3b8" }}>
            {symbol} · {tf}
          </span>
          {strategyId ? (
            <span style={{ color: "#94a3b8" }}>
              {strategyId}
            </span>
          ) : null}
          {setupClass ? (
            <span style={{ color: "#94a3b8" }}>
              {setupClass.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid rgba(148,163,184,.16)",
          borderRadius: 14,
          background: "rgba(7,10,14,.92)",
          padding: 10,
          overflowX: "auto",
        }}
      >
        <RowStrategies />
      </div>

      <div
        style={{
          marginTop: 14,
          border: "1px solid rgba(251,191,36,.32)",
          borderTop: "3px solid #fbbf24",
          borderRadius: 14,
          background:
            "linear-gradient(180deg, rgba(49,32,8,.24), rgba(7,10,14,.98) 26%)",
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <div
              style={{
                color: "#f8fafc",
                fontSize: 18,
                fontWeight: 1000,
              }}
            >
              ENGINE 26 — LOCATION / PLANNER
            </div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: 12,
                marginTop: 3,
              }}
            >
              Setup location and proposed geometry. Engine6 remains final permission.
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${plannerReady ? "#22c55e" : "#fbbf24"}`,
              color: plannerReady ? "#86efac" : "#fde68a",
              borderRadius: 999,
              padding: "5px 9px",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {plannerReady
              ? "PLAN READY"
              : clean(engine26Geometry?.lifecycleStatus || "WAITING").toUpperCase()}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(251,191,36,.20)",
              borderRadius: 10,
              padding: 11,
              background: "rgba(15,23,42,.42)",
            }}
          >
            <div style={{ color: "#fbbf24", fontWeight: 900, marginBottom: 7 }}>
              LOCATION
            </div>
            <KV label="Candidate ID" value={engine26Candidate?.candidateId || "—"} />
            <KV label="Setup Class" value={clean(engine26Candidate?.setupClass)} />
            <KV
              label="Direction"
              value={clean(direction).toUpperCase()}
              color={String(direction).toUpperCase() === "SHORT" ? "#f87171" : String(direction).toUpperCase() === "LONG" ? "#86efac" : "#fbbf24"}
            />
            <KV label="Entry / Alarm Zone" value={zoneText} />
            <KV label="Setup Grade" value={clean(engine26Candidate?.setupGrade)} />
          </div>

          <div
            style={{
              border: "1px solid rgba(56,189,248,.20)",
              borderRadius: 10,
              padding: 11,
              background: "rgba(15,23,42,.42)",
            }}
          >
            <div style={{ color: "#7dd3fc", fontWeight: 900, marginBottom: 7 }}>
              PROPOSED GEOMETRY
            </div>
            <KV label="Entry" value={fmtLevel(engine26Geometry?.proposedEntryPrice)} />
            <KV label="Stop" value={fmtLevel(engine26Geometry?.proposedStopPrice)} color="#f87171" />
            <KV label="Risk Distance" value={Number.isFinite(Number(engine26Geometry?.proposedStopDistancePoints)) ? `${fmtLevel(engine26Geometry?.proposedStopDistancePoints)} pts` : "—"} />
            <KV label="Lifecycle" value={clean(engine26Geometry?.lifecycleStatus)} />
            <KV label="Proposal Only" value={engine26Geometry?.proposalOnly === true ? "YES" : "—"} />
          </div>

          <div
            style={{
              border: "1px solid rgba(34,197,94,.20)",
              borderRadius: 10,
              padding: 11,
              background: "rgba(15,23,42,.42)",
            }}
          >
            <div style={{ color: "#86efac", fontWeight: 900, marginBottom: 7 }}>
              TARGET MAP
            </div>
            {targets.length ? (
              targets.slice(0, 4).map((target, index) => (
                <KV
                  key={target?.id || target?.label || index}
                  label={target?.label || `Target ${index + 1}`}
                  value={fmtLevel(target?.price ?? target?.level ?? target)}
                  color="#86efac"
                />
              ))
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 12 }}>
                No proposed targets attached yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
