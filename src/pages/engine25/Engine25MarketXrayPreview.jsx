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
const SNAPSHOT_ROUTE = `${API_ROOT}/api/v1/dashboard-snapshot?symbol=ES&includeContext=1`;

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

function toneForScore(value, inverse = false) {
  const x = n(value);
  if (x == null) return COLORS.muted;
  if (inverse) {
    if (x >= 75) return COLORS.red;
    if (x >= 55) return COLORS.orange;
    if (x >= 35) return COLORS.yellow;
    return COLORS.green;
  }
  if (x >= 70) return COLORS.green;
  if (x >= 50) return COLORS.yellow;
  if (x >= 35) return COLORS.orange;
  return COLORS.red;
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

function SimpleGauge({ value, label, inverse = false }) {
  const x = Math.max(0, Math.min(100, n(value) ?? 0));
  const color = toneForScore(x, inverse);
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

function changeRow(rows, label) {
  return (Array.isArray(rows) ? rows : []).find((r) => r?.label === label) || null;
}

export default function Engine25MarketXrayPreview() {
  const [data, setData] = useState(null);
  const [master, setMaster] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [a, b, s] = await Promise.all([
          fetch(ENGINE25_ROUTE, { cache: "no-store" }),
          fetch(MASTER_ROUTE, { cache: "no-store" }),
          fetch(SNAPSHOT_ROUTE, { cache: "no-store" }),
        ]);
        const aj = await a.json();
        const bj = await b.json().catch(() => null);
        const sj = await s.json().catch(() => null);
        if (!a.ok || aj?.ok === false) throw new Error(aj?.error || `HTTP ${a.status}`);
        if (!alive) return;
        setData(aj);
        setMaster(b.ok ? bj : null);
        setSnapshot(s.ok ? sj : null);
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
  const sectorParticipation = participation?.sectorParticipation || {};
  const intradaySectorParticipation = sectorParticipation?.intraday || {};
  const sectorBreadth = data?.sectorBreadth || {};
  const tactical = sectorBreadth?.tactical1h || {};
  const regime = sectorBreadth?.regime4h || {};
  const cards = Array.isArray(intradaySectorParticipation?.cards)
    ? intradaySectorParticipation.cards
    : [];
  const leadership = participation?.newHighsNewLows || {};
  const credit = data?.creditStressDetail || {};
  const macro = data?.macroPressure || {};
  const event = Array.isArray(data?.newsEvents?.activeMaterialEvents)
    ? data.newsEvents.activeMaterialEvents[0] || null
    : null;
  const underRows = data?.underTheHood?.rows || [];
  const overlayRows = data?.overlay?.rows || [];

  const scanned = n(intradayVolume?.stocksScanned);
  const withVolume = n(intradayVolume?.stocksWithVolume);
  const coverage = n(intradayVolume?.coveragePct);
  const buyVolShare = n(intradayVolume?.advancingVolumeShare);
  const sellVolShare = n(intradayVolume?.decliningVolumeShare);
  const volumeImbalance = n(intradayVolume?.volumeImbalance);
  const buyVolPct = buyVolShare == null ? null : buyVolShare * 100;
  const sellVolPct = sellVolShare == null ? null : sellVolShare * 100;
  const imbalancePct = volumeImbalance == null ? null : volumeImbalance * 100;

  const totalUp = n(upDown?.intradayUp);
  const totalDown = n(upDown?.intradayDown);
  const breadthDenom = (totalUp ?? 0) + (totalDown ?? 0);
  const buyBreadthPct = breadthDenom > 0 ? (totalUp / breadthDenom) * 100 : null;
  const sellBreadthPct = breadthDenom > 0 ? (totalDown / breadthDenom) * 100 : null;

  const distributionPressurePct = n(distribution?.rawPressure);

  const masterScore = n(master?.master?.score);
  const underlyingScore = n(breadth?.score);

  const nh = n(leadership?.intradayTotalNh);
  const nl = n(leadership?.intradayTotalNl);

  const bearishSectors = n(intradaySectorParticipation?.bearishCount);
  const bullishSectors = n(intradaySectorParticipation?.bullishCount);
  const neutralSectors = n(intradaySectorParticipation?.neutralCount);

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
    headline?.interpretation ||
    data?.deskNote ||
    "Engine25 canonical market-health interpretation unavailable.";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "none",
        margin: 0,
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
                gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                gap: 8,
              }}
            >
              <BigStat
                label="Market Health"
                value={fmt(headline?.score)}
                color={toneForScore(headline?.score)}
                note={clean(headline?.label || headline?.state)}
              />
              <BigStat
                label="Breadth"
                value={sellBreadthPct == null ? "—" : `${pct(sellBreadthPct)} SELLING`}
                color={sellBreadthPct != null && sellBreadthPct >= 55 ? COLORS.red : COLORS.yellow}
                note="stocks advancing vs declining"
              />
              <BigStat
                label="Stock Volume"
                value={sellVolPct == null ? "—" : `${pct(sellVolPct)} SELLING`}
                color={sellVolPct != null && sellVolPct >= 55 ? COLORS.red : COLORS.yellow}
                note="actual directional volume"
              />
              <BigStat
                label="Distribution"
                value={pct(distributionPressurePct, 0)}
                color={toneForScore(distributionPressurePct, true)}
                note={clean(distribution?.label || "pressure")}
              />
              <BigStat
                label="Sectors"
                value={bearishSectors == null ? "—" : `${fmt(bearishSectors)} BEARISH`}
                color={COLORS.yellow}
                note={
                  bullishSectors == null || neutralSectors == null
                    ? "sector participation unavailable"
                    : `${fmt(bullishSectors)} bullish · ${fmt(neutralSectors)} neutral`
                }
              />
              <BigStat
                label="Data"
                value={upper(freshness?.state || "UNAVAILABLE")}
                color={freshness?.usableForTrapConfirmation ? COLORS.green : COLORS.yellow}
                note={coverage == null ? "coverage unavailable" : `${pct(coverage, 1)} volume coverage`}
              />
            </div>

            <Card
              accent={sellVolPct != null && sellVolPct > buyVolPct ? COLORS.red : COLORS.green}
              style={{
                background: "linear-gradient(180deg, rgba(15,23,42,.88), rgba(7,11,18,.96))",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 18,
                  alignItems: "center",
                  transition: "opacity 300ms ease, transform 300ms ease",
                }}
              >
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>
                    What the market is saying
                  </div>
                  <div style={{ fontSize: 21, lineHeight: 1.35, fontWeight: 950, marginTop: 5 }}>
                    {marketRead}
                  </div>
                </div>
                <StatusPill color={toneForScore(headline?.score)}>
                  {upper(headline?.label || headline?.state)}
                </StatusPill>
              </div>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 14 }}>
              <Card title="Market Health" accent={toneForScore(headline?.score)}>
                <SimpleGauge value={headline?.score} label={upper(headline?.label || headline?.state)} />
                <div style={{ marginTop: 10, fontSize: 13, color: COLORS.muted, textAlign: "center" }}>
                  ES {fmt(headline?.esClose, 2)}
                </div>
              </Card>

              <Card
                title={`UNDER THE MARKET — ${fmt(scanned || 5470)} STOCKS`}
                accent={sellVolPct != null && sellVolPct > buyVolPct ? COLORS.red : COLORS.green}
                style={{ padding: 18 }}
              >
                <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.4, marginBottom: 2 }}>
                  This is the centerpiece: how many stocks are advancing or declining, and where the actual stock volume is flowing.
                </div>
                <div style={{ display: "grid", gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>Stocks / Breadth</div>
                    <SplitBar buy={buyBreadthPct} sell={sellBreadthPct} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>Actual Stock Volume</div>
                    <SplitBar buy={buyVolPct} sell={sellVolPct} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 10 }}>
                    <BigStat label="Stocks With Volume" value={fmt(withVolume)} note={`${pct(coverage, 1)} coverage`} />
                    <BigStat
                      label="Volume Imbalance"
                      value={imbalancePct == null ? "—" : `${imbalancePct >= 0 ? "+" : ""}${imbalancePct.toFixed(1)}%`}
                      color={COLORS.text}
                      note="canonical directional-volume imbalance"
                    />
                    <BigStat
                      label="Overall Read"
                      value={intradayVolume?.available === true ? "AVAILABLE" : "UNAVAILABLE"}
                      color={intradayVolume?.available === true ? COLORS.green : COLORS.yellow}
                      note={intradayVolume?.reason || "canonical stock-volume evidence"}
                    />
                  </div>
                </div>
              </Card>

              <Card title="Index vs Market Underneath">
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 8 }}>
                  Is the headline index telling the same story as the broader market?
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 8, marginBottom: 8 }}>
                  <BigStat label="ES Market Meter" value={masterScore == null ? "—" : fmt(masterScore, 1)} color={toneForScore(masterScore)} />
                  <BigStat label="Underlying Breadth" value={underlyingScore == null ? "—" : fmt(underlyingScore, 0)} color={toneForScore(underlyingScore)} />
                </div>
                <KV label="ES Price" value={fmt(headline?.esClose, 2)} />
                <KV
                  label="Underlying State"
                  value={clean(breadth?.label || "UNAVAILABLE").toUpperCase()}
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 14 }}>
              <Card title="Selling / Distribution Pressure" accent={COLORS.red}>
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 8 }}>
                  Measures whether broad selling is building underneath price. Higher pressure means more defensive conditions.
                </div>
                <SimpleGauge value={distributionPressurePct} label={upper(distribution?.label || "Distribution")} inverse />
                <KV label="Raw pressure" value={pct(distributionPressurePct, 1)} color={COLORS.red} />
                <KV label="Volume pressure" value={fmt(volume?.combinedVolumePressure, 0)} color={COLORS.red} />
                <KV label="Engine25 health score" value={fmt(distribution?.score, 0)} />
              </Card>

              <Card title="Market Leadership — New Highs vs New Lows">
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 10 }}>
                  Shows whether more stocks are breaking to new highs or falling to new lows.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 18, textAlign: "center" }}>
                  <div><div style={{ fontSize: 34, color: COLORS.green, fontWeight: 1000 }}>{fmt(nh)}</div><div style={{ color: COLORS.muted }}>New Highs</div></div>
                  <div><div style={{ fontSize: 34, color: COLORS.red, fontWeight: 1000 }}>{fmt(nl)}</div><div style={{ color: COLORS.muted }}>New Lows</div></div>
                </div>
                <div style={{ marginTop: 14, fontWeight: 900, color: (nl ?? 0) > (nh ?? 0) ? COLORS.red : COLORS.green }}>
                  {(nl ?? 0) > (nh ?? 0) ? "New lows dominate market leadership." : "New highs lead market leadership."}
                </div>
              </Card>

              <Card title="11-Sector Participation — Is Weakness Broad?">
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 9 }}>
                  One weak sector can be noise. Many weak sectors at once means the move is broad.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 7 }}>
                  {cards.map((c) => {
                    const b = n(c?.breadth_pct);
                    const bias = String(c?.bias || "neutral").toLowerCase();
                    const color =
                      bias === "bearish"
                        ? COLORS.red
                        : bias === "bullish"
                        ? COLORS.green
                        : COLORS.yellow;
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
                            "border-color 450ms ease, box-shadow 450ms ease, background 450ms ease, transform 300ms ease",
                        }}
                      >
                        <div style={{ fontSize: 11, color: COLORS.muted, minHeight: 28 }}>{c?.sector}</div>
                        <div style={{ color, fontWeight: 950 }}>{fmt(b, 0)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 14, color: COLORS.muted, fontSize: 12 }}>
                  <span><b style={{ color: COLORS.green }}>{fmt(bullishSectors)}</b> bullish</span>
                  <span><b style={{ color: COLORS.yellow }}>{fmt(neutralSectors)}</b> neutral</span>
                  <span><b style={{ color: COLORS.red }}>{fmt(bearishSectors)}</b> bearish</span>
                </div>

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
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 14 }}>
              <Card title="1H vs 4H Participation">
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 8 }}>
                  1H shows what is happening now. 4H shows whether the broader participation trend agrees.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 18 }}>
                  <SimpleGauge value={tactical?.classification?.score} label={upper(tactical?.classification?.label || "1H")} />
                  <SimpleGauge value={regime?.classification?.score} label={upper(regime?.classification?.label || "4H")} />
                </div>
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

              <Card title="Macro Pressure — Rates, Dollar, Energy">
                <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginBottom: 8 }}>
                  Combines the macro forces most likely to create pressure on the broader market.
                </div>
                <KV label="Score" value={fmt(macro?.score)} color={toneForScore(macro?.score)} />
                <KV label="State" value={upper(macro?.state || macro?.label)} color={toneForScore(macro?.score)} />
                <KV label="2Y Treasury" value={fmt(macro?.inputs?.DGS2?.value ?? macro?.inputs?.DGS2?.latestValue, 2)} />
                <KV label="Yield Curve" value={fmt(macro?.inputs?.T10Y2Y?.value ?? macro?.inputs?.T10Y2Y?.latestValue, 2)} />
                <KV label="Dollar" value={fmt(macro?.inputs?.UUP?.close ?? macro?.inputs?.UUP?.value, 2)} />
                <KV label="Energy / Oil" value={fmt(macro?.inputs?.energyOil?.score ?? macro?.inputs?.WTI?.value, 2)} />
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 14 }}>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 14 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 10 }}>
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
