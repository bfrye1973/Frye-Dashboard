// src/pages/engine29/Engine29FullDashboard.jsx
// Engine 29 — Market Character full dashboard.
// Reorganized Presentation V1 using Engine 29 canonical backend truth.
//
// Preserved behavior:
// - existing API read routes
// - 15-second persisted reads
// - Close behavior
// - original detailed group / symbol evidence under SHOW RAW EVIDENCE
//
// Authority reminder:
// - 1W structural
// - 1H tactical
// - 30m fast tactical
// - 10m live monitor / 20m persistence is diagnostic only

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ROUTE = `${API_ROOT}/api/v1/engine29/cross-market-stress`;
const SUMMARY_ROUTE = `${API_ROOT}/api/v1/engine29/cross-market-stress/summary`;

const FONT = "Arial, Helvetica, sans-serif";
const READ_POLL_MS = 15_000;

const COLORS = {
  good: "#22c55e",
  warn: "#fbbf24",
  orange: "#f97316",
  bad: "#ef4444",
  severe: "#b91c1c",
  info: "#60a5fa",
  cyan: "#22d3ee",
  purple: "#c084fc",
  muted: "#94a3b8",
  text: "#e2e8f0",
  panel: "rgba(15,23,42,0.78)",
  line: "rgba(148,163,184,0.22)",
};

function clean(value) {
  return String(value ?? "—").replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function num(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function pct(value, digits = 2, signed = true) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${signed && n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function points(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)} pts` : "—";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function rawMoveCharacter(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return (
      value.moveCharacter ||
      value.character ||
      value.status ||
      value.display?.status ||
      value.display?.moveCharacter ||
      null
    );
  }
  return null;
}

function plainOverall(value) {
  const text = String(value || "").toUpperCase();
  if (text === "NORMAL") return "HEALTHY / NORMAL";
  if (text === "EARLY_WARNING") return "EARLY WARNING";
  if (text === "BROAD_DETERIORATION") return "BROAD DETERIORATION";
  if (text === "RISK_OFF_CONFIRMED") return "RISK-OFF CONFIRMED";
  if (text === "SYSTEMIC_STRESS") return "SYSTEMIC STRESS";
  return clean(value);
}

function plainTactical(value) {
  const text = String(value || "").toUpperCase();
  if (text === "NORMAL") return "NORMAL";
  if (text === "CAUTION") return "CAUTION";
  if (text === "RISK_OFF_ACTIVE") return "RISK-OFF ACTIVE";
  if (text === "STRESS_ACCELERATING") return "SELLING PRESSURE INCREASING";
  if (text === "RECOVERING") return "RECOVERING";
  if (text === "STABILIZING") return "STABILIZING";
  if (text === "RECOVERY_ATTEMPT") return "RECOVERY ATTEMPT";
  if (text === "BUYING_PRESSURE_INCREASING") return "BUYING PRESSURE INCREASING";
  if (text === "SELLING_PRESSURE_INCREASING") return "SELLING PRESSURE INCREASING";
  if (text === "POSSIBLE_UPSIDE_SQUEEZE") return "POSSIBLE ES UPSIDE SQUEEZE";
  if (text === "POSSIBLE_DOWNSIDE_SQUEEZE") return "POSSIBLE ES DOWNSIDE SQUEEZE";
  if (text === "LIQUIDITY_SWEEP_HIGH") return "ES LIQUIDITY SWEEP HIGH";
  if (text === "LIQUIDITY_SWEEP_LOW") return "ES LIQUIDITY SWEEP LOW";
  if (text === "BROAD_MOVE_UP") return "BROAD MOVE UP";
  if (text === "BROAD_MOVE_DOWN") return "BROAD MOVE DOWN";
  return clean(value);
}

function plainMoveCharacter(value) {
  const raw = rawMoveCharacter(value);
  const text = String(raw || "").toUpperCase();
  if (!text || text === "NO_ACTIVE_MOVE") return "NO ACTIVE MOVE";
  if (text === "POSSIBLE_UPSIDE_SQUEEZE") return "POSSIBLE UPSIDE SQUEEZE";
  if (text === "POSSIBLE_DOWNSIDE_SQUEEZE") return "POSSIBLE DOWNSIDE SQUEEZE";
  if (text === "FAILED_BREAKOUT") return "FAILED BREAKOUT";
  if (text === "FAILED_BREAKDOWN") return "FAILED BREAKDOWN";
  if (text === "BROAD_MOVE_CONFIRMED") return "BROAD MOVE CONFIRMED";
  if (text === "MIXED") return "MIXED / NO CLEAR MOVE";
  return clean(raw);
}

function plainLiveState(value) {
  const text = String(value || "").toUpperCase();
  if (text === "SQUEEZE_ACCELERATING") return "SQUEEZE ACCELERATING";
  if (text === "SQUEEZE_HOLDING") return "SQUEEZE HOLDING";
  if (text === "SQUEEZE_WEAKENING") return "SQUEEZE WEAKENING";
  if (text === "SQUEEZE_FADING") return "SQUEEZE FADING";
  if (text === "SQUEEZE_FAILED") return "SQUEEZE FAILED";
  if (text === "UPSIDE_MOMENTUM_ACCELERATING") return "UPSIDE MOMENTUM ACCELERATING";
  if (text === "DOWNSIDE_MOMENTUM_ACCELERATING") return "DOWNSIDE MOMENTUM ACCELERATING";
  if (text === "UPSIDE_MOMENTUM_WEAKENING") return "UPSIDE MOMENTUM WEAKENING";
  if (text === "DOWNSIDE_MOMENTUM_WEAKENING") return "DOWNSIDE MOMENTUM WEAKENING";
  if (text === "COUNTERTREND_BUYING_BROADENING") return "COUNTERTREND BUYING BROADENING";
  if (text === "COUNTERTREND_SELLING_BROADENING") return "COUNTERTREND SELLING BROADENING";
  if (text === "COUNTERTREND_RALLY_FADING") return "COUNTERTREND RALLY FADING";
  if (text === "COUNTERTREND_SELLOFF_FADING") return "COUNTERTREND SELLOFF FADING";
  if (text === "BROADENING_INTO_RALLY") return "BROADENING INTO RALLY";
  if (text === "BROADENING_INTO_SELLOFF") return "BROADENING INTO SELLOFF";
  if (text === "BROAD_MOVE_NARROWING") return "BROAD MOVE NARROWING";
  if (text === "MONITORING") return "MONITORING";
  return clean(value);
}

function plainContext(value) {
  const text = String(value || "").toUpperCase();
  if (text === "COUNTERTREND_TO_30M") return "COUNTERTREND TO 30M";
  if (text === "ALIGNED_WITH_30M") return "ALIGNED WITH 30M";
  if (text === "FAST_NEUTRAL") return "30M NEUTRAL";
  if (text === "NO_LIVE_DIRECTION") return "NO LIVE DIRECTION";
  return clean(value);
}

function plainGroupState(groupKey, value) {
  const text = String(value || "").toUpperCase();
  if (!text) return "—";
  if (text === "RECOVERING") return "RECOVERING";
  if (text === "HEALTHY") return "HEALTHY";
  if (text === "SEVERE") return "SEVERE STRESS";
  if (text === "FORMING") {
    if (groupKey === "ratesDuration") return "PRESSURE BUILDING";
    if (groupKey === "energyInflation") return "STRESS BUILDING";
    if (groupKey === "volatility") return "VOLATILITY RISING";
    return "WEAKENING";
  }
  if (text === "CONFIRMED") {
    if (["breadth", "leadership", "headlineIndex"].includes(groupKey)) return "BREAKING";
    if (groupKey === "volatility") return "VOLATILITY CONFIRMED";
    return "STRESS CONFIRMED";
  }
  return clean(value);
}

function plainMissingConfirmation(value) {
  const text = String(value || "").toUpperCase();
  if (text === "CREDIT") return "Credit still needs to confirm";
  if (text === "DIRECT_VIX" || text === "VIX_DIRECT") return "Direct VIX feed";
  if (text === "SOX") return "Semiconductors / SOX";
  if (text === "BRENT") return "Brent oil";
  return clean(value);
}

function plainTrapNeed(value) {
  const text = String(value || "").toUpperCase();
  const map = {
    COMPLETED_30M_FAILED_ACCEPTANCE_NOT_CONFIRMED: "Completed 30m failed acceptance",
    "30M_1H_MOMENTUM_REPAIR_NOT_CONFIRMED": "30m / 1H momentum repair",
    MACRO_LOCATION_NOT_HIGH_QUALITY: "Higher-quality macro location",
    ENGINE25_PRIMARY_PARTICIPATION_UNAVAILABLE: "Engine25 participation data",
    ENGINE25_PRIMARY_PARTICIPATION_OPPOSES_TRAP: "Engine25 participation must stop opposing the trap",
    ENGINE25_PRIMARY_PARTICIPATION_NOT_CONFIRMED: "Engine25 breadth + volume confirmation",
    ENGINE29_SECONDARY_CONFIRMATION_OPPOSES_TRAP: "Engine29 secondary evidence must stop opposing the trap",
    ENGINE29_SECONDARY_CONFIRMATION_NOT_CONFIRMED: "Engine29 leadership / credit / financial confirmation",
  };
  return map[text] || clean(value);
}

function plainBackdrop(value) {
  const text = String(value || "").toUpperCase();
  if (text === "NEGATIVE" || text === "SEVERELY_NEGATIVE") return "NEGATIVE BACKDROP";
  if (text === "SUPPORTIVE") return "SUPPORTIVE BACKDROP";
  if (text === "NEUTRAL") return "NEUTRAL BACKDROP";
  return clean(value);
}

function plainSymbolState(value) {
  const text = String(value || "").toUpperCase();
  if (text === "WARNING") return "WEAKENING";
  if (text === "BREAKING") return "BREAKING";
  if (text === "CONFIRMED_BREAK") return "CONFIRMED BREAK";
  if (text === "RECOVERING") return "RECOVERING";
  if (text === "HEALTHY") return "HEALTHY";
  return clean(value);
}

function stateColor(value) {
  const text = String(value || "").toUpperCase();
  if (
    text.includes("FAILED") ||
    text.includes("SYSTEMIC") ||
    text.includes("RISK OFF") ||
    text.includes("RISK_OFF") ||
    text.includes("BREAKING") ||
    text.includes("CONFIRMED BREAK") ||
    text.includes("CONFIRMED_BREAK") ||
    text.includes("SELLING PRESSURE") ||
    text.includes("SELLOFF") ||
    text.includes("NEGATIVE") ||
    text.includes("OPPOSES")
  ) return COLORS.bad;

  if (
    text.includes("BROAD DETERIORATION") ||
    text.includes("BROAD_DETERIORATION") ||
    text.includes("STRESS CONFIRMED") ||
    text.includes("STRESS BUILDING") ||
    text.includes("WEAKENING") ||
    text.includes("FADING") ||
    text.includes("COUNTERTREND") ||
    text.includes("TRAP WATCH")
  ) return COLORS.orange;

  if (
    text.includes("CAUTION") ||
    text.includes("FORMING") ||
    text.includes("WARNING") ||
    text.includes("STABILIZING") ||
    text.includes("RECOVERY ATTEMPT") ||
    text.includes("NO ACTIVE") ||
    text.includes("NO LIQUIDITY") ||
    text.includes("MIXED") ||
    text.includes("WAIT") ||
    text.includes("MISSING") ||
    text.includes("NO DIRECT") ||
    text.includes("MONITORING") ||
    text.includes("PARTIAL") ||
    text.includes("NARROW") ||
    text.includes("TEST")
  ) return COLORS.warn;

  if (
    text.includes("HEALTHY") ||
    text.includes("RECOVERING") ||
    text.includes("POSITIVE") ||
    text.includes("BROAD MOVE UP") ||
    text.includes("BROAD_MOVE_CONFIRMED") ||
    text.includes("ACCELERATING") ||
    text.includes("HOLDING") ||
    text.includes("BROADENING INTO RALLY") ||
    text.includes("SUPPORTS") ||
    text.includes("CONFIRMED")
  ) return COLORS.good;

  if (text.includes("SWEEP") || text.includes("RECLAIM")) return COLORS.cyan;
  return COLORS.muted;
}

function groupStressRank(value) {
  const text = String(value || "").toUpperCase();
  if (text === "SEVERE") return 4;
  if (text === "CONFIRMED") return 3;
  if (text === "FORMING") return 2;
  if (text === "RECOVERING") return 1;
  if (text === "HEALTHY") return 0;
  return null;
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.line}`,
        borderRadius: 14,
        background: COLORS.panel,
        boxShadow: "0 8px 24px rgba(0,0,0,0.24)",
        padding: 15,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, color = "#93c5fd", right = null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 9 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          color,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {children}
      </div>
      {right}
    </div>
  );
}

function LabelValue({ label, value, color, small = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
      <span style={{ color: COLORS.muted, fontSize: small ? 11 : 13 }}>{label}</span>
      <strong style={{ color: color || stateColor(value), fontSize: small ? 12 : 13, textAlign: "right" }}>
        {value ?? "—"}
      </strong>
    </div>
  );
}

function Pill({ children, color = COLORS.warn }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 8px",
        borderRadius: 999,
        background: `${color}12`,
        border: `1px solid ${color}55`,
        color,
        fontSize: 12,
        fontWeight: 850,
      }}
    >
      {children}
    </span>
  );
}

function StateCard({ label, value, subtitle, accent }) {
  const color = accent || stateColor(value);
  return (
    <Card style={{ borderColor: `${color}66`, background: `${color}0E` }}>
      <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 7, color, fontSize: 25, lineHeight: 1.08, fontWeight: 900 }}>{clean(value)}</div>
      {subtitle ? <div style={{ marginTop: 7, color: "#cbd5e1", fontSize: 13, lineHeight: 1.35 }}>{subtitle}</div> : null}
    </Card>
  );
}

function LiveMonitorCard({ data, display }) {
  const live = data?.liveMonitor || {};
  const liveDisplay = display?.liveMonitor || live?.display || {};
  const metrics = live?.metrics || {};
  const state = live?.state || liveDisplay?.state;
  const color = stateColor(state);

  const metricItems = [
    ["Headline 10m", pct(metrics?.headline?.move10)],
    ["Headline 20m", pct(metrics?.headline?.move20)],
    ["Breadth 10m", pct(metrics?.breadth?.move10)],
    ["Breadth 20m", pct(metrics?.breadth?.move20)],
    ["Leadership 10m", pct(metrics?.leadership?.move10)],
    ["Credit 10m", pct(metrics?.credit?.move10)],
    ["Financials 10m", pct(metrics?.financials?.move10)],
    ["VIX 10m", pct(metrics?.vix?.move10)],
  ];

  return (
    <Card style={{ borderColor: `${color}66`, background: `linear-gradient(135deg, ${color}0D, rgba(15,23,42,0.90))` }}>
      <SectionTitle color={color}>10m Live Monitor — 20m Persistence</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1.0fr 1.45fr 1.2fr", gap: 16 }}>
        <div>
          <div style={{ color, fontSize: 24, fontWeight: 950 }}>{plainLiveState(state)}</div>
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <LabelValue label="Participation" value={clean(live?.participation || liveDisplay?.participation)} />
            <LabelValue label="10m vs 30m" value={plainContext(live?.context || liveDisplay?.context)} />
            <LabelValue label="30m authority" value={plainTactical(live?.fastTacticalContext?.state || liveDisplay?.parent30mState || data?.fastTacticalState)} />
            <LabelValue label="Authority" value="DIAGNOSTIC ONLY" color={COLORS.info} />
          </div>
        </div>

        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(105px, 1fr))", gap: 7 }}>
            {metricItems.map(([label, value]) => (
              <div key={label} style={{ padding: "8px 9px", borderRadius: 9, background: "rgba(2,6,23,0.35)", border: "1px solid rgba(148,163,184,0.14)" }}>
                <div style={{ color: COLORS.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>{label}</div>
                <div style={{ marginTop: 3, color: stateColor(value), fontSize: 14, fontWeight: 900 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ color: "#f8fafc", fontSize: 12, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>Why this state?</div>
          <div style={{ display: "grid", gap: 5, color: "#dbeafe", fontSize: 12.5, lineHeight: 1.35 }}>
            {asArray(liveDisplay?.why || live?.display?.why).slice(0, 5).map((reason, index) => (
              <div key={`${reason}-${index}`} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 5 }}>
                <span style={{ color }}>•</span>
                <span>{reason}</span>
              </div>
            ))}
            {!asArray(liveDisplay?.why || live?.display?.why).length ? <span style={{ color: COLORS.muted }}>Waiting for live-monitor explanation.</span> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function LiquidityCard({ liquidity }) {
  const state = liquidity?.state || "NO_LIQUIDITY_EVENT";
  const level = liquidity?.level || {};
  const sweep = liquidity?.sweep || {};
  const color = stateColor(state);

  const next = state === "NO_LIQUIDITY_EVENT"
    ? "Waiting for meaningful liquidity interaction"
    : state.startsWith("TEST_")
      ? "Watch for a meaningful sweep or rejection"
      : state.startsWith("SWEEP_")
        ? "Watch for reclaim / failed acceptance"
        : "Watch whether the auction holds or fails";

  return (
    <Card style={{ borderColor: `${color}66` }}>
      <SectionTitle color={color}>💧 Liquidity</SectionTitle>
      <div style={{ color, fontSize: 25, fontWeight: 950 }}>{clean(state)}</div>
      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        <LabelValue label="Level" value={Number.isFinite(Number(level?.boundary)) ? num(level.boundary, 2) : "—"} color="#f8fafc" />
        <LabelValue label="Type" value={clean(level?.type)} />
        <LabelValue label="Significance" value={clean(level?.significance)} />
        <LabelValue label="Auction" value={clean(liquidity?.auctionResult)} />
        <LabelValue label="Sweep amount" value={Number.isFinite(Number(sweep?.excursionPoints)) ? points(sweep.excursionPoints) : "—"} />
        <LabelValue label="Reclaim" value={liquidity?.reclaimObserved ? "YES" : "NO"} color={liquidity?.reclaimObserved ? COLORS.good : COLORS.muted} />
      </div>
      <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${COLORS.line}`, color: "#cbd5e1", fontSize: 12.5 }}>
        <strong style={{ color: COLORS.info }}>Next:</strong> {next}
      </div>
    </Card>
  );
}

function MoveCharacterCard({ move, data }) {
  const moveCharacter = move?.moveCharacter || "NO_ACTIVE_MOVE";
  const color = stateColor(moveCharacter);
  const live = data?.liveMonitor || {};
  const pressure = data?.moveCharacter?.underlyingPressure?.state || data?.display?.underTheHood?.pressure?.state;
  const squeeze = String(moveCharacter).includes("SQUEEZE") ? plainMoveCharacter(moveCharacter) : "NO SQUEEZE";

  return (
    <Card style={{ borderColor: `${color}66` }}>
      <SectionTitle color={color}>〽 Move / Squeeze</SectionTitle>
      <div style={{ color, fontSize: 25, fontWeight: 950 }}>{plainMoveCharacter(moveCharacter)}</div>
      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        <LabelValue label="Direction" value={clean(move?.direction)} />
        <LabelValue label="30m authority" value={plainTactical(data?.fastTacticalState)} />
        <LabelValue label="10m transition" value={plainLiveState(move?.fastState || live?.state)} />
        <LabelValue label="20m persistence" value={pct(live?.metrics?.es?.move20)} />
        <LabelValue label="Underlying pressure" value={clean(pressure)} />
        <LabelValue label="Squeeze" value={squeeze} />
      </div>
    </Card>
  );
}

function TrapCard({ trap, detection }) {
  const state = trap?.state || "NO_ACTIVE_TRAP";
  const side = trap?.side || "NONE";
  const color = stateColor(state);
  const auction = detection?.auctionEvent || {};
  const momentum = detection?.momentumRepair || {};
  const primary = detection?.participation?.primary || {};
  const secondary = detection?.participation?.secondary || {};
  const needs = asArray(trap?.confirmationBlockedBy);

  const primaryResult = primary?.primaryParticipationSupportsTrap
    ? "SUPPORTS"
    : primary?.primaryParticipationOpposesTrap
      ? "OPPOSES"
      : primary?.available
        ? "NEUTRAL"
        : "UNAVAILABLE";

  const secondaryResult = secondary?.secondarySupportsTrap
    ? "SUPPORTS"
    : secondary?.secondaryOpposesTrap
      ? "OPPOSES"
      : "NEUTRAL";

  return (
    <Card style={{ borderColor: `${color}66` }}>
      <SectionTitle color={color}>🎯 Trap Detection</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ color, fontSize: 25, fontWeight: 950 }}>{clean(state)}</div>
        <Pill color={side === "BEAR" ? COLORS.good : side === "BULL" ? COLORS.bad : COLORS.muted}>{clean(side)}</Pill>
      </div>
      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        <LabelValue label="Swept level" value={Number.isFinite(Number(auction?.liquidityLevel?.boundary)) ? num(auction.liquidityLevel.boundary, 2) : "—"} />
        <LabelValue label="Failed acceptance" value={auction?.failedAcceptance ? "YES" : "NO"} color={auction?.failedAcceptance ? COLORS.good : COLORS.muted} />
        <LabelValue label="Reclaim / rejection" value={auction?.reclaimObserved ? "SEEN" : "NOT CONFIRMED"} />
        <LabelValue label="30m failed hold" value={auction?.acceptance30m?.failedHold ? "YES" : "NO"} />
        <LabelValue label="Momentum repair" value={clean(momentum?.state)} />
        <LabelValue label="Engine25 participation" value={primaryResult} color={stateColor(primaryResult)} />
        <LabelValue label="Engine29 secondary" value={secondaryResult} color={stateColor(secondaryResult)} />
      </div>
      <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${COLORS.line}`, color: "#cbd5e1", fontSize: 12.5 }}>
        <strong style={{ color: COLORS.info }}>Still needs:</strong>{" "}
        {needs.length ? needs.map(plainTrapNeed).join(" · ") : state === "TRAP_CONFIRMED" ? "Nothing — confirmed" : "No active trap requirements"}
      </div>
    </Card>
  );
}

const INTERNAL_ROWS = [
  ["Indexes", "headlineIndex", "largeIndexes"],
  ["Breadth", "breadth", "breadth"],
  ["Leadership", "leadership", "techLeadership"],
  ["Credit", "credit", "credit"],
  ["Rates", "ratesDuration", "ratesBonds"],
  ["Energy", "energyInflation", "oil"],
  ["Volatility", "volatility", "volatility"],
  ["Financials", "financialConditions", "financialConditions"],
];

function MarketInternalsMap({ groups, display }) {
  const hood = display?.underTheHood || {};
  return (
    <Card>
      <SectionTitle>Market Internals Map</SectionTitle>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1.25fr 1fr 1fr 1fr 1.35fr", gap: 8, padding: "6px 8px", color: COLORS.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", borderBottom: `1px solid ${COLORS.line}` }}>
            <div>Internal</div><div>State</div><div>1W</div><div>1H</div><div>30m</div><div>Now</div>
          </div>
          {INTERNAL_ROWS.map(([label, groupKey, displayKey]) => {
            const group = groups?.[groupKey] || {};
            const structural = group?.structural?.state;
            const tactical = group?.tactical?.state;
            const fast = group?.fastTactical?.state;
            const now = hood?.[displayKey];
            return (
              <div key={groupKey} style={{ display: "grid", gridTemplateColumns: "1.35fr 1.25fr 1fr 1fr 1fr 1.35fr", gap: 8, padding: "9px 8px", alignItems: "center", borderBottom: "1px solid rgba(148,163,184,0.10)", fontSize: 13 }}>
                <div style={{ color: "#f8fafc", fontWeight: 900 }}>{label}</div>
                <div style={{ color: stateColor(structural || now), fontWeight: 900 }}>{plainGroupState(groupKey, structural || now)}</div>
                <div style={{ color: stateColor(structural) }}>{plainGroupState(groupKey, structural)}</div>
                <div style={{ color: stateColor(tactical) }}>{plainGroupState(groupKey, tactical)}</div>
                <div style={{ color: stateColor(fast) }}>{plainGroupState(groupKey, fast)}</div>
                <div style={{ color: stateColor(now), fontWeight: 850 }}>{clean(now)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function buildPresentationDivergences(groups) {
  const rank = (key) => groupStressRank(groups?.[key]?.structural?.state);
  const out = [];
  const headline = rank("headlineIndex");
  const breadth = rank("breadth");
  const leadership = rank("leadership");
  const credit = rank("credit");
  const volatility = rank("volatility");

  if (Number.isFinite(leadership) && Number.isFinite(breadth) && breadth - leadership >= 2) {
    out.push("Tech / leadership is holding up materially better than broad breadth.");
  }
  if (Number.isFinite(headline) && Number.isFinite(breadth) && breadth - headline >= 2) {
    out.push("Headline indexes are holding up better than the underlying breadth picture.");
  }
  if (Number.isFinite(headline) && Number.isFinite(breadth) && headline - breadth >= 2) {
    out.push("Breadth is holding up better than the headline indexes.");
  }
  if (Number.isFinite(credit) && Number.isFinite(headline) && credit - headline >= 2) {
    out.push("Credit stress is running ahead of the headline index condition.");
  }
  if (Number.isFinite(volatility) && Number.isFinite(headline) && volatility - headline >= 2) {
    out.push("Volatility stress is elevated relative to the headline index condition.");
  }

  return out;
}

function DivergencesCard({ groups }) {
  const items = useMemo(() => buildPresentationDivergences(groups), [groups]);
  return (
    <Card>
      <SectionTitle color="#fbbf24" right={<span style={{ color: COLORS.muted, fontSize: 10, fontWeight: 800 }}>Presentation-only synthesis</span>}>
        ⚡ Important Divergences
      </SectionTitle>
      <div style={{ display: "grid", gap: 8, color: "#e2e8f0", fontSize: 14, lineHeight: 1.4 }}>
        {items.length ? items.map((item, index) => (
          <div key={`${item}-${index}`} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 7 }}>
            <span style={{ color: COLORS.warn }}>•</span><span>{item}</span>
          </div>
        )) : <span style={{ color: COLORS.muted }}>No major presentation-only divergence flagged from current group states.</span>}
      </div>
    </Card>
  );
}

function Engine25ParticipationCard({ primary }) {
  const breadth = primary?.breadth || {};
  const stock = primary?.stockVolume || {};
  const intraday = stock?.intraday || {};
  const alignment = primary?.primaryParticipationSupportsTrap
    ? "SUPPORTS"
    : primary?.primaryParticipationOpposesTrap
      ? "OPPOSES"
      : primary?.available
        ? "NEUTRAL"
        : "UNAVAILABLE";

  return (
    <Card style={{ borderColor: primary?.authority === "ENGINE25_SCANNER_PRIMARY_READ_ONLY" ? "rgba(96,165,250,0.45)" : undefined }}>
      <SectionTitle color="#93c5fd" right={<span style={{ color: COLORS.info, fontSize: 10, fontWeight: 800 }}>READ ONLY</span>}>
        Engine25 Participation
      </SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        <LabelValue label="Breadth" value={clean(breadth?.label)} />
        <LabelValue label="Breadth score" value={Number.isFinite(Number(breadth?.score)) ? num(breadth.score, 0) : "—"} />
        <LabelValue label="Distribution" value={clean(stock?.distributionLabel)} />
        <LabelValue label="Raw pressure" value={Number.isFinite(Number(stock?.rawPressure)) ? pct(stock.rawPressure, 1, false) : "—"} />
        <LabelValue label="Declining volume" value={Number.isFinite(Number(intraday?.decliningVolumeShare)) ? pct(Number(intraday.decliningVolumeShare) * 100, 1, false) : "—"} />
        <LabelValue label="Advancing volume" value={Number.isFinite(Number(intraday?.advancingVolumeShare)) ? pct(Number(intraday.advancingVolumeShare) * 100, 1, false) : "—"} />
        <LabelValue label="Coverage" value={Number.isFinite(Number(intraday?.coveragePct)) ? pct(intraday.coveragePct, 1, false) : "—"} />
        <LabelValue label="Volume pressure" value={Number.isFinite(Number(intraday?.volumePressure)) ? pct(intraday.volumePressure, 1, false) : "—"} />
        <LabelValue label="Breadth alignment" value={clean(primary?.breadthAlignment)} />
        <LabelValue label="Volume alignment" value={clean(primary?.volumeAlignment)} />
      </div>
      <div style={{ marginTop: 10 }}>
        <Pill color={stateColor(alignment)}>Trap-side result: {alignment}</Pill>
      </div>
      <div style={{ marginTop: 9, color: COLORS.muted, fontSize: 10.5 }}>
        {primary?.authority || "ENGINE25_SCANNER_PRIMARY_READ_ONLY"}
      </div>
    </Card>
  );
}

function KeyTakeawaysCard({ data, display }) {
  const liquidity = data?.marketCharacter?.liquidity || {};
  const move = data?.marketCharacter?.move || {};
  const trap = data?.marketCharacter?.trap || {};

  return (
    <Card>
      <SectionTitle right={<span style={{ color: COLORS.muted, fontSize: 10, fontWeight: 800 }}>Presentation-only synthesis</span>}>
        Key Takeaways
      </SectionTitle>
      <div style={{ color: "#dbeafe", fontSize: 14, lineHeight: 1.5, display: "grid", gap: 7 }}>
        <div><strong>Overall:</strong> {plainOverall(display?.overall || data?.overallState)}</div>
        <div>{display?.overallSummary || "—"}</div>
        <div><strong>Liquidity:</strong> {clean(liquidity?.state || "NO_LIQUIDITY_EVENT")}</div>
        <div><strong>Move:</strong> {plainMoveCharacter(move?.moveCharacter || data?.moveCharacter?.moveCharacter)}</div>
        <div><strong>Trap:</strong> {clean(trap?.side || "NONE")} / {clean(trap?.state || "NO_ACTIVE_TRAP")}</div>
        <div><strong>ES backdrop:</strong> <span style={{ color: stateColor(data?.esNqBackdrop) }}>{plainBackdrop(data?.esNqBackdrop)}</span></div>
      </div>
    </Card>
  );
}

function MissingConfirmationCard({ data, display }) {
  const general = asArray(data?.missingConfirmations || display?.missingConfirmation);
  const trapNeeds = asArray(data?.marketCharacter?.trap?.confirmationBlockedBy);

  return (
    <Card>
      <SectionTitle color="#fbbf24">Missing Confirmation</SectionTitle>
      <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>
        General missing confirmation
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {general.length ? general.map((x) => <Pill key={`g-${x}`} color={COLORS.warn}>{plainMissingConfirmation(x)}</Pill>) : <Pill color={COLORS.good}>None</Pill>}
      </div>

      <div style={{ marginTop: 14, paddingTop: 11, borderTop: `1px solid ${COLORS.line}`, color: COLORS.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>
        Trap still needs
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {trapNeeds.length ? trapNeeds.map((x) => <Pill key={`t-${x}`} color={COLORS.orange}>{plainTrapNeed(x)}</Pill>) : <Pill color={COLORS.good}>No active trap requirements</Pill>}
      </div>
    </Card>
  );
}

function GroupCard({ title, groupKey, group, displayLabel }) {
  const structural = group?.structural || null;
  const tactical = group?.tactical || null;
  const fast = group?.fastTactical || null;
  const mainState = structural?.state || displayLabel || null;
  const color = stateColor(mainState || displayLabel);
  const members = Array.isArray(structural?.members) ? structural.members : [];

  return (
    <Card style={{ borderColor: `${color}55` }}>
      <SectionTitle color={color}>{title}</SectionTitle>
      <div style={{ display: "grid", gap: 6 }}>
        <LabelValue label="1W" value={plainGroupState(groupKey, structural?.state)} />
        <LabelValue label="1H" value={plainGroupState(groupKey, tactical?.state)} />
        <LabelValue label="30m" value={plainGroupState(groupKey, fast?.state)} />
      </div>
      {members.length > 0 && (
        <div style={{ marginTop: 10, borderTop: "1px solid rgba(148,163,184,0.16)", paddingTop: 8, display: "grid", gap: 5 }}>
          {members.slice(0, 8).map((m) => (
            <div key={m.canonicalSymbol} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
              <span style={{ color: "#cbd5e1", fontWeight: 800 }}>{m.canonicalSymbol}</span>
              <span style={{ color: stateColor(m.state), fontWeight: 850 }}>{plainSymbolState(m.state)}</span>
            </div>
          ))}
        </div>
      )}
      {structural?.dataDegraded && (
        <div style={{ marginTop: 9, color: COLORS.warn, fontSize: 11.5, lineHeight: 1.3 }}>
          Partial data{structural?.missingRequiredMembers?.length ? ` · Missing ${structural.missingRequiredMembers.join(", ")}` : ""}
        </div>
      )}
    </Card>
  );
}

function UnderHoodGrid({ display }) {
  const hood = display?.underTheHood || {};
  const items = [
    ["Large Indexes", hood.largeIndexes],
    ["Breadth", hood.breadth],
    ["Tech Leadership", hood.techLeadership],
    ["Credit", hood.credit],
    ["Rates / Bonds", hood.ratesBonds],
    ["Oil / Energy", hood.oil],
    ["Volatility", hood.volatility],
    ["Financial Conditions", hood.financialConditions],
  ];

  return (
    <Card>
      <SectionTitle>Under The Hood</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10 }}>
        {items.map(([label, value]) => (
          <div key={label} style={{ border: "1px solid rgba(148,163,184,0.17)", borderRadius: 10, padding: 10, background: "rgba(2,6,23,0.28)" }}>
            <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 850, textTransform: "uppercase" }}>{label}</div>
            <div style={{ marginTop: 5, color: stateColor(value), fontSize: 16, fontWeight: 900 }}>{clean(value)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PressureCard({ display, move }) {
  const p = display?.underTheHood?.pressure || move?.underlyingPressure || {};
  return (
    <Card>
      <SectionTitle color={stateColor(p?.state)}>30m Underlying Pressure</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(125px, 1fr))", gap: 8 }}>
        {[
          ["State", p?.state],
          ["SPY / QQQ", p?.spyQqq],
          ["Breadth", p?.breadth],
          ["Leadership", p?.leadership],
          ["Credit", p?.credit],
          ["Financials", p?.financials],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: 9, borderRadius: 9, background: "rgba(2,6,23,0.34)", border: "1px solid rgba(148,163,184,0.16)" }}>
            <div style={{ color: COLORS.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>{label}</div>
            <div style={{ marginTop: 4, color: stateColor(value), fontSize: 14, fontWeight: 900 }}>{clean(value)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EsMoveCard({ data }) {
  const move = data?.moveCharacter || data?.tacticalCharacter || data?.moveCharacterDetail || null;
  const display = data?.display || {};
  const thirty = display?.thirtyMinute || {};
  const moveCharacter = rawMoveCharacter(data?.moveCharacter) || rawMoveCharacter(move) || rawMoveCharacter(thirty?.moveCharacter) || thirty?.status;
  const moveDirection = data?.moveDirection || move?.direction;
  const pressure = move?.underlyingPressure?.state || display?.underTheHood?.pressure?.state;

  return (
    <Card style={{ borderColor: `${stateColor(moveCharacter)}66` }}>
      <SectionTitle color={stateColor(moveCharacter)}>ES Move Character</SectionTitle>
      <div style={{ fontSize: 24, fontWeight: 900, color: stateColor(moveCharacter) }}>{plainMoveCharacter(moveCharacter || thirty?.status)}</div>
      <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
        <LabelValue label="Direction" value={clean(moveDirection)} />
        <LabelValue label="Pressure" value={clean(pressure)} />
        <LabelValue label="ES contract" value={data?.dataQuality?.esResolvedSymbol || data?.esResolvedSymbol || "—"} color="#f8fafc" />
      </div>
      <div style={{ marginTop: 9, color: "#cbd5e1", fontSize: 12.5, lineHeight: 1.4 }}>{thirty?.summary || move?.display?.summary || "No move-character summary available."}</div>
    </Card>
  );
}

function SymbolEvidence({ symbols }) {
  const rows = Object.values(symbols || {});
  if (!rows.length) return null;

  return (
    <Card>
      <SectionTitle>Symbol Evidence</SectionTitle>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1050 }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 1fr 1fr 1fr 1fr", gap: 8, padding: "6px 8px", borderBottom: `1px solid ${COLORS.line}`, color: COLORS.muted, fontSize: 10.5, fontWeight: 900, textTransform: "uppercase" }}>
            <div>Symbol</div><div>Group</div><div>1W</div><div>1H</div><div>30m</div><div>Freshness</div>
          </div>
          {rows.map((entry) => (
            <div key={entry?.canonicalSymbol || entry?.sourceSymbol} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 1fr 1fr 1fr 1fr", gap: 8, padding: "7px 8px", borderBottom: "1px solid rgba(148,163,184,0.08)", fontSize: 12 }}>
              <div style={{ fontWeight: 900, color: "#f8fafc" }}>{entry?.canonicalSymbol || "—"}</div>
              <div style={{ color: "#cbd5e1" }}>{clean(entry?.group)}</div>
              <div style={{ color: stateColor(entry?.structural?.state) }}>{clean(entry?.structural?.state)}</div>
              <div style={{ color: stateColor(entry?.tactical?.state) }}>{clean(entry?.tactical?.state)}</div>
              <div style={{ color: stateColor(entry?.fastTactical?.state) }}>{clean(entry?.fastTactical?.state)}</div>
              <div style={{ color: entry?.fastTactical?.freshness?.stale ? COLORS.bad : COLORS.muted }}>{entry?.fastTactical?.freshness?.reason || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function Engine29FullDashboard({ homeCompact = false }) {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const [fullRes, summaryRes] = await Promise.all([
          fetch(`${ROUTE}?t=${Date.now()}`, { cache: "no-store" }),
          fetch(`${SUMMARY_ROUTE}?t=${Date.now()}`, { cache: "no-store" }),
        ]);

        const fullJson = await fullRes.json();
        const summaryJson = await summaryRes.json();

        if (!fullRes.ok || fullJson?.ok === false) {
          throw new Error(fullJson?.error || `Engine 29 HTTP ${fullRes.status}`);
        }

        if (!cancelled) {
          setData(fullJson?.data || fullJson);
          setSummary(summaryJson?.data || null);
          setStatus("READY");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || String(err));
          setStatus("ERROR");
        }
      }
    }

    load();

    const readTimer = setInterval(load, READ_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(readTimer);
    };
  }, []);

  const d = data || summary || {};
  const display = d?.display || summary?.display || {};
  const groups = d?.groups || {};
  const marketCharacter = d?.marketCharacter || display?.marketCharacter || {};
  const trapDetection = d?.trapDetection || {};
  const engine25Primary = trapDetection?.participation?.primary || {};

  const top = useMemo(
    () => ({
      oneWeek: display?.oneWeek?.state || d?.structuralState || d?.overallState,
      oneHour: display?.oneHour?.state || d?.tacticalState,
      thirty: display?.thirtyMinute?.state || d?.fastTacticalState,
      move: marketCharacter?.move?.moveCharacter || rawMoveCharacter(d?.moveCharacter) || rawMoveCharacter(display?.thirtyMinute?.moveCharacter) || display?.thirtyMinute?.status,
    }),
    [display, d, marketCharacter]
  );

  const updatedAt = d?.timestamp ? new Date(d.timestamp) : null;

  if (homeCompact) {
    return (
      <div
        style={{
          display: "grid",
          gap: 12,
          color: "#e5e7eb",
          fontFamily: FONT,
        }}
      >
        {status === "LOADING" && !data && (
          <Card>
            <div style={{ color: COLORS.muted }}>Loading Engine 29 market character…</div>
          </Card>
        )}

        {status === "ERROR" && (
          <Card style={{ borderColor: "rgba(239,68,68,0.45)" }}>
            <div style={{ color: "#fecaca" }}>Engine 29 dashboard error: {error}</div>
          </Card>
        )}

        {(data || summary) && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#f8fafc",
                    fontSize: 17,
                    fontWeight: 1000,
                    letterSpacing: ".04em",
                  }}
                >
                  ENGINE 29 — MARKET CHARACTER
                </div>
                <div
                  style={{
                    color: COLORS.muted,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  What kind of move is happening right now?
                </div>
              </div>

              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {updatedAt ? (
                  <Pill color={COLORS.info}>
                    Data {updatedAt.toLocaleString()}
                  </Pill>
                ) : null}
                <Pill color={d?.dataDegraded ? COLORS.warn : COLORS.good}>
                  {d?.dataDegraded ? "DATA DEGRADED" : "DATA OK"}
                </Pill>
                <Pill color={COLORS.muted}>
                  ES {d?.dataQuality?.esResolvedSymbol || "—"}
                </Pill>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <StateCard
                label="1W Bigger Picture"
                value={plainOverall(top.oneWeek)}
                subtitle={display?.oneWeek?.summary}
              />
              <StateCard
                label="1H Current Pressure"
                value={plainTactical(top.oneHour)}
                subtitle={display?.oneHour?.summary}
              />
              <StateCard
                label="30m Fast Shift"
                value={plainTactical(top.thirty)}
                subtitle={display?.thirtyMinute?.summary}
              />
              <StateCard
                label="ES Move"
                value={plainMoveCharacter(top.move)}
                subtitle={display?.thirtyMinute?.summary}
              />
            </div>

            <LiveMonitorCard data={d} display={display} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              <LiquidityCard
                liquidity={
                  marketCharacter?.liquidity ||
                  trapDetection?.liquidity
                }
              />
              <MoveCharacterCard
                move={
                  marketCharacter?.move ||
                  trapDetection?.moveCharacterLane
                }
                data={d}
              />
              <TrapCard
                trap={
                  marketCharacter?.trap ||
                  trapDetection?.trap
                }
                detection={trapDetection}
              />
            </div>

            <MarketInternalsMap groups={groups} display={display} />
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#e5e7eb", padding: "18px 24px 32px", fontFamily: FONT, overflowX: "auto" }}>
      <div style={{ width: "96vw", maxWidth: 2350, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 10 }}>
          <div>
            <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900, color: "#f8fafc" }}>ENGINE 29 — MARKET CHARACTER</div>
            <div style={{ marginTop: 4, color: COLORS.muted, fontSize: 14 }}>Cross-Market Stress • Liquidity • Move • Trap</div>
            <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
              {updatedAt ? <Pill color={COLORS.info}>Data {updatedAt.toLocaleString()}</Pill> : null}
              <Pill color={d?.dataDegraded ? COLORS.warn : COLORS.good}>{d?.dataDegraded ? "DATA DEGRADED" : "DATA OK"}</Pill>
              <Pill color={COLORS.muted}>ES {d?.dataQuality?.esResolvedSymbol || "—"}</Pill>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right", fontSize: 12, color: COLORS.muted }}>
              <div style={{ fontWeight: 900 }}>LIVE BUILD: CRON MANAGED</div>
              <div style={{ marginTop: 2 }}>15s persisted reads · dashboard is read only</div>
            </div>
            <button onClick={() => window.close()} style={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.38)", color: "#e5e7eb", borderRadius: 9, padding: "9px 14px", fontSize: 14, fontWeight: 850, cursor: "pointer" }}>Close</button>
          </div>
        </div>

        {status === "LOADING" && !data && <div style={{ color: COLORS.muted }}>Loading Engine 29…</div>}

        {status === "ERROR" && (
          <Card style={{ borderColor: "rgba(239,68,68,0.45)" }}>
            <div style={{ color: "#fecaca" }}>Engine 29 dashboard error: {error}</div>
          </Card>
        )}

        {(data || summary) && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(250px, 1fr))", gap: 12 }}>
              <StateCard label="1W Bigger Picture" value={plainOverall(top.oneWeek)} subtitle={display?.oneWeek?.summary} />
              <StateCard label="1H Current Pressure" value={plainTactical(top.oneHour)} subtitle={display?.oneHour?.summary} />
              <StateCard label="30m Fast Shift" value={plainTactical(top.thirty)} subtitle={display?.thirtyMinute?.summary} />
              <StateCard label="ES Move" value={plainMoveCharacter(top.move)} subtitle={display?.thirtyMinute?.summary} />
            </div>

            <LiveMonitorCard data={d} display={display} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(300px, 1fr))", gap: 12 }}>
              <LiquidityCard liquidity={marketCharacter?.liquidity || trapDetection?.liquidity} />
              <MoveCharacterCard move={marketCharacter?.move || trapDetection?.moveCharacterLane} data={d} />
              <TrapCard trap={marketCharacter?.trap || trapDetection?.trap} detection={trapDetection} />
            </div>

            <MarketInternalsMap groups={groups} display={display} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <DivergencesCard groups={groups} />
              <Engine25ParticipationCard primary={engine25Primary} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 12 }}>
              <KeyTakeawaysCard data={d} display={display} />
              <MissingConfirmationCard data={d} display={display} />
            </div>

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setShowRaw((value) => !value)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  border: 0,
                  background: "rgba(15,23,42,0.96)",
                  color: "#f8fafc",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                <span>Show Raw Evidence</span>
                <span style={{ color: COLORS.info }}>{showRaw ? "▲" : "▼"}</span>
              </button>

              {showRaw && (
                <div style={{ padding: 14, display: "grid", gap: 12, borderTop: `1px solid ${COLORS.line}` }}>
                  <UnderHoodGrid display={display} />

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(285px, 1fr))", gap: 12 }}>
                    <GroupCard title="Large Indexes" groupKey="headlineIndex" group={groups?.headlineIndex} displayLabel={display?.underTheHood?.largeIndexes} />
                    <GroupCard title="Breadth" groupKey="breadth" group={groups?.breadth} displayLabel={display?.underTheHood?.breadth} />
                    <GroupCard title="Tech Leadership" groupKey="leadership" group={groups?.leadership} displayLabel={display?.underTheHood?.techLeadership} />
                    <GroupCard title="Credit" groupKey="credit" group={groups?.credit} displayLabel={display?.underTheHood?.credit} />
                    <GroupCard title="Rates / Bonds" groupKey="ratesDuration" group={groups?.ratesDuration} displayLabel={display?.underTheHood?.ratesBonds} />
                    <GroupCard title="Oil / Energy" groupKey="energyInflation" group={groups?.energyInflation} displayLabel={display?.underTheHood?.oil} />
                    <GroupCard title="Volatility" groupKey="volatility" group={groups?.volatility} displayLabel={display?.underTheHood?.volatility} />
                    <GroupCard title="Financial Conditions" groupKey="financialConditions" group={groups?.financialConditions} displayLabel={display?.underTheHood?.financialConditions} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <EsMoveCard data={d} />
                    <PressureCard display={display} move={d?.moveCharacter || d?.tacticalCharacter} />
                  </div>

                  <SymbolEvidence symbols={d?.symbols} />

                  <Card>
                    <SectionTitle>Canonical Raw Objects</SectionTitle>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                      {[
                        ["marketCharacter", d?.marketCharacter],
                        ["trapDetection", d?.trapDetection],
                        ["liveMonitor", d?.liveMonitor],
                      ].map(([label, value]) => (
                        <div key={label} style={{ minWidth: 0 }}>
                          <div style={{ color: COLORS.info, fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                          <pre style={{ margin: 0, padding: 9, borderRadius: 9, background: "#020617", border: `1px solid ${COLORS.line}`, color: "#cbd5e1", fontSize: 10.5, lineHeight: 1.35, maxHeight: 340, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(value || null, null, 2)}</pre>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
