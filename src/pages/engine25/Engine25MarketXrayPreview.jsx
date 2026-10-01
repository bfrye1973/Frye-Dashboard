// src/pages/engine25/Engine25MarketXrayPreview.jsx
// Version 1 / Phase 2: Engine25 Market X-Ray.
// Correctness-first data wiring with simplified customer-facing presentation.
// No animation. No Engine26. No production dashboard replacement.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RowMarketOverview from "../rows/RowMarketOverview";
import Engine29FullDashboard from "../engine29/Engine29FullDashboard";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ENGINE25_ROUTE = `${API_ROOT}/api/v1/engine25/full-dashboard`;
const MASTER_ROUTE = `${API_ROOT}/api/v1/futures/market-meter?symbol=ES`;

const COLORS = {
  bg: "#030405",
  panel: "#0a0d11",
  panel2: "#10151b",
  border: "#303842",
  text: "#f8fafc",
  muted: "#94a3b8",
  green: "#22c55e",
  yellow: "#fbbf24",
  orange: "#f97316",
  red: "#ef4444",
  blue: "#38bdf8",
};

function n(value) {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function fmt(value, digits = 0) {
  const x = n(value);
  return x == null ? "—" : x.toFixed(digits);
}

function pct(value, digits = 0) {
  const x = n(value);
  return x == null ? "—" : `${x.toFixed(digits)}%`;
}

function clean(value, fallback = "—") {
  const s = String(value ?? "").trim();
  return s ? s.replaceAll("_", " ") : fallback;
}

function upper(value, fallback = "—") {
  return clean(value, fallback).toUpperCase();
}

function colorForCanonicalState(value, fallback = COLORS.muted) {
  const state = String(value ?? "").trim().toUpperCase();
  if (!state) return fallback;
  if (state === "GREEN" || state === "OK" || state.includes("BULLISH") || state.includes("FRESH") || state === "LIVE") return COLORS.green;
  if (state === "ORANGE" || state.includes("ELEVATED")) return COLORS.orange;
  if (state === "RED" || state === "DARKRED" || state.includes("BEARISH") || state.includes("WEAK") || state.includes("HIGH")) return COLORS.red;
  if (state === "YELLOW" || state.includes("WATCH") || state.includes("MIXED") || state.includes("NEUTRAL") || state.includes("STALE") || state.includes("DEGRADED")) return COLORS.yellow;
  return fallback;
}

function dataStatusFromFreshness(freshness) {
  const state = String(freshness?.state || "").toUpperCase();
  if (state === "FRESH") return "LIVE";
  if (state.includes("STALE")) return "STALE";
  if (state.includes("MISSING")) return "MISSING";
  return state ? "DEGRADED" : "MISSING";
}

function canonicalSectorName(value) {
  const s = String(value || "").trim();
  const key = s.toLowerCase();
  const aliases = {
    "technology": "Information Technology",
    "tech": "Information Technology",
    "information technology": "Information Technology",
    "communication services": "Communication Services",
    "communications": "Communication Services",
    "consumer staples": "Consumer Staples",
    "utilities": "Utilities",
    "real estate": "Real Estate",
    "financials": "Financials",
    "financial": "Financials",
    "healthcare": "Health Care",
    "health care": "Health Care",
    "industrials": "Industrials",
    "energy": "Energy",
    "materials": "Materials",
    "consumer discretionary": "Consumer Discretionary",
  };
  return aliases[key] || s || "Unknown";
}

function Card({ title, children, style = {}, accent = COLORS.border }) {
  return (
    <section
      style={{
        background:
          "linear-gradient(180deg, rgba(18,23,30,.96) 0%, rgba(7,10,14,.98) 100%)",
        border: `1px solid ${accent}`,
        borderRadius: 14,
        padding: 14,
        minWidth: 0,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.035), 0 10px 28px rgba(0,0,0,.28)",
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: COLORS.text,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          {title}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function StatusPill({ children, color = COLORS.blue }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${color}`,
        color,
        borderRadius: 999,
        padding: "5px 9px",
        transition: "color 300ms ease, border-color 300ms ease, background-color 300ms ease",
        fontSize: 11,
        lineHeight: 1,
        fontWeight: 900,
        letterSpacing: ".03em",
        textTransform: "uppercase",
        background: "rgba(2,6,23,.55)",
      }}
    >
      {children}
    </span>
  );
}

function BigStat({ label, value, color = COLORS.text, note = null }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(21,27,35,.9), rgba(10,13,18,.94))",
        border: "1px solid rgba(148,163,184,.18)",
        borderRadius: 10,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.025)",
        transition: "border-color 350ms ease, box-shadow 350ms ease, transform 350ms ease",
        padding: "11px 12px",
        minWidth: 0,
      }}
    >
      <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color, fontSize: 24, lineHeight: 1.1, fontWeight: 1000, marginTop: 5 }}>
        {value}
      </div>
      {note ? <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{note}</div> : null}
    </div>
  );
}

function KV({ label, value, color = COLORS.text }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        padding: "5px 0",
        borderBottom: "1px solid rgba(148,163,184,.10)",
        fontSize: 13,
      }}
    >
      <span style={{ color: COLORS.muted }}>{label}</span>
      <strong style={{ color, textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function SplitBar({ buy, sell, buyLabel = "Buying", sellLabel = "Selling" }) {
  const b = Math.max(0, Math.min(100, n(buy) ?? 0));
  const s = Math.max(0, Math.min(100, n(sell) ?? 0));
  const total = b + s || 100;
  const bp = (b / total) * 100;
  const sp = (s / total) * 100;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          height: 28,
          borderRadius: 7,
          overflow: "hidden",
          border: "1px solid rgba(148,163,184,.18)",
        }}
      >
        <div
          style={{
            width: `${bp}%`,
            background: "rgba(34,197,94,.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            color: "#04120a",
            minWidth: bp > 7 ? 36 : 0,
            transition: "width 700ms cubic-bezier(.2,.8,.2,1), background-color 350ms ease",
          }}
        >
          {bp > 7 ? pct(b, 0) : ""}
        </div>
        <div
          style={{
            width: `${sp}%`,
            background: "rgba(239,68,68,.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            color: "#180404",
            minWidth: sp > 7 ? 36 : 0,
            transition: "width 700ms cubic-bezier(.2,.8,.2,1), background-color 350ms ease",
          }}
        >
          {sp > 7 ? pct(s, 0) : ""}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: COLORS.green }}>{buyLabel}</span>
        <span style={{ color: COLORS.red }}>{sellLabel}</span>
      </div>
    </div>
  );
}

function SimpleGauge({ value, label, color = COLORS.muted }) {
  const x = Math.max(0, Math.min(100, n(value) ?? 0));
  return (
    <div style={{ textAlign: "center", display: "grid", gap: 7 }}>
      <div
        style={{
          width: 128,
          height: 64,
          margin: "0 auto",
          borderRadius: "128px 128px 0 0",
          border: "10px solid rgba(148,163,184,.14)",
          boxShadow: `0 0 22px ${color}33, inset 0 -8px 18px rgba(0,0,0,.7)`,
          borderBottom: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: "100%",
            width: `${x}%`,
            background: color,
            opacity: .9,
            transition: "width 750ms cubic-bezier(.2,.8,.2,1), background-color 350ms ease",
          }}
        />
      </div>
      <div style={{ fontSize: 34, fontWeight: 1000, color }}>{fmt(x)}</div>
      <div style={{ color: COLORS.muted, fontSize: 12, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function PlainLineChart({ rows = [] }) {
  const points = rows
    .filter((row) => n(row?.time) != null && n(row?.engine25CompositeScore) != null)
    .map((row) => ({ time: n(row.time), value: n(row.engine25CompositeScore) }));

  if (points.length < 2) {
    return <div style={{ color: COLORS.muted }}>Historical Market Health trend unavailable.</div>;
  }

  const width = 1000;
  const height = 190;
  const pad = 26;
  const path = points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (width - pad * 2);
      const y = pad + (1 - p.value / 100) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {[40, 55, 75].map((level) => {
        const y = pad + (1 - level / 100) * (height - pad * 2);
        return (
          <g key={level}>
            <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="rgba(148,163,184,.18)" />
            <text x="2" y={y + 4} fill={COLORS.muted} fontSize="12">{level}</text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke={COLORS.orange} strokeWidth="4" />
    </svg>
  );
}

function signedPct(value, digits = 2) {
  const x = n(value);
  if (x == null) return "—";
  return `${x > 0 ? "+" : ""}${x.toFixed(digits)}%`;
}

function MacroMoveRow({
  label,
  value,
  changePct = null,
  fresh = false,
  valueSuffix = "",
}) {
  const change = n(changePct);
  const color = !fresh
    ? COLORS.yellow
    : change == null
      ? COLORS.yellow
      : change > 0
        ? COLORS.green
        : change < 0
          ? COLORS.red
          : COLORS.muted;

  const badge = !fresh || change == null
    ? "STALE"
    : change > 0
      ? `▲ ${signedPct(change)}`
      : change < 0
        ? `▼ ${signedPct(change)}`
        : "UNCHANGED";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px,1fr) auto auto",
        gap: 10,
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid rgba(148,163,184,.10)",
      }}
    >
      <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 15, fontWeight: 950, textAlign: "right" }}>
        {n(value) == null ? "—" : `${fmt(value, 2)}${valueSuffix}`}
      </div>
      <div
        style={{
          minWidth: 76,
          textAlign: "center",
          border: `1px solid ${color}88`,
          borderRadius: 8,
          padding: "4px 7px",
          color,
          background: `${color}12`,
          fontSize: 10,
          fontWeight: 950,
        }}
      >
        {badge}
      </div>
    </div>
  );
}

function changeRow(rows, label) {
  return (Array.isArray(rows) ? rows : []).find((r) => r?.label === label) || null;
}

export default function Engine25MarketXrayPreview() {
  const [data, setData] = useState(null);
  const [master, setMaster] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);
  const [sectorTimeframe, setSectorTimeframe] = useState("1H");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [a, b] = await Promise.all([
          fetch(ENGINE25_ROUTE, { cache: "no-store" }),
          fetch(MASTER_ROUTE, { cache: "no-store" }),
        ]);
        const aj = await a.json();
        const bj = await b.json().catch(() => null);
        if (!a.ok || aj?.ok === false) throw new Error(aj?.error || `HTTP ${a.status}`);
        if (!alive) return;
        setData(aj);
        setMaster(b.ok ? bj : null);
        setStatus("READY");
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || String(e));
        setStatus("ERROR");
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const headline = data?.headline || {};
  const artifact = data?.participationArtifact || null;
  const participation = artifact?.participation || {};
  const volume = participation?.stockVolume || {};
  const intradayVolume = volume?.intraday || {};
  const breadth = participation?.breadth || {};
  const upDown = participation?.upDown || {};
  const distribution = participation?.distributionPressure || {};
  const freshness = artifact?.freshness || {};
  const sectorBreadth = data?.sectorBreadth || {};
  const tactical = sectorBreadth?.tactical1h || {};
  const regime = sectorBreadth?.regime4h || {};
  const eodSectorParticipation =
    participation?.sectorParticipation?.eod || {};

  const sectorCardsByTimeframe = {
    "1H": Array.isArray(tactical?.cards) ? tactical.cards : [],
    "4H": Array.isArray(regime?.cards) ? regime.cards : [],
    EOD: Array.isArray(eodSectorParticipation?.cards)
      ? eodSectorParticipation.cards
      : [],
  };

  const cards = sectorCardsByTimeframe[sectorTimeframe] || [];
  const tacticalSummary = tactical?.summary || {};
  const credit = data?.creditStressDetail || {};
  const macro = data?.macroPressure || {};
  const event = useMemo(() => currentNewsEvent(data?.newsEvents), [data?.newsEvents]);
  const underRows = data?.underTheHood?.rows || [];
  const overlayRows = data?.overlay?.rows || [];

  const scanned = n(intradayVolume?.stocksScanned);
  const withVolume = n(intradayVolume?.stocksWithVolume);
  const coverage = n(intradayVolume?.coveragePct);
  const buyVolPct = n(intradayVolume?.advancingVolumeShare);
  const sellVolPct = n(intradayVolume?.decliningVolumeShare);
  const imbalance = n(intradayVolume?.volumeImbalance);

  const totalUp = n(upDown?.intradayUp);
  const totalDown = n(upDown?.intradayDown);
  const breadthDenom = (totalUp ?? 0) + (totalDown ?? 0);
  const buyBreadthPct = breadthDenom > 0 ? (totalUp / breadthDenom) * 100 : null;
  const sellBreadthPct = breadthDenom > 0 ? (totalDown / breadthDenom) * 100 : null;

  const rawPressure = n(distribution?.rawPressure);
  const distributionPressurePct =
    rawPressure != null ? rawPressure : (n(distribution?.score) != null ? 100 - n(distribution.score) : null);

  const masterScore = n(master?.master?.score);
  const underlyingScore = n(breadth?.score);

  const nhNl = participation?.newHighsNewLows || {};
  const nh = n(nhNl?.intradayTotalNh);
  const nl = n(nhNl?.intradayTotalNl);

  const intradaySectorParticipation =
    participation?.sectorParticipation?.intraday || {};
  const currentWeakSectorCount =
    n(intradaySectorParticipation?.bearishCount);
  const currentStrongSectorCount =
    n(intradaySectorParticipation?.bullishCount);
  const currentNeutralSectorCount =
    n(intradaySectorParticipation?.neutralCount);
  const currentSectorCount =
    n(intradaySectorParticipation?.count);

  const distributionInputs = distribution?.inputs || {};
  const intradayBreadthPressure =
    n(distributionInputs?.intradayBreadthPressure);
  const volumePressure =
    n(volume?.combinedVolumePressure);

  const intradayMacro = data?.intradayMacro || {};
  const macroRates =
    intradayMacro?.components?.rates?.slowContext || {};
  const macroOil =
    intradayMacro?.components?.oil || {};
  const wti = macroOil?.wti || {};
  const brent = macroOil?.brent || {};
  const dollar = macro?.inputs?.UUP || {};

  const macroMarketFresh =
    String(intradayMacro?.freshness?.status || "").toUpperCase() === "FRESH";
  const wtiFresh =
    macroMarketFresh && isFreshIso(wti?.asOfUtc);
  const brentFresh =
    macroMarketFresh && isFreshIso(brent?.asOfUtc);

  const weakSectors = cards.filter((c) => n(c?.breadth_pct) <= 45 && n(c?.momentum_pct) <= 45).length;
  const strongSectors = cards.filter((c) => n(c?.breadth_pct) >= 55 && n(c?.momentum_pct) >= 55).length;
  const mixedSectors = Math.max(0, cards.length - weakSectors - strongSectors);

  const changed = [
    changeRow(underRows, "Breadth"),
    changeRow(underRows, "Distribution"),
    changeRow(underRows, "Credit Fragility"),
    changeRow(underRows, "Macro Aware"),
  ].filter(Boolean);

  const strategyNode =
    snapshot?.strategies?.["intraday_scalp@10m"] || null;
  const engine26Candidate =
    strategyNode?.engine26LocationCandidate || null;
  const engine26Geometry =
    strategyNode?.engine26ProposedGeometry || null;
  const engine26GeneralLocation =
    strategyNode?.engine26GeneralLocation || null;

  const engine26Direction =
    engine26Candidate?.currentObservationDirection ||
    engine26Candidate?.direction ||
    "NEUTRAL";

  const engine26ExpectedDirection =
    engine26Candidate?.expectedReversalDirection || null;

  const engine26State =
    engine26Candidate?.contactState ||
    engine26Candidate?.directionState ||
    engine26Candidate?.status ||
    "WAITING";

  const engine26Zone =
    engine26Candidate?.entryZone ||
    engine26Candidate?.zone ||
    engine26Candidate?.location ||
    null;

  const engine26ZoneLo =
    engine26Zone?.low ??
    engine26Zone?.lo ??
    null;

  const engine26ZoneHi =
    engine26Zone?.high ??
    engine26Zone?.hi ??
    null;

  const engine26ZoneText =
    n(engine26ZoneLo) != null && n(engine26ZoneHi) != null
      ? `${fmt(engine26ZoneLo, 2)}–${fmt(engine26ZoneHi, 2)}`
      : "—";

  const engine26CurrentPrice =
    engine26Candidate?.currentPrice ??
    engine26GeneralLocation?.currentPrice ??
    null;

  const engine26Invalidation =
    engine26Candidate?.locationInvalidationBoundary ??
    null;

  const engine26PlannerReady =
    engine26Geometry?.geometryReady === true ||
    (
      engine26Geometry?.active === true &&
      String(engine26Geometry?.lifecycleStatus || "").toUpperCase() ===
        "PROPOSED_GEOMETRY_AVAILABLE"
    );

  const engine26Targets = Array.isArray(engine26Geometry?.proposedTargets)
    ? engine26Geometry.proposedTargets
    : [];

  const engine26CandidateId =
    engine26Candidate?.candidateId ||
    engine26Candidate?.id ||
    null;

  const engine26GeometryCandidateId =
    engine26Geometry?.candidateId ||
    engine26Geometry?.identity?.candidateId ||
    null;

  const engine26IdentityState =
    engine26CandidateId && engine26GeometryCandidateId
      ? engine26CandidateId === engine26GeometryCandidateId
        ? "MATCH"
        : "MISMATCH"
      : "UNVERIFIED";

  const engine26SetupClass =
    engine26Candidate?.setupClass ||
    "NEGOTIATED_ZONE_ROTATION";

  const linkedSetupParams = new URLSearchParams({
    symbol: "ES",
    tf: "10m",
    strategyId: "intraday_scalp@10m",
  });

  if (engine26CandidateId) {
    linkedSetupParams.set("candidateId", engine26CandidateId);
  }

  if (engine26SetupClass) {
    linkedSetupParams.set("setupClass", engine26SetupClass);
  }

  const linkedChartHref = `/chart?${linkedSetupParams.toString()}`;
  const linkedWavesHref = `/strategies?${linkedSetupParams.toString()}`;

  const priceContext =
    data?.zoneDecisionRead?.priorityRead ||
    data?.zoneRead?.plainEnglish ||
    "Price / zone context unavailable.";

  const marketRead =
    scanned
      ? `${fmt(scanned)} stocks scanned. ${sellBreadthPct != null ? pct(sellBreadthPct) : "—"} of directional breadth and ${sellVolPct != null ? pct(sellVolPct) : "—"} of directional volume are on the selling side.`
      : headline?.interpretation || data?.deskNote || "Engine25 market-health read available.";

  return (
    <div
      style={{
        maxWidth: 1900,
        margin: "0 auto",
        display: "grid",
        gap: 14,
        minWidth: 0,
      }}
    >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "center",
            border: "1px solid rgba(239,68,68,.24)",
            borderLeft: "4px solid #ef4444",
            borderRadius: 12,
            padding: "12px 14px",
            background: "linear-gradient(90deg, rgba(127,29,29,.16), rgba(10,13,17,.96) 32%)",
            boxShadow: "0 10px 34px rgba(0,0,0,.34)",
          }}
        >
          <div>
            <div style={{ fontWeight: 1000, fontSize: 28, letterSpacing: ".02em" }}>
              <span style={{ color: COLORS.red }}>REDLINE</span> TRADING
              <span style={{ color: "#475569", padding: "0 9px" }}>//</span>
              ENGINE 25 — MARKET X-RAY
            </div>
            <div style={{ color: COLORS.muted, marginTop: 4 }}>
              See what is happening underneath the market — participation, pressure, stress, and risk in one view.
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: freshness?.usableForTrapConfirmation ? COLORS.green : COLORS.yellow, fontWeight: 900 }}>
              DATA: {upper(freshness?.state || "UNAVAILABLE")}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>
              {artifact?.generatedAt || data?.generatedAtUtc || "—"}
            </div>
          </div>
        </header>

        {status === "ERROR" && <Card accent={COLORS.red}><div style={{ color: "#fecaca" }}>Engine25 preview error: {error}</div></Card>}
        {status === "LOADING" && !data && <div style={{ color: COLORS.muted }}>Loading Engine25 Market X-Ray…</div>}

        <RowMarketOverview topMetersOnly />

        {data && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(250px,.55fr) minmax(760px,1.7fr) minmax(330px,.75fr)",
                gap: 14,
                alignItems: "stretch",
              }}
            >
              <Card title="Market Health" accent={toneForScore(headline?.score)}>
                <SimpleGauge
                  value={headline?.score}
                  label={upper(headline?.label || headline?.state)}
                />
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gap: 2,
                  }}
                >
                  <KV
                    label="Overall Market Condition"
                    value={upper(headline?.label || headline?.state)}
                    color={toneForScore(headline?.score)}
                  />
                  <KV
                    label="Broader Participation"
                    value={upper(breadth?.label || "UNAVAILABLE")}
                    color={toneForScore(underlyingScore)}
                  />
                  <KV
                    label="Data Status"
                    value={upper(freshness?.state || "UNAVAILABLE")}
                    color={
                      freshness?.usableForTrapConfirmation
                        ? COLORS.green
                        : COLORS.yellow
                    }
                  />
                </div>
              </Card>

              <Card
                title={`Market Participation — ${fmt(scanned || 5470)} Stocks`}
                accent={
                  sellVolPct != null && sellVolPct > buyVolPct
                    ? COLORS.red
                    : COLORS.green
                }
                style={{
                  padding: 16,
                  borderTop: `3px solid ${
                    sellVolPct != null && sellVolPct > buyVolPct
                      ? COLORS.red
                      : COLORS.green
                  }`,
                }}
              >
                <div
                  style={{
                    color: COLORS.muted,
                    fontSize: 12,
                    lineHeight: 1.4,
                    marginBottom: 12,
                  }}
                >
                  Real market coverage, breadth, stock volume, and distribution
                  across the Engine25 stock universe.
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      border: "1px solid rgba(56,189,248,.22)",
                      borderRadius: 10,
                      padding: 11,
                      background: "rgba(2,6,23,.30)",
                    }}
                  >
                    <div style={{ color: COLORS.blue, fontWeight: 950, marginBottom: 7 }}>
                      MARKET COVERAGE
                    </div>
                    <KV label="Stocks Scanned" value={fmt(scanned)} color={COLORS.blue} />
                    <KV label="Stocks With Volume" value={fmt(withVolume)} />
                    <KV
                      label="Volume Coverage"
                      value={pct(coverage, 1)}
                      color={
                        coverage == null
                          ? COLORS.muted
                          : coverage >= 70
                            ? COLORS.green
                            : COLORS.red
                      }
                    />
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(34,197,94,.20)",
                      borderRadius: 10,
                      padding: 11,
                      background: "rgba(2,6,23,.30)",
                    }}
                  >
                    <div style={{ color: COLORS.green, fontWeight: 950, marginBottom: 7 }}>
                      BREADTH
                    </div>
                    <KV
                      label="Advancing"
                      value={
                        totalUp == null
                          ? "—"
                          : `${fmt(totalUp)} (${pct(buyBreadthPct, 0)})`
                      }
                      color={COLORS.green}
                    />
                    <KV
                      label="Declining"
                      value={
                        totalDown == null
                          ? "—"
                          : `${fmt(totalDown)} (${pct(sellBreadthPct, 0)})`
                      }
                      color={COLORS.red}
                    />
                    <KV label="New Highs" value={fmt(nh)} color={COLORS.green} />
                    <KV label="New Lows" value={fmt(nl)} color={COLORS.red} />
                    <KV
                      label="Sector Participation"
                      value={
                        currentSectorCount
                          ? `${fmt(currentWeakSectorCount)} weak / ${fmt(currentSectorCount)}`
                          : "UNAVAILABLE"
                      }
                      color={
                        currentWeakSectorCount != null &&
                        currentSectorCount != null &&
                        currentWeakSectorCount > currentSectorCount / 2
                          ? COLORS.red
                          : COLORS.yellow
                      }
                    />
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(239,68,68,.22)",
                      borderRadius: 10,
                      padding: 11,
                      background: "rgba(2,6,23,.30)",
                    }}
                  >
                    <div style={{ color: COLORS.red, fontWeight: 950, marginBottom: 7 }}>
                      STOCK VOLUME
                    </div>
                    <KV
                      label="Advancing Volume"
                      value={pct(buyVolPct, 1)}
                      color={COLORS.green}
                    />
                    <KV
                      label="Declining Volume"
                      value={pct(sellVolPct, 1)}
                      color={COLORS.red}
                    />

                    <div
                      style={{
                        marginTop: 10,
                        border: `1px solid ${
                          imbalance == null
                            ? COLORS.muted
                            : imbalance > 0
                              ? COLORS.red
                              : COLORS.green
                        }88`,
                        borderRadius: 9,
                        padding: 10,
                        textAlign: "center",
                        background: "rgba(15,23,42,.45)",
                      }}
                    >
                      <div style={{ color: COLORS.muted, fontSize: 10, fontWeight: 850 }}>
                        DIRECTIONAL IMBALANCE
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 23,
                          fontWeight: 1000,
                          color:
                            imbalance == null
                              ? COLORS.muted
                              : imbalance > 0
                                ? COLORS.red
                                : COLORS.green,
                        }}
                      >
                        {imbalance == null
                          ? "UNAVAILABLE"
                          : `${imbalance > 0 ? "+" : ""}${imbalance.toFixed(1)}%`}
                      </div>
                      <div
                        style={{
                          color:
                            imbalance == null
                              ? COLORS.muted
                              : imbalance > 0
                                ? COLORS.red
                                : COLORS.green,
                          fontSize: 10,
                          fontWeight: 900,
                        }}
                      >
                        {imbalance == null
                          ? "NO CURRENT VOLUME READ"
                          : imbalance > 0
                            ? "TOWARD SELLING"
                            : imbalance < 0
                              ? "TOWARD BUYING"
                              : "BALANCED"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid rgba(251,191,36,.22)",
                      borderRadius: 10,
                      padding: 11,
                      background: "rgba(2,6,23,.30)",
                    }}
                  >
                    <div style={{ color: COLORS.yellow, fontWeight: 950, marginBottom: 7 }}>
                      DISTRIBUTION
                    </div>
                    <KV
                      label="Breadth Pressure"
                      value={
                        intradayBreadthPressure == null
                          ? "UNAVAILABLE"
                          : `${fmt(intradayBreadthPressure)} / 100`
                      }
                      color={toneForScore(intradayBreadthPressure, true)}
                    />
                    <KV
                      label="Volume Pressure"
                      value={
                        volumePressure == null
                          ? "UNAVAILABLE"
                          : `${fmt(volumePressure)} / 100`
                      }
                      color={toneForScore(volumePressure, true)}
                    />
                    <KV
                      label="Distribution Pressure"
                      value={upper(distribution?.label || "UNAVAILABLE")}
                      color={toneForScore(distributionPressurePct, true)}
                    />
                    <KV
                      label="Overall Pressure"
                      value={
                        distributionPressurePct == null
                          ? "—"
                          : `${fmt(distributionPressurePct)} / 100`
                      }
                      color={toneForScore(distributionPressurePct, true)}
                    />
                  </div>
                </div>
              </Card>

              <Card title="Index vs Broader Market">
                <div
                  style={{
                    color: COLORS.muted,
                    fontSize: 12,
                    lineHeight: 1.4,
                    marginBottom: 9,
                  }}
                >
                  Is ES stronger or weaker than the stocks underneath it?
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 9,
                  }}
                >
                  <BigStat
                    label="ES Strength"
                    value={masterScore == null ? "—" : fmt(masterScore, 1)}
                    color={toneForScore(masterScore)}
                  />
                  <BigStat
                    label="Broader Market Strength"
                    value={underlyingScore == null ? "—" : fmt(underlyingScore, 0)}
                    color={toneForScore(underlyingScore)}
                  />
                </div>

                <div
                  style={{
                    border: `1px solid ${
                      masterScore != null &&
                      underlyingScore != null &&
                      masterScore - underlyingScore >= 10
                        ? COLORS.red
                        : COLORS.border
                    }`,
                    borderRadius: 9,
                    padding: 10,
                    background:
                      masterScore != null &&
                      underlyingScore != null &&
                      masterScore - underlyingScore >= 10
                        ? "rgba(127,29,29,.18)"
                        : "rgba(15,23,42,.42)",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      color:
                        masterScore != null &&
                        underlyingScore != null &&
                        masterScore - underlyingScore >= 10
                          ? COLORS.red
                          : COLORS.text,
                      fontWeight: 950,
                    }}
                  >
                    {masterScore != null &&
                    underlyingScore != null &&
                    masterScore - underlyingScore >= 10
                      ? "ES IS HOLDING UP BETTER THAN THE BROADER MARKET"
                      : masterScore != null &&
                          underlyingScore != null &&
                          underlyingScore - masterScore >= 10
                        ? "THE BROADER MARKET IS STRONGER THAN ES"
                        : "ES AND THE BROADER MARKET ARE TELLING A SIMILAR STORY"}
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 3 }}>
                    {masterScore != null &&
                    underlyingScore != null &&
                    masterScore - underlyingScore >= 10
                      ? "Most stocks are weaker than the index."
                      : masterScore != null &&
                          underlyingScore != null &&
                          underlyingScore - masterScore >= 10
                        ? "Participation underneath the index is stronger."
                        : "No large index-versus-market gap is showing."}
                  </div>
                </div>

                <KV label="ES Price" value={fmt(headline?.esClose, 2)} />
                <KV
                  label="Broader Market"
                  value={upper(breadth?.label || "UNAVAILABLE")}
                  color={toneForScore(underlyingScore)}
                />
                <KV
                  label="Participation"
                  value={
                    sellBreadthPct == null
                      ? "UNAVAILABLE"
                      : sellBreadthPct >= 55
                        ? "GETTING WEAKER"
                        : "MIXED / STABLE"
                  }
                  color={
                    sellBreadthPct != null && sellBreadthPct >= 55
                      ? COLORS.red
                      : COLORS.yellow
                  }
                />
                <KV
                  label="Index / Market Difference"
                  value={
                    masterScore == null || underlyingScore == null
                      ? "UNAVAILABLE"
                      : Math.abs(masterScore - underlyingScore) >= 10
                        ? "LARGE"
                        : "NORMAL"
                  }
                  color={
                    masterScore != null &&
                    underlyingScore != null &&
                    Math.abs(masterScore - underlyingScore) >= 10
                      ? COLORS.red
                      : COLORS.green
                  }
                />

                <Link
                  to="/market-meter?symbol=ES&tf=10m"
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    color: COLORS.blue,
                    fontSize: 12,
                    fontWeight: 900,
                    textDecoration: "none",
                  }}
                >
                  OPEN MARKET METER →
                </Link>
              </Card>
            </div>

            <Card
              accent={
                sellVolPct != null && sellVolPct > buyVolPct
                  ? COLORS.red
                  : COLORS.green
              }
              style={{
                background:
                  "linear-gradient(180deg, rgba(15,23,42,.88), rgba(7,11,18,.96))",
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 18,
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      color: COLORS.muted,
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                    }}
                  >
                    What the market is saying
                  </div>
                  <div
                    style={{
                      fontSize: 19,
                      lineHeight: 1.35,
                      fontWeight: 950,
                      marginTop: 4,
                    }}
                  >
                    {marketRead}
                  </div>
                </div>
                <StatusPill color={toneForScore(headline?.score)}>
                  {upper(headline?.label || headline?.state)}
                </StatusPill>
              </div>
            </Card>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(520px,1.35fr) minmax(300px,.8fr) minmax(360px,1fr)",
                gap: 14,
              }}
            >
              <Card title="11-Sector Participation — Is Weakness Broad?">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4 }}>
                    See which parts of the market are strong, neutral, or weak.
                  </div>

                  <div
                    style={{
                      display: "inline-flex",
                      gap: 4,
                      padding: 3,
                      border: "1px solid rgba(148,163,184,.20)",
                      borderRadius: 9,
                      background: "rgba(2,6,23,.48)",
                    }}
                  >
                    {["1H", "4H", "EOD"].map((tf) => {
                      const active = sectorTimeframe === tf;
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setSectorTimeframe(tf)}
                          style={{
                            border: active
                              ? "1px solid rgba(248,250,252,.30)"
                              : "1px solid transparent",
                            borderRadius: 7,
                            padding: "6px 11px",
                            background: active
                              ? "rgba(248,250,252,.10)"
                              : "transparent",
                            color: active ? COLORS.text : COLORS.muted,
                            fontSize: 11,
                            fontWeight: 950,
                            cursor: "pointer",
                          }}
                        >
                          {tf}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    color: COLORS.blue,
                    fontSize: 11,
                    fontWeight: 900,
                    marginBottom: 9,
                  }}
                >
                  {sectorTimeframe === "1H"
                    ? "CURRENT 1-HOUR PARTICIPATION"
                    : sectorTimeframe === "4H"
                    ? "BROADER 4-HOUR PARTICIPATION"
                    : "END-OF-DAY PARTICIPATION"}
                </div>

                {cards.length ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 7 }}>
                      {cards.map((c) => {
                        const b = n(c?.breadth_pct);
                        const m = n(c?.momentum_pct);
                        const weak = b != null && m != null && b <= 45 && m <= 45;
                        const strong = b != null && m != null && b >= 55 && m >= 55;
                        const color = weak ? COLORS.red : strong ? COLORS.green : COLORS.yellow;
                        return (
                          <div
                            key={c?.sector}
                            style={{
                              border: `1px solid ${color}99`,
                              borderRadius: 9,
                              padding: 8,
                              background: "linear-gradient(180deg,rgba(18,23,30,.95),rgba(8,11,15,.98))",
                              boxShadow: `inset 0 -2px 0 ${color}22`,
                              transition:
                                "border-color 250ms ease, box-shadow 250ms ease, background 250ms ease",
                            }}
                          >
                            <div style={{ fontSize: 11, color: COLORS.muted, minHeight: 28 }}>
                              {c?.sector}
                            </div>
                            <div style={{ color, fontWeight: 950 }}>
                              {b == null ? "—" : fmt(b, 0)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 14, color: COLORS.muted, fontSize: 12 }}>
                      <span><b style={{ color: COLORS.green }}>{strongSectors}</b> strong</span>
                      <span><b style={{ color: COLORS.yellow }}>{mixedSectors}</b> neutral</span>
                      <span><b style={{ color: COLORS.red }}>{weakSectors}</b> weak</span>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      border: "1px solid rgba(251,191,36,.22)",
                      borderRadius: 9,
                      padding: 12,
                      color: COLORS.yellow,
                      fontSize: 12,
                      fontWeight: 850,
                    }}
                  >
                    {sectorTimeframe} sector participation unavailable.
                  </div>
                )}

                <Link
                  to="/index-sectors?symbol=ES&tf=10m"
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    color: COLORS.yellow,
                    fontSize: 12,
                    fontWeight: 900,
                    textDecoration: "none",
                  }}
                >
                  OPEN ALL 11 SECTORS →
                </Link>
              </Card>

              <Card title="Financial Stress">
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 8 }}>
                  Checks credit, bonds, banks, and liquidity for stress that may not yet be obvious in ES.
                </div>
                <KV label="Credit Fragility" value={fmt(credit?.scores?.creditFragility)} color={toneForScore(credit?.scores?.creditFragility)} />
                <KV label="Macro Credit" value={fmt(credit?.scores?.creditStress)} color={toneForScore(credit?.scores?.creditStress)} />
                <KV label="Bond Market" value={fmt(credit?.scores?.bondMarket)} color={toneForScore(credit?.scores?.bondMarket)} />
                <KV label="Liquidity" value={fmt(credit?.scores?.liquidity)} color={toneForScore(credit?.scores?.liquidity)} />
                <div style={{ marginTop: 10, color: COLORS.muted, lineHeight: 1.4 }}>{credit?.interpretation || "Credit / rates / liquidity read unavailable."}</div>
              </Card>

              <Card title="Macro Pressure — Rates, Dollar, Oil" accent={COLORS.red}>
                <div
                  style={{
                    color: COLORS.muted,
                    fontSize: 12,
                    lineHeight: 1.4,
                    marginBottom: 8,
                  }}
                >
                  Current macro prices and whether they are moving up or down
                  during the current session. Yellow means the source is not
                  fresh enough for a live direction.
                </div>

                <MacroMoveRow
                  label="U.S. 10Y Yield"
                  value={macroRates?.tenYearYield}
                  fresh={false}
                  valueSuffix="%"
                />
                <MacroMoveRow
                  label="U.S. 30Y Yield"
                  value={macroRates?.thirtyYearYield}
                  fresh={false}
                  valueSuffix="%"
                />
                <MacroMoveRow
                  label="U.S. Dollar (UUP)"
                  value={dollar?.close ?? dollar?.value}
                  fresh={false}
                />
                <MacroMoveRow
                  label="WTI Oil"
                  value={wti?.price}
                  changePct={wti?.changesPct?.session}
                  fresh={wtiFresh}
                />
                <MacroMoveRow
                  label="Brent Oil"
                  value={brent?.price}
                  changePct={brent?.changesPct?.session}
                  fresh={brentFresh}
                />

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: COLORS.muted, fontSize: 11 }}>
                    Green = up this session · Red = down this session · Yellow = stale
                  </span>
                  <StatusPill color={toneForScore(macro?.score)}>
                    {upper(macro?.state || macro?.label || "UNAVAILABLE")}
                  </StatusPill>
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card title="Active Event Risk" accent={COLORS.orange}>
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 9 }}>
                  Only material events that can meaningfully affect market risk belong here.
                </div>
                {event ? (
                  <>
                    <div style={{ fontSize: 21, fontWeight: 950 }}>{clean(event?.eventType || event?.headlineSummary)}</div>
                    <div style={{ marginTop: 7, color: COLORS.muted, lineHeight: 1.4 }}>{event?.headlineSummary || "Material event active."}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <span style={{ border: `1px solid ${COLORS.red}`, borderRadius: 999, padding: "4px 8px", color: COLORS.red, fontWeight: 850 }}>{upper(event?.severity)}</span>
                      <span style={{ border: `1px solid ${COLORS.yellow}`, borderRadius: 999, padding: "4px 8px", color: COLORS.yellow, fontWeight: 850 }}>{event?.material ? "MATERIAL" : "CONTEXT"}</span>
                      <span style={{ border: `1px solid ${COLORS.blue}`, borderRadius: 999, padding: "4px 8px", color: COLORS.blue, fontWeight: 850 }}>{clean(event?.primaryEntity)}</span>
                    </div>
                  </>
                ) : <div style={{ color: COLORS.muted }}>No active material Engine25 event found.</div>}
              </Card>

              <Card title="Price Support / Selling Pressure">
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 8 }}>
                  Connects market health to the ES price area currently being tested.
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.5 }}>{priceContext}</div>
                <div style={{ marginTop: 10 }}>
                  <KV label="Zone state" value={upper(data?.zoneDecisionRead?.label)} />
                  <KV label="Nearest zone" value={data?.zoneRead?.nearestZone?.id || "—"} />
                  <KV label="Buying support" value={upper(data?.zoneClassification?.accumulationRead?.state)} color={COLORS.yellow} />
                  <KV label="Distribution in zone" value={upper(data?.zoneClassification?.distributionRead?.state)} color={COLORS.red} />
                </div>

                <Link
                  to={linkedChartHref}
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    color: COLORS.blue,
                    fontSize: 12,
                    fontWeight: 900,
                    textDecoration: "none",
                  }}
                >
                  OPEN PRICE CONTEXT ON CHART →
                </Link>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(360px,.75fr) minmax(650px,1.25fr)", gap: 14 }}>
              <Card title="What Changed Since Yesterday?">
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 8 }}>
                  Direction matters more than a single snapshot. This shows which major forces improved or deteriorated.
                </div>
                {changed.length ? changed.map((row) => {
                  const v = n(row?.oneDayChange);
                  const inverse = row?.label === "Distribution";
                  const good = v == null ? null : inverse ? v < 0 : v > 0;
                  return (
                    <KV
                      key={row.label}
                      label={row.label}
                      value={v == null ? "—" : `${v > 0 ? "+" : ""}${v}`}
                      color={good == null ? COLORS.muted : good ? COLORS.green : COLORS.red}
                    />
                  );
                }) : <div style={{ color: COLORS.muted }}>1-day comparison unavailable.</div>}
                <div style={{ marginTop: 12, color: COLORS.muted, lineHeight: 1.4 }}>{data?.underTheHood?.interpretation || "No comparison interpretation available."}</div>
              </Card>

              <Card title="Market Health Trend — 6 Months" accent={COLORS.orange}>
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 6 }}>
                  Places today's Engine25 reading in historical context rather than judging one day by itself.
                </div>
                <PlainLineChart rows={overlayRows} />
              </Card>
            </div>

            <Card title="Data Confidence & Engine25 Detail" accent={COLORS.blue}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                <BigStat
                  label="Scanner Status"
                  value={upper(freshness?.state || "UNAVAILABLE")}
                  color={freshness?.usableForTrapConfirmation ? COLORS.green : COLORS.yellow}
                />
                <BigStat
                  label="Volume Coverage"
                  value={pct(coverage, 1)}
                  color={coverage >= 70 ? COLORS.green : COLORS.red}
                />
                <BigStat
                  label="Source Time"
                  value={freshness?.intraday?.sourceTimestamp ? "AVAILABLE" : "MISSING"}
                  color={freshness?.intraday?.sourceTimestamp ? COLORS.green : COLORS.red}
                  note={freshness?.intraday?.sourceTimestamp || "—"}
                />
              </div>
              <div style={{ marginTop: 10, color: COLORS.muted, lineHeight: 1.45 }}>{data?.deskNote}</div>
            </Card>

            <Card
              title="ENGINE 29 — LIVE MARKET CHARACTER"
              accent={COLORS.red}
              style={{
                background:
                  "linear-gradient(180deg, rgba(20,8,12,.30), rgba(7,10,14,.98) 18%)",
                borderTop: "3px solid #ef4444",
              }}
            >
              <Engine29FullDashboard homeCompact />

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <Link
                  to={linkedWavesHref}
                  style={{
                    textDecoration: "none",
                    border: "1px solid rgba(251,191,36,.40)",
                    background: "rgba(120,53,15,.14)",
                    color: "#fde68a",
                    borderRadius: 9,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  OPEN STRATEGIES / ENGINE26 PLANNER →
                </Link>
              </div>
            </Card>
          </>
        )}
    </div>
  );
}
