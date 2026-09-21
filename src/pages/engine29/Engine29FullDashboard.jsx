// src/pages/engine29/Engine29FullDashboard.jsx
// Engine 29 — Cross-Market Stress full dashboard.
// Standalone research/control-room page using Engine 29's own API.
// No dependency on buildStrategySnapshot.js.
//
// Live monitor:
// - 10m observation layer
// - 20m persistence check
// - diagnostic only; never overwrites 30m / 1H / 1W authority
// - while this page is open, requests a fresh Engine 29 backend rebuild every 10 minutes

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ROUTE = `${API_ROOT}/api/v1/engine29/cross-market-stress`;
const SUMMARY_ROUTE = `${API_ROOT}/api/v1/engine29/cross-market-stress/summary`;
const UPDATE_ROUTE = `${API_ROOT}/api/v1/engine29/update`;

const FONT = "Arial, Helvetica, sans-serif";
const READ_POLL_MS = 15_000;
const LIVE_REBUILD_MS = 10 * 60_000;

const COLORS = {
  good: "#22c55e",
  warn: "#fbbf24",
  orange: "#f97316",
  bad: "#ef4444",
  severe: "#b91c1c",
  info: "#60a5fa",
  muted: "#94a3b8",
  text: "#e2e8f0",
};

function clean(value) {
  return String(value ?? "—").replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function pct(value, digits = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%` : "—";
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
  if (!text || text === "NO_ACTIVE_MOVE") return "NO ACTIVE SQUEEZE";
  if (text === "POSSIBLE_UPSIDE_SQUEEZE") return "POSSIBLE ES UPSIDE SQUEEZE";
  if (text === "POSSIBLE_DOWNSIDE_SQUEEZE") return "POSSIBLE ES DOWNSIDE SQUEEZE";
  if (text === "LIQUIDITY_SWEEP_HIGH") return "ES LIQUIDITY SWEEP HIGH";
  if (text === "LIQUIDITY_SWEEP_LOW") return "ES LIQUIDITY SWEEP LOW";
  if (text === "FAILED_BREAKOUT") return "FAILED ES BREAKOUT";
  if (text === "FAILED_BREAKDOWN") return "FAILED ES BREAKDOWN";
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

  if (text === "COUNTERTREND_BUYING_BROADENING") {
    return "COUNTERTREND BUYING BROADENING";
  }

  if (text === "COUNTERTREND_SELLING_BROADENING") {
    return "COUNTERTREND SELLING BROADENING";
  }

  if (text === "COUNTERTREND_RALLY_FADING") {
    return "COUNTERTREND RALLY FADING";
  }

  if (text === "COUNTERTREND_SELLOFF_FADING") {
    return "COUNTERTREND SELLOFF FADING";
  }

  if (text === "BROADENING_INTO_RALLY") return "BROADENING INTO RALLY";
  if (text === "BROADENING_INTO_SELLOFF") return "BROADENING INTO SELLOFF";
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
    if (
      groupKey === "breadth" ||
      groupKey === "leadership" ||
      groupKey === "headlineIndex"
    ) {
      return "BREAKING";
    }

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
    text.includes("NEGATIVE")
  ) {
    return COLORS.bad;
  }

  if (
    text.includes("BROAD DETERIORATION") ||
    text.includes("BROAD_DETERIORATION") ||
    text.includes("STRESS CONFIRMED") ||
    text.includes("STRESS BUILDING") ||
    text.includes("WEAKENING") ||
    text.includes("FADING") ||
    text.includes("COUNTERTREND")
  ) {
    return COLORS.orange;
  }

  if (
    text.includes("CAUTION") ||
    text.includes("FORMING") ||
    text.includes("WARNING") ||
    text.includes("STABILIZING") ||
    text.includes("RECOVERY ATTEMPT") ||
    text.includes("NO ACTIVE") ||
    text.includes("MIXED") ||
    text.includes("WAIT") ||
    text.includes("MISSING") ||
    text.includes("NO DIRECT") ||
    text.includes("MONITORING") ||
    text.includes("PARTIAL") ||
    text.includes("NARROW")
  ) {
    return COLORS.warn;
  }

  if (
    text.includes("HEALTHY") ||
    text.includes("RECOVERING") ||
    text.includes("POSITIVE") ||
    text.includes("BROAD MOVE UP") ||
    text.includes("BROAD_MOVE_CONFIRMED") ||
    text.includes("ACCELERATING") ||
    text.includes("HOLDING") ||
    text.includes("BROADENING INTO RALLY") ||
    text.includes("BROAD")
  ) {
    return COLORS.good;
  }

  return COLORS.muted;
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.25)",
        borderRadius: 14,
        background: "rgba(15,23,42,0.78)",
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

function SectionTitle({ children, color = "#93c5fd" }) {
  return (
    <div
      style={{
        fontSize: 16,
        fontWeight: 900,
        color,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        marginBottom: 9,
      }}
    >
      {children}
    </div>
  );
}

function StateCard({ label, value, subtitle, accent }) {
  const color = accent || stateColor(value);

  return (
    <Card
      style={{
        borderColor: `${color}66`,
        background: `${color}0E`,
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 13,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 7,
          color,
          fontSize: 28,
          lineHeight: 1.05,
          fontWeight: 900,
        }}
      >
        {clean(value)}
      </div>

      {subtitle ? (
        <div
          style={{
            marginTop: 7,
            color: "#cbd5e1",
            fontSize: 14,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      ) : null}
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>1W</span>
          <strong style={{ color: stateColor(structural?.state) }}>
            {plainGroupState(groupKey, structural?.state)}
          </strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>1H</span>
          <strong style={{ color: stateColor(tactical?.state) }}>
            {plainGroupState(groupKey, tactical?.state)}
          </strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>30m</span>
          <strong style={{ color: stateColor(fast?.state) }}>
            {plainGroupState(groupKey, fast?.state)}
          </strong>
        </div>
      </div>

      {members.length > 0 && (
        <div
          style={{
            marginTop: 10,
            borderTop: "1px solid rgba(148,163,184,0.16)",
            paddingTop: 8,
            display: "grid",
            gap: 5,
          }}
        >
          {members.slice(0, 6).map((m) => (
            <div
              key={m.canonicalSymbol}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 13,
              }}
            >
              <span style={{ color: "#cbd5e1", fontWeight: 800 }}>
                {m.canonicalSymbol}
              </span>

              <span
                style={{
                  color: stateColor(m.state),
                  fontWeight: 850,
                }}
              >
                {plainSymbolState(m.state)}
              </span>
            </div>
          ))}
        </div>
      )}

      {structural?.dataDegraded && (
        <div
          style={{
            marginTop: 9,
            color: "#fbbf24",
            fontSize: 12,
            lineHeight: 1.3,
          }}
        >
          Partial data
          {structural?.missingRequiredMembers?.length
            ? ` · Missing ${structural.missingRequiredMembers.join(", ")}`
            : ""}
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        {items.map(([label, value]) => (
          <div
            key={label}
            style={{
              border: "1px solid rgba(148,163,184,0.17)",
              borderRadius: 10,
              padding: 10,
              background: "rgba(2,6,23,0.28)",
            }}
          >
            <div
              style={{
                color: "#94a3b8",
                fontSize: 12,
                fontWeight: 850,
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>

            <div
              style={{
                marginTop: 5,
                color: stateColor(value),
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              {clean(value)}
            </div>
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
      <SectionTitle color={stateColor(p?.state)}>
        30m Underlying Pressure
      </SectionTitle>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(125px, 1fr))",
          gap: 8,
        }}
      >
        {[
          ["State", p?.state],
          ["SPY / QQQ", p?.spyQqq],
          ["Breadth", p?.breadth],
          ["Leadership", p?.leadership],
          ["Credit", p?.credit],
          ["Financials", p?.financials],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: 9,
              borderRadius: 9,
              background: "rgba(2,6,23,0.34)",
              border: "1px solid rgba(148,163,184,0.16)",
            }}
          >
            <div
              style={{
                color: "#94a3b8",
                fontSize: 11,
                fontWeight: 850,
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>

            <div
              style={{
                marginTop: 4,
                color: stateColor(value),
                fontSize: 15,
                fontWeight: 900,
              }}
            >
              {clean(value)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LiveMonitorCard({ data, display }) {
  const live = data?.liveMonitor || {};
  const liveDisplay = display?.liveMonitor || live?.display || {};
  const metrics = live?.metrics || {};
  const headline = metrics?.headline || {};
  const breadth = metrics?.breadth || {};
  const leadership = metrics?.leadership || {};
  const credit = metrics?.credit || {};
  const financials = metrics?.financials || {};
  const vix = metrics?.vix || {};

  const state = live?.state || liveDisplay?.state;
  const participation = live?.participation || liveDisplay?.participation;
  const context = live?.context || liveDisplay?.context;
  const parent30m =
    live?.fastTacticalContext?.state ||
    liveDisplay?.parent30mState ||
    data?.fastTacticalState;

  const why = Array.isArray(liveDisplay?.why)
    ? liveDisplay.why
    : Array.isArray(live?.display?.why)
      ? live.display.why
      : [];

  const color = stateColor(state);

  const metricsRows = [
    ["Headline 10m", pct(headline?.move10)],
    ["Headline 20m", pct(headline?.move20)],
    ["Breadth 10m", pct(breadth?.move10)],
    ["Breadth 20m", pct(breadth?.move20)],
    ["Leadership 10m", pct(leadership?.move10)],
    ["Credit 10m", pct(credit?.move10)],
    ["Financials 10m", pct(financials?.move10)],
    ["VIX 10m", pct(vix?.move10)],
  ];

  return (
    <Card
      style={{
        borderColor: `${color}77`,
        background: `linear-gradient(135deg, ${color}12, rgba(15,23,42,0.92))`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.8fr 1.15fr",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div>
          <SectionTitle color={color}>
            10m Live Monitor · 20m Persistence
          </SectionTitle>

          <div
            style={{
              color,
              fontWeight: 950,
              fontSize: 27,
              lineHeight: 1.05,
            }}
          >
            {plainLiveState(state)}
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gap: 6,
              fontSize: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#94a3b8" }}>Participation</span>
              <strong style={{ color: stateColor(participation) }}>
                {clean(participation)}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#94a3b8" }}>10m vs 30m</span>
              <strong style={{ color: stateColor(context) }}>
                {plainContext(context)}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#94a3b8" }}>30m authority</span>
              <strong style={{ color: stateColor(parent30m) }}>
                {plainTactical(parent30m)}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#94a3b8" }}>Authority</span>
              <strong style={{ color: COLORS.info }}>
                DIAGNOSTIC ONLY
              </strong>
            </div>
          </div>
        </div>

        <div>
          <SectionTitle color="#cbd5e1">Live Measurements</SectionTitle>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 7,
            }}
          >
            {metricsRows.map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: "8px 9px",
                  borderRadius: 9,
                  background: "rgba(2,6,23,0.35)",
                  border: "1px solid rgba(148,163,184,0.14)",
                }}
              >
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 10,
                    fontWeight: 850,
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    marginTop: 3,
                    color: stateColor(value),
                    fontSize: 15,
                    fontWeight: 900,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle color="#f8fafc">Why This State?</SectionTitle>

          <div
            style={{
              color: "#e2e8f0",
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            {why.length ? (
              why.map((reason, index) => (
                <div
                  key={`${reason}-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "14px 1fr",
                    gap: 7,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color }}>•</span>
                  <span>{reason}</span>
                </div>
              ))
            ) : (
              <div style={{ color: "#94a3b8" }}>
                Waiting for live-monitor explanation.
              </div>
            )}
          </div>

          {liveDisplay?.headline || live?.display?.headline ? (
            <div
              style={{
                marginTop: 11,
                paddingTop: 9,
                borderTop: "1px solid rgba(148,163,184,0.16)",
                color,
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              {liveDisplay?.headline || live?.display?.headline}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function EsMoveCard({ data }) {
  const move = data?.tacticalCharacter || data?.moveCharacterDetail || null;
  const display = data?.display || {};
  const thirty = display?.thirtyMinute || {};

  const moveCharacter =
    rawMoveCharacter(data?.moveCharacter) ||
    rawMoveCharacter(move) ||
    rawMoveCharacter(thirty?.moveCharacter) ||
    thirty?.status;

  const moveDirection = data?.moveDirection || move?.direction;
  const pressure =
    move?.underlyingPressure?.state ||
    display?.underTheHood?.pressure?.state;

  const es = move?.display?.es || {};

  return (
    <Card style={{ borderColor: `${stateColor(moveCharacter)}66` }}>
      <SectionTitle color={stateColor(moveCharacter)}>
        ES Move Character
      </SectionTitle>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.25fr 0.75fr",
          gap: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: stateColor(moveCharacter),
            }}
          >
            {plainMoveCharacter(moveCharacter || thirty?.status)}
          </div>

          <div
            style={{
              marginTop: 6,
              color: "#cbd5e1",
              fontSize: 15,
              lineHeight: 1.4,
            }}
          >
            {thirty?.summary ||
              move?.display?.summary ||
              "No move-character summary available."}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 5,
            alignContent: "start",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: "#94a3b8" }}>Direction</span>
            <strong style={{ color: stateColor(moveDirection) }}>
              {clean(moveDirection)}
            </strong>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: "#94a3b8" }}>Pressure</span>
            <strong style={{ color: stateColor(pressure) }}>
              {clean(pressure)}
            </strong>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: "#94a3b8" }}>ES contract</span>
            <strong>
              {data?.dataQuality?.esResolvedSymbol ||
                data?.esResolvedSymbol ||
                es?.resolvedSymbol ||
                "—"}
            </strong>
          </div>

          {Number.isFinite(Number(es?.pointMove)) && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ color: "#94a3b8" }}>30m ES move</span>
              <strong>{Number(es.pointMove).toFixed(2)} pts</strong>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Engine29FullDashboard() {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);
  const [rebuildStatus, setRebuildStatus] = useState("IDLE");
  const [lastRebuildAt, setLastRebuildAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let rebuildInFlight = false;

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
          throw new Error(
            fullJson?.error ||
              `Engine 29 HTTP ${fullRes.status}`
          );
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

    async function rebuild() {
      if (rebuildInFlight) return;
      rebuildInFlight = true;

      try {
        if (!cancelled) setRebuildStatus("UPDATING");

        const res = await fetch(`${UPDATE_ROUTE}?t=${Date.now()}`, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || json?.ok === false) {
          throw new Error(
            json?.error ||
              `Engine 29 update HTTP ${res.status}`
          );
        }

        if (!cancelled) {
          setLastRebuildAt(new Date());
          setRebuildStatus("READY");
        }

        await load();
      } catch (err) {
        if (!cancelled) {
          setRebuildStatus("ERROR");
          setError(err?.message || String(err));
        }
      } finally {
        rebuildInFlight = false;
      }
    }

    // Load existing persisted truth immediately.
    load();

    // Then request a fresh live rebuild so the monitor starts current.
    rebuild();

    // Read the persisted output frequently while the page is open.
    const readTimer = setInterval(load, READ_POLL_MS);

    // Rebuild Engine 29 every 10 minutes for the live diagnostic monitor.
    const rebuildTimer = setInterval(rebuild, LIVE_REBUILD_MS);

    return () => {
      cancelled = true;
      clearInterval(readTimer);
      clearInterval(rebuildTimer);
    };
  }, []);

  const d = data || summary || {};
  const display = d?.display || summary?.display || {};
  const groups = d?.groups || {};

  const top = useMemo(
    () => ({
      oneWeek:
        display?.oneWeek?.state ||
        d?.structuralState ||
        d?.overallState,

      oneHour:
        display?.oneHour?.state ||
        d?.tacticalState,

      thirty:
        display?.thirtyMinute?.state ||
        d?.fastTacticalState,

      move:
        rawMoveCharacter(d?.moveCharacter) ||
        rawMoveCharacter(d?.tacticalCharacter) ||
        rawMoveCharacter(display?.thirtyMinute?.moveCharacter) ||
        display?.thirtyMinute?.status,
    }),
    [display, d]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "18px 24px 32px",
        fontFamily: FONT,
        overflowX: "auto",
      }}
    >
      <div
        style={{
          width: "96vw",
          maxWidth: 2350,
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "center",
            borderBottom: "1px solid rgba(148,163,184,0.26)",
            paddingBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 30,
                lineHeight: 1.1,
                fontWeight: 900,
                color: "#f8fafc",
              }}
            >
              ENGINE 29 — CROSS-MARKET STRESS
            </div>

            <div
              style={{
                marginTop: 4,
                color: "#94a3b8",
                fontSize: 15,
              }}
            >
              Bigger picture · Intraday condition · 30m fast shift · 10m live transition · ES squeeze / liquidity read
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                textAlign: "right",
                fontSize: 12,
                color:
                  rebuildStatus === "ERROR"
                    ? COLORS.bad
                    : rebuildStatus === "UPDATING"
                      ? COLORS.warn
                      : COLORS.muted,
              }}
            >
              <div style={{ fontWeight: 900 }}>
                LIVE BUILD: {rebuildStatus}
              </div>

              <div style={{ marginTop: 2 }}>
                Auto rebuild every 10m
                {lastRebuildAt
                  ? ` · Last ${lastRebuildAt.toLocaleTimeString()}`
                  : ""}
              </div>
            </div>

            <button
              onClick={() => window.close()}
              style={{
                background: "#0f172a",
                border: "1px solid rgba(148,163,184,0.38)",
                color: "#e5e7eb",
                borderRadius: 9,
                padding: "9px 14px",
                fontSize: 14,
                fontWeight: 850,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {status === "LOADING" && !data && (
          <div style={{ color: "#94a3b8" }}>
            Loading Engine 29…
          </div>
        )}

        {status === "ERROR" && (
          <Card
            style={{
              borderColor: "rgba(239,68,68,0.45)",
            }}
          >
            <div style={{ color: "#fecaca" }}>
              Engine 29 dashboard error: {error}
            </div>
          </Card>
        )}

        {(data || summary) && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              <StateCard
                label="1W Bigger Picture"
                value={plainOverall(top.oneWeek)}
                subtitle={display?.oneWeek?.summary}
              />

              <StateCard
                label="1H Intraday"
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
                value={plainMoveCharacter(
                  top.move ||
                    display?.thirtyMinute?.status
                )}
                subtitle={display?.thirtyMinute?.summary}
              />
            </div>

            <LiveMonitorCard
              data={d}
              display={display}
            />

            <UnderHoodGrid display={display} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(300px, 1fr))",
                gap: 12,
              }}
            >
              <GroupCard
                title="Large Indexes"
                groupKey="headlineIndex"
                group={groups?.headlineIndex}
                displayLabel={display?.underTheHood?.largeIndexes}
              />

              <GroupCard
                title="Breadth"
                groupKey="breadth"
                group={groups?.breadth}
                displayLabel={display?.underTheHood?.breadth}
              />

              <GroupCard
                title="Tech Leadership"
                groupKey="leadership"
                group={groups?.leadership}
                displayLabel={display?.underTheHood?.techLeadership}
              />

              <GroupCard
                title="Credit"
                groupKey="credit"
                group={groups?.credit}
                displayLabel={display?.underTheHood?.credit}
              />

              <GroupCard
                title="Rates / Bonds"
                groupKey="ratesDuration"
                group={groups?.ratesDuration}
                displayLabel={display?.underTheHood?.ratesBonds}
              />

              <GroupCard
                title="Oil / Energy"
                groupKey="energyInflation"
                group={groups?.energyInflation}
                displayLabel={display?.underTheHood?.oil}
              />

              <GroupCard
                title="Volatility"
                groupKey="volatility"
                group={groups?.volatility}
                displayLabel={display?.underTheHood?.volatility}
              />

              <GroupCard
                title="Financial Conditions"
                groupKey="financialConditions"
                group={groups?.financialConditions}
                displayLabel={display?.underTheHood?.financialConditions}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <EsMoveCard data={d} />

              <PressureCard
                display={display}
                move={d?.tacticalCharacter}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 0.7fr",
                gap: 12,
              }}
            >
              <Card>
                <SectionTitle>Key Takeaways</SectionTitle>

                <div
                  style={{
                    color: "#dbeafe",
                    fontSize: 17,
                    lineHeight: 1.5,
                  }}
                >
                  <div>
                    <strong>Overall:</strong>{" "}
                    {clean(
                      display?.overall ||
                        d?.overallState
                    )}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    {display?.overallSummary || "—"}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <strong>ES trading backdrop:</strong>{" "}
                    <span
                      style={{
                        color: stateColor(d?.esNqBackdrop),
                      }}
                    >
                      {plainBackdrop(d?.esNqBackdrop)}
                    </span>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionTitle color="#fbbf24">
                  Missing Confirmation
                </SectionTitle>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {(
                    d?.missingConfirmations ||
                    display?.missingConfirmation ||
                    []
                  ).map((x) => (
                    <span
                      key={x}
                      style={{
                        padding: "6px 9px",
                        borderRadius: 999,
                        background: "rgba(245,158,11,0.12)",
                        border: "1px solid rgba(245,158,11,0.35)",
                        color: "#fbbf24",
                        fontSize: 13,
                        fontWeight: 850,
                      }}
                    >
                      {plainMissingConfirmation(x)}
                    </span>
                  ))}

                  {!(
                    d?.missingConfirmations ||
                    display?.missingConfirmation ||
                    []
                  ).length && (
                    <span style={{ color: "#22c55e" }}>
                      None
                    </span>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
