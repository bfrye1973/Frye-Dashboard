// src/pages/rows/RowStrategies/index.jsx
// Engine 27F — Strategy Timeline Presentation
//
// Read-only frontend contract:
// - consumes selectedStrategy.strategyTimeline
// - does not recalculate readiness, blockers, stage status,
//   identity, geometry, executability, or next action
// - Minute is live first; other tabs remain unavailable until
//   their own backend strategyTimeline objects exist

import React, { useMemo, useState } from "react";
import { useDashboardSnapshot } from "../../../hooks/useDashboardSnapshot";

const AZ_TZ = "America/Phoenix";
const POLL_MS = 20000;
const TIMEOUT_MS = 20000;
const DASHBOARD_SYMBOL = "ES";

const LANES = [
  { laneId: "subminute", label: "SUBMINUTE", strategyId: "subminute_scalp@10m" },
  { laneId: "minute", label: "MINUTE", strategyId: "intraday_scalp@10m" },
  { laneId: "minor", label: "MINOR", strategyId: "minor_swing@1h" },
  { laneId: "intermediate", label: "INTERMEDIATE", strategyId: "intermediate_long@4h" },
  { laneId: "primary", label: "PRIMARY", strategyId: "primary_position@1d" },
];

const APPROVED_STAGE_STATUSES = new Set([
  "COMPLETE",
  "ACTIVE",
  "WATCHING",
  "WAITING",
  "BLOCKED",
  "READY",
  "NOT_REQUIRED",
  "NOT_ENABLED",
  "INVALIDATED",
]);

function upper(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text ? text.toUpperCase() : fallback;
}

function prettyEnum(value, fallback = "—") {
  const text = upper(value, "");
  return text ? text.replaceAll("_", " ") : fallback;
}

function fmtPrice(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "—";
}

function toAZ(iso, withSeconds = false) {
  if (!iso) return "—";
  try {
    return (
      new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: withSeconds ? "2-digit" : undefined,
        timeZone: AZ_TZ,
      }) + " AZ"
    );
  } catch {
    return "—";
  }
}

function snapshotTime(snapshot) {
  return toAZ(snapshot?.now || snapshot?.ts || null, true);
}

function openFullStrategies(symbol = "ES") {
  const url = `/strategies-full?symbol=${encodeURIComponent(symbol)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function toneForStatus(status) {
  const value = upper(status, "WAITING");
  if (["READY", "COMPLETE"].includes(value)) return "green";
  if (value === "ACTIVE") return "blue";
  if (value === "WATCHING") return "cyan";
  if (value === "WAITING") return "gray";
  if (["BLOCKED", "INVALIDATED"].includes(value)) return "red";
  if (value === "NOT_REQUIRED") return "purple";
  if (value === "NOT_ENABLED") return "slate";
  return "gray";
}

function toneForDirection(direction) {
  const value = upper(direction, "NEUTRAL");
  if (value === "LONG") return "green";
  if (value === "SHORT") return "red";
  return "gray";
}

function toneForState(state) {
  const value = upper(state, "IDLE");
  if (value === "READY") return "green";
  if (value === "ALMOST_READY") return "amber";
  if (value === "APPROACHING") return "cyan";
  if (value === "SETTING_UP") return "blue";
  if (value === "INVALIDATED") return "red";
  return "gray";
}

function palette(tone) {
  const map = {
    green: { bg: "#0b2a17", border: "#166534", color: "#86efac" },
    blue: { bg: "#0b1f3a", border: "#1d4ed8", color: "#93c5fd" },
    cyan: { bg: "#082f3a", border: "#0e7490", color: "#67e8f9" },
    amber: { bg: "#3a2606", border: "#b45309", color: "#fcd34d" },
    red: { bg: "#350b0b", border: "#991b1b", color: "#fca5a5" },
    purple: { bg: "#24103d", border: "#7e22ce", color: "#d8b4fe" },
    slate: { bg: "#111827", border: "#334155", color: "#cbd5e1" },
    gray: { bg: "#111318", border: "#374151", color: "#d1d5db" },
  };
  return map[tone] || map.gray;
}

function Badge({ text, tone = "gray", small = false }) {
  const colors = palette(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.color,
        padding: small ? "3px 7px" : "5px 9px",
        fontSize: small ? 11 : 12,
        fontWeight: 1000,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function RibbonItem({ label, value, tone = "gray" }) {
  const colors = palette(tone);
  return (
    <div
      style={{
        minWidth: 0,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        background: colors.bg,
        padding: "9px 10px",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 1000, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: colors.color, fontSize: 14, fontWeight: 1000, lineHeight: 1.15, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function TabButton({ lane, active, available, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? "1px solid #2563eb" : "1px solid #263244",
        borderRadius: 10,
        background: active ? "#10254a" : "#0d131d",
        color: active ? "#bfdbfe" : available ? "#e5e7eb" : "#64748b",
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 1000,
        cursor: "pointer",
        minWidth: 110,
      }}
    >
      {lane.label}
      <span style={{ display: "block", marginTop: 3, fontSize: 9, color: available ? "#86efac" : "#64748b" }}>
        {available ? "LIVE" : "NOT AVAILABLE"}
      </span>
    </button>
  );
}

function SectionBox({ title, children, tone = "default" }) {
  const border = tone === "danger" ? "#7f1d1d" : tone === "warning" ? "#92400e" : "#263244";
  const background = tone === "danger" ? "#190909" : tone === "warning" ? "#1d1407" : "#0a0f18";
  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 12, background, padding: 10, minWidth: 0 }}>
      <div style={{ color: tone === "danger" ? "#fca5a5" : tone === "warning" ? "#fbbf24" : "#93c5fd", fontSize: 12, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 7 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TextList({ values, empty = "None" }) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!items.length) {
    return <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{empty}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {items.map((item, index) => (
        <div key={`${String(item)}-${index}`} style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 900, lineHeight: 1.25 }}>
          • {prettyEnum(item)}
        </div>
      ))}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "115px minmax(0,1fr)", gap: 8, alignItems: "start" }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900 }}>{label}</div>
      <div style={{ color: "#f8fafc", fontSize: 12, fontWeight: 1000, lineHeight: 1.25, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function TimelineStageCard({ stage, index }) {
  const status = APPROVED_STAGE_STATUSES.has(upper(stage?.status, "")) ? upper(stage?.status) : "WAITING";
  const colors = palette(toneForStatus(status));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr)", gap: 8, minWidth: 0 }}>
      <div style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 1000, marginTop: 2 }}>
        {index + 1}
      </div>
      <div style={{ border: `1px solid ${colors.border}`, borderLeft: `4px solid ${colors.border}`, borderRadius: 12, background: "#0b1018", padding: 10, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 7 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#f8fafc", fontSize: 14, fontWeight: 1000 }}>{stage?.label || prettyEnum(stage?.id)}</div>
            <div style={{ color: colors.color, fontSize: 12, fontWeight: 1000, marginTop: 2, lineHeight: 1.2 }}>{stage?.headline || "No headline"}</div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <Badge text={status} tone={toneForStatus(status)} />
            <Badge text={stage?.sourceEngine || "UNKNOWN"} tone="slate" small />
          </div>
        </div>
        <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 800, lineHeight: 1.35, marginBottom: 8 }}>
          {stage?.detail || "No detail available."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 6 }}>
          <KV label="Candidate" value={stage?.candidateId || "—"} />
          <KV label="Zone" value={stage?.zoneId || "—"} />
          <KV label="Updated" value={toAZ(stage?.updatedAt, true)} />
          <KV label="Reason Codes" value={Array.isArray(stage?.reasonCodes) && stage.reasonCodes.length ? stage.reasonCodes.map(prettyEnum).join(" • ") : "None"} />
        </div>
      </div>
    </div>
  );
}

function IdentityPanel({ timeline }) {
  return (
    <SectionBox title="Minute Identity">
      <div style={{ display: "grid", gap: 6 }}>
        <KV label="Strategy" value={timeline?.strategyId || "—"} />
        <KV label="Candidate" value={timeline?.candidateId || "—"} />
        <KV label="Zone" value={timeline?.zoneId || "—"} />
        <KV label="Symbol" value={timeline?.symbol || "—"} />
        <KV label="Setup Type" value={prettyEnum(timeline?.setupType)} />
        <KV label="Snapshot" value={toAZ(timeline?.snapshotTime, true)} />
      </div>
    </SectionBox>
  );
}

function ReadinessPanel({ readiness }) {
  const entries = Object.entries(readiness || {});
  return (
    <SectionBox title="Readiness">
      {entries.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 6 }}>
          {entries.map(([key, value]) => (
            <div key={key} style={{ border: "1px solid #263244", borderRadius: 8, padding: "6px 7px", background: "#0b1018" }}>
              <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900, marginBottom: 3 }}>{prettyEnum(key)}</div>
              <Badge text={value === true ? "YES" : value === false ? "NO" : "—"} tone={value === true ? "green" : value === false ? "gray" : "slate"} small />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>No readiness object available.</div>
      )}
    </SectionBox>
  );
}

function LocationPanel({ location }) {
  return (
    <SectionBox title="Location">
      <div style={{ display: "grid", gap: 6 }}>
        <KV label="Source" value={location?.source || "—"} />
        <KV label="State" value={prettyEnum(location?.priceLocation)} />
        <KV label="Current Price" value={fmtPrice(location?.currentPrice)} />
        <KV label="Zone" value={location?.lo != null && location?.hi != null ? `${fmtPrice(location.lo)}–${fmtPrice(location.hi)}` : "—"} />
        <KV label="Mid" value={fmtPrice(location?.mid)} />
        <KV label="Distance" value={location?.distancePoints != null ? `${location.distancePoints} pts` : "—"} />
        <KV label="Invalidation" value={fmtPrice(location?.invalidationLevel)} />
      </div>
    </SectionBox>
  );
}

function LevelsPanel({ levels }) {
  const proposedTargets = Array.isArray(levels?.proposedTargets) ? levels.proposedTargets : [];
  const officialTargets = Array.isArray(levels?.officialTargets) ? levels.officialTargets : [];
  const targetText = (targets) =>
    targets.length
      ? targets.map((target) => {
          if (typeof target === "number") return fmtPrice(target);
          return target?.price != null ? `${target?.targetId || target?.label || "T"} ${fmtPrice(target.price)}` : prettyEnum(target);
        }).join(" • ")
      : "—";

  return (
    <SectionBox title="Levels">
      <div style={{ display: "grid", gap: 6 }}>
        <KV label="Current Price" value={fmtPrice(levels?.currentPrice)} />
        <KV label="Zone" value={levels?.zoneLow != null && levels?.zoneHigh != null ? `${fmtPrice(levels.zoneLow)}–${fmtPrice(levels.zoneHigh)}` : "—"} />
        <KV label="Invalidation" value={fmtPrice(levels?.invalidation)} />
        <KV label="Proposed Entry" value={fmtPrice(levels?.proposedEntry)} />
        <KV label="Proposed Stop" value={fmtPrice(levels?.proposedStop)} />
        <KV label="Proposed Targets" value={targetText(proposedTargets)} />
        <KV label="Official Entry" value={fmtPrice(levels?.officialEntry)} />
        <KV label="Official Stop" value={fmtPrice(levels?.officialStop)} />
        <KV label="Official Targets" value={targetText(officialTargets)} />
        <KV label="Next Fib" value={levels?.nextFib ? `${prettyEnum(levels.nextFib)} @ ${fmtPrice(levels?.nextFibPrice)}` : "—"} />
      </div>
    </SectionBox>
  );
}

function TimelineUnavailable({ lane }) {
  return (
    <div style={{ border: "1px solid #263244", borderRadius: 14, background: "#0b0f16", padding: 18, color: "#94a3b8", textAlign: "center" }}>
      <div style={{ color: "#e5e7eb", fontSize: 16, fontWeight: 1000, marginBottom: 6 }}>{lane.label} timeline unavailable</div>
      <div style={{ fontSize: 12, fontWeight: 800 }}>Backend strategyTimeline has not been attached for this lane.</div>
    </div>
  );
}

function StrategyTimelineView({ timeline }) {
  const stages = Array.isArray(timeline?.stages) ? timeline.stages : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="engine27f-ribbon" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 8 }}>
        <RibbonItem label="State" value={prettyEnum(timeline?.state)} tone={toneForState(timeline?.state)} />
        <RibbonItem label="Readiness" value={timeline?.readiness?.invalidated === true ? "INVALIDATED" : timeline?.state === "READY" ? "READY" : "BUILDING"} tone={toneForState(timeline?.state)} />
        <RibbonItem label="Bias" value={prettyEnum(timeline?.direction)} tone={toneForDirection(timeline?.direction)} />
        <RibbonItem label="Alignment" value={timeline?.warnings?.includes("HIGHER_TIMEFRAME_WICK_CONFLICT") ? "CONFLICT" : "NO BLOCKING CONFLICT"} tone={timeline?.warnings?.includes("HIGHER_TIMEFRAME_WICK_CONFLICT") ? "amber" : "gray"} />
        <RibbonItem label="Current Wave" value={timeline?.internalWave && upper(timeline.internalWave) !== "UNKNOWN" ? `${timeline.currentWave || "—"} / ${timeline.internalWave}` : timeline?.currentWave || "—"} tone="blue" />
        <RibbonItem label="Next Action" value={prettyEnum(timeline?.nextAction)} tone="cyan" />
      </div>

      <div className="engine27f-main-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) minmax(280px,.8fr)", gap: 10, alignItems: "start" }}>
        <div style={{ border: "1px solid #263244", borderRadius: 14, background: "#070c13", padding: 10, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#f8fafc", fontSize: 18, fontWeight: 1000 }}>{timeline?.displayName || "Minute"} Strategy Timeline</div>
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800, marginTop: 2 }}>{timeline?.triggerTimeframe || "—"} trigger • {timeline?.contextTimeframe || "—"} context</div>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <Badge text={timeline?.executable === true ? "EXECUTABLE" : "NO EXECUTION"} tone={timeline?.executable === true ? "green" : "gray"} />
              <Badge text={prettyEnum(timeline?.direction)} tone={toneForDirection(timeline?.direction)} />
            </div>
          </div>
          {stages.map((stage, index) => (
            <TimelineStageCard key={stage?.id || index} stage={stage} index={index} />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <IdentityPanel timeline={timeline} />
          <ReadinessPanel readiness={timeline?.readiness} />
          <LocationPanel location={timeline?.location} />
          <LevelsPanel levels={timeline?.levels} />
          <SectionBox title="Waiting For"><TextList values={timeline?.waitingFor} /></SectionBox>
          <SectionBox title="Blockers" tone={Array.isArray(timeline?.blockers) && timeline.blockers.length ? "danger" : "default"}><TextList values={timeline?.blockers} /></SectionBox>
          <SectionBox title="Warnings" tone={Array.isArray(timeline?.warnings) && timeline.warnings.length ? "warning" : "default"}><TextList values={timeline?.warnings} /></SectionBox>
        </div>
      </div>
    </div>
  );
}

export default function RowStrategies() {
  const { data: snapshot, err, lastFetch, refreshing, hasData } = useDashboardSnapshot(DASHBOARD_SYMBOL, {
    pollMs: POLL_MS,
    timeoutMs: TIMEOUT_MS,
    includeContext: 1,
  });

  const [selectedLaneId, setSelectedLaneId] = useState("minute");

  const laneData = useMemo(() => {
    return Object.fromEntries(
      LANES.map((lane) => {
        const strategy = snapshot?.strategies?.[lane.strategyId] || null;
        return [lane.laneId, { lane, strategy, timeline: strategy?.strategyTimeline || null }];
      })
    );
  }, [snapshot]);

  const selectedEntry = laneData[selectedLaneId] || laneData.minute || null;
  const selectedStrategy = selectedEntry?.strategy || null;
  const selectedTimeline = selectedStrategy?.strategyTimeline || null;

  return (
    <section id="row-5" className="panel" style={{ padding: 10 }}>
      <style>{`
        @media (max-width: 1180px) {
          .engine27f-main-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .engine27f-ribbon { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 720px) {
          .engine27f-ribbon { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>

      <div className="panel-head" style={{ alignItems: "center", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="panel-title" style={{ fontSize: 17, fontWeight: 1000, color: "#f8fafc" }}>Engine 27 — Strategy Timeline</div>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800, marginTop: 2 }}>Presentation only — selectedStrategy.strategyTimeline</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ color: "#9ca3af", fontSize: 11, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span>Symbol: <b style={{ color: "#e5e7eb" }}>{snapshot?.symbol || "—"}</b></span>
          <span>Backend: <b style={{ color: "#e5e7eb" }}>{snapshotTime(snapshot)}</b></span>
          <span>Frontend: <b style={{ color: "#e5e7eb" }}>{lastFetch ? toAZ(lastFetch, true) : "—"}</b>{refreshing ? <span style={{ marginLeft: 5, color: "#fbbf24" }}>refreshing…</span> : null}</span>
          <button type="button" onClick={() => openFullStrategies(DASHBOARD_SYMBOL)} style={{ background: "#141414", color: "#e5e7eb", border: "1px solid #2a2a2a", borderRadius: 10, padding: "7px 11px", fontSize: 12, fontWeight: 1000, cursor: "pointer" }}>
            Open Full Strategies
          </button>
        </div>
      </div>

      {err && !hasData ? (
        <div style={{ marginTop: 8, color: "#fca5a5", fontWeight: 1000, fontSize: 12 }}>Strategy snapshot error: {err}</div>
      ) : null}

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10, marginBottom: 10 }}>
        {LANES.map((lane) => (
          <TabButton key={lane.laneId} lane={lane} active={selectedLaneId === lane.laneId} available={laneData?.[lane.laneId]?.timeline != null} onClick={() => setSelectedLaneId(lane.laneId)} />
        ))}
      </div>

      {selectedTimeline ? <StrategyTimelineView timeline={selectedTimeline} /> : <TimelineUnavailable lane={selectedEntry?.lane || LANES[1]} />}
    </section>
  );
}
