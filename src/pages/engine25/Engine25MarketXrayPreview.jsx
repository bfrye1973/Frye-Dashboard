// src/pages/engine25/Engine25MarketXrayPreview.jsx
// Redline Trading — Engine 25 Market X-Ray Phase 1
//
// PHASE 1 GOAL:
// - Correct real-data wiring first.
// - No production dashboard replacement.
// - No animation / Ferrari skin yet.
// - No Engine 25 calculations in the frontend.
// - Simple display-only percentages may be derived from already-published counts.
// - Engine 6 remains final permission authority.

import React, { useEffect, useMemo, useState } from "react";
import useDashboardSnapshot from "../../hooks/useDashboardSnapshot";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ENGINE25_ROUTE = `${API_ROOT}/api/v1/engine25/full-dashboard`;
const LIVE_INTRADAY_ROUTE = `${API_ROOT}/live/intraday`;

const FONT = "Arial, Helvetica, sans-serif";
const STRATEGY_ID = "intraday_scalp@10m";

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value, decimals = 0) {
  const n = safeNumber(value);
  return n === null ? "—" : n.toFixed(decimals);
}

function fmtPct(value, decimals = 0) {
  const n = safeNumber(value);
  return n === null ? "—" : `${n.toFixed(decimals)}%`;
}

function fmtSigned(value, decimals = 0) {
  const n = safeNumber(value);
  if (n === null) return "—";
  const text = n.toFixed(decimals);
  return n > 0 ? `+${text}` : text;
}

function clean(value, fallback = "—") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replaceAll("_", " ").replace(/\s+/g, " ");
}

function titleCase(value, fallback = "—") {
  return clean(value, fallback)
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function toneColor(value) {
  const text = String(value || "").toUpperCase();

  if (
    text.includes("HIGH") ||
    text.includes("WEAK") ||
    text.includes("RISK_OFF") ||
    text.includes("BEAR") ||
    text.includes("STRESSED") ||
    text.includes("FRAGILE") ||
    text.includes("DEFENSIVE") ||
    text.includes("DISTRIBUTION")
  ) {
    return "#ef4444";
  }

  if (
    text.includes("WATCH") ||
    text.includes("MIXED") ||
    text.includes("ELEVATED") ||
    text.includes("CAUTION") ||
    text.includes("WAIT")
  ) {
    return "#f59e0b";
  }

  if (
    text.includes("HEALTHY") ||
    text.includes("STRONG") ||
    text.includes("SUPPORT") ||
    text.includes("IMPROVING") ||
    text.includes("CONFIRMED")
  ) {
    return "#22c55e";
  }

  return "#93c5fd";
}

function scoreColor(score, inverse = false) {
  const n = safeNumber(score);
  if (n === null) return "#94a3b8";

  if (inverse) {
    if (n >= 75) return "#ef4444";
    if (n >= 55) return "#f97316";
    if (n >= 35) return "#f59e0b";
    return "#22c55e";
  }

  if (n >= 70) return "#22c55e";
  if (n >= 50) return "#f59e0b";
  if (n >= 35) return "#f97316";
  return "#ef4444";
}

function sum(cards, key) {
  return (cards || []).reduce((total, card) => {
    const n = safeNumber(card?.[key]);
    return total + (n === null ? 0 : n);
  }, 0);
}

function share(part, total) {
  const p = safeNumber(part);
  const t = safeNumber(total);
  if (p === null || t === null || t <= 0) return null;
  return (p / t) * 100;
}

function Panel({ title, subtitle, children, style = {} }) {
  return (
    <section
      style={{
        border: "1px solid #263244",
        background: "#0b1220",
        borderRadius: 14,
        padding: 16,
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          color: "#f8fafc",
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>

      {subtitle ? (
        <div
          style={{
            color: "#94a3b8",
            fontSize: 12,
            marginTop: 3,
            marginBottom: 12,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      ) : (
        <div style={{ height: 10 }} />
      )}

      {children}
    </section>
  );
}

function KV({ label, value, color = "#e5e7eb", sub }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(150px, 1fr) auto",
        gap: 12,
        padding: "5px 0",
        borderBottom: "1px solid rgba(148,163,184,.10)",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 700 }}>
          {label}
        </div>
        {sub ? (
          <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{sub}</div>
        ) : null}
      </div>
      <div style={{ color, fontSize: 14, fontWeight: 900, textAlign: "right" }}>
        {value}
      </div>
    </div>
  );
}

function SplitBar({
  label,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  leftColor = "#22c55e",
  rightColor = "#ef4444",
}) {
  const l = Math.max(0, Math.min(100, safeNumber(leftValue) ?? 0));
  const r = Math.max(0, Math.min(100, safeNumber(rightValue) ?? 0));

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 800 }}>{label}</div>
      <div
        style={{
          height: 22,
          display: "flex",
          overflow: "hidden",
          borderRadius: 7,
          border: "1px solid rgba(148,163,184,.2)",
          background: "#111827",
        }}
      >
        <div
          style={{
            width: `${l}%`,
            background: leftColor,
            color: "#05110a",
            fontSize: 12,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: l > 0 ? 28 : 0,
          }}
        >
          {l >= 12 ? `${Math.round(l)}%` : ""}
        </div>
        <div
          style={{
            width: `${r}%`,
            background: rightColor,
            color: "#fff",
            fontSize: 12,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: r > 0 ? 28 : 0,
          }}
        >
          {r >= 12 ? `${Math.round(r)}%` : ""}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        <span style={{ color: leftColor }}>{leftLabel}</span>
        <span style={{ color: rightColor }}>{rightLabel}</span>
      </div>
    </div>
  );
}

function MiniTrend({ rows }) {
  const points = (rows || [])
    .filter((row) => safeNumber(row?.engine25CompositeScore) !== null)
    .map((row) => safeNumber(row.engine25CompositeScore));

  if (points.length < 2) {
    return <div style={{ color: "#94a3b8" }}>Trend history unavailable.</div>;
  }

  const width = 820;
  const height = 180;
  const pad = 18;
  const path = points
    .map((value, index) => {
      const x = pad + (index / (points.length - 1)) * (width - pad * 2);
      const y = pad + (1 - value / 100) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      {[25, 50, 75].map((level) => {
        const y = pad + (1 - level / 100) * (height - pad * 2);
        return (
          <g key={level}>
            <line
              x1={pad}
              x2={width - pad}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,.18)"
            />
            <text x={pad + 4} y={y - 4} fill="#64748b" fontSize="10">
              {level}
            </text>
          </g>
        );
      })}
      <path
        d={path}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function sectorState(card) {
  const breadth = safeNumber(card?.breadth_pct);
  const momentum = safeNumber(card?.momentum_pct);

  if (breadth === null && momentum === null) return "Unavailable";
  const values = [breadth, momentum].filter((v) => v !== null);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  if (avg >= 55) return "Strong";
  if (avg <= 45) return "Weak";
  return "Mixed";
}

function sectorTone(state) {
  if (state === "Strong") return "#22c55e";
  if (state === "Weak") return "#ef4444";
  if (state === "Mixed") return "#f59e0b";
  return "#64748b";
}

function activeNewsEvent(newsEvents) {
  const events = Array.isArray(newsEvents?.events) ? newsEvents.events : [];

  const activeMaterial = events.filter((event) => {
    const expires = Date.parse(event?.expiresAt || "");
    const activeByTime = Number.isFinite(expires) ? Date.now() < expires : true;
    return event?.material === true && activeByTime;
  });

  const rank = { EXTREME: 4, HIGH: 3, MODERATE: 2, LOW: 1 };

  return activeMaterial.sort(
    (a, b) =>
      (rank[String(b?.severity || "").toUpperCase()] || 0) -
      (rank[String(a?.severity || "").toUpperCase()] || 0)
  )[0] || events[0] || null;
}

function extractMacroRows(macroPressure) {
  const inputs = macroPressure?.inputs || {};
  const preferred = [
    ["DGS2", "Rates"],
    ["T10Y2Y", "Yield Curve"],
    ["UUP", "Dollar"],
    ["ENERGY", "Energy"],
    ["energy", "Energy"],
    ["oil", "Energy"],
    ["WTI", "Energy"],
  ];

  const used = new Set();
  const rows = [];

  for (const [key, label] of preferred) {
    const item = inputs?.[key];
    if (!item || used.has(label)) continue;
    used.add(label);
    rows.push({
      label,
      value:
        item?.state ||
        item?.status ||
        item?.direction ||
        item?.label ||
        item?.read ||
        item?.value ||
        "Available",
    });
  }

  if (rows.length < 4) {
    for (const [key, item] of Object.entries(inputs)) {
      const label = titleCase(key);
      if (rows.some((row) => row.label === label)) continue;
      rows.push({
        label,
        value:
          item?.state ||
          item?.status ||
          item?.direction ||
          item?.label ||
          item?.read ||
          item?.value ||
          "Available",
      });
      if (rows.length >= 4) break;
    }
  }

  return rows;
}

function firstTarget(geometry, sequence) {
  const targets = Array.isArray(geometry?.proposedTargets)
    ? geometry.proposedTargets
    : [];
  return (
    targets.find((target) => Number(target?.sequence) === sequence) ||
    targets[sequence - 1] ||
    null
  );
}

export default function Engine25MarketXrayPreview() {
  const [engine25, setEngine25] = useState(null);
  const [liveIntraday, setLiveIntraday] = useState(null);
  const [error, setError] = useState(null);
  const [lastLoad, setLastLoad] = useState(null);

  const snapshotState = useDashboardSnapshot("ES", {
    pollMs: 20000,
    timeoutMs: 20000,
    includeContext: 1,
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [e25Res, liveRes] = await Promise.all([
          fetch(ENGINE25_ROUTE, { cache: "no-store" }),
          fetch(LIVE_INTRADAY_ROUTE, { cache: "no-store" }),
        ]);

        const e25 = await e25Res.json().catch(() => null);
        const live = await liveRes.json().catch(() => null);

        if (!e25Res.ok || !e25 || e25?.ok === false) {
          throw new Error(e25?.error || `Engine25 HTTP ${e25Res.status}`);
        }

        if (!liveRes.ok || !live) {
          throw new Error(live?.error || `Live intraday HTTP ${liveRes.status}`);
        }

        if (!alive) return;

        setEngine25(e25);
        setLiveIntraday(live);
        setError(null);
        setLastLoad(new Date().toISOString());
      } catch (err) {
        if (!alive) return;
        setError(err?.message || String(err));
      }
    }

    load();
    const timer = setInterval(load, 30000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const cards = useMemo(() => {
    if (Array.isArray(liveIntraday?.sectorCards)) return liveIntraday.sectorCards;
    if (Array.isArray(liveIntraday?.data?.sectorCards)) return liveIntraday.data.sectorCards;
    return [];
  }, [liveIntraday]);

  const participationArtifact = engine25?.participationArtifact || null;
  const participation = participationArtifact?.participation || {};
  const stockVolume = participation?.stockVolume || {};
  const intradayVolume = stockVolume?.intraday || {};
  const distribution = participation?.distributionPressure || {};
  const freshness = participationArtifact?.freshness || {};

  const totalUp = useMemo(() => sum(cards, "up"), [cards]);
  const totalDown = useMemo(() => sum(cards, "down"), [cards]);
  const totalNh = useMemo(() => sum(cards, "nh"), [cards]);
  const totalNl = useMemo(() => sum(cards, "nl"), [cards]);
  const totalScanned = useMemo(() => sum(cards, "stocksScanned"), [cards]);
  const totalWithVolume = useMemo(() => sum(cards, "stocksWithVolume"), [cards]);

  const directionalStocks = totalUp + totalDown;
  const breadthBuyPct = share(totalUp, directionalStocks);
  const breadthSellPct = share(totalDown, directionalStocks);

  const volumeBuyPct =
    safeNumber(intradayVolume?.advancingVolumeShare) === null
      ? null
      : safeNumber(intradayVolume.advancingVolumeShare) * 100;

  const volumeSellPct =
    safeNumber(intradayVolume?.decliningVolumeShare) === null
      ? null
      : safeNumber(intradayVolume.decliningVolumeShare) * 100;

  const volumeImbalancePct =
    safeNumber(intradayVolume?.volumeImbalance) === null
      ? null
      : safeNumber(intradayVolume.volumeImbalance) * 100;

  const coveragePct =
    safeNumber(intradayVolume?.coveragePct) ??
    share(totalWithVolume, totalScanned);

  const rawDistributionPressure =
    safeNumber(distribution?.rawPressure) ??
    (safeNumber(distribution?.score) === null
      ? null
      : 100 - safeNumber(distribution.score));

  const headline = engine25?.headline || {};
  const underRows = Array.isArray(engine25?.underTheHood?.rows)
    ? engine25.underTheHood.rows
    : [];
  const esRow = underRows.find((row) => row?.label === "ES Close") || null;

  const sectorBreadth = engine25?.sectorBreadth || {};
  const tactical1h = sectorBreadth?.tactical1h?.classification || {};
  const regime4h = sectorBreadth?.regime4h?.classification || {};

  const creditScores = engine25?.creditStressDetail?.scores || {};
  const macroPressure = engine25?.macroPressure || {};
  const macroRows = extractMacroRows(macroPressure);

  const event = activeNewsEvent(engine25?.newsEvents);

  const zoneRead = engine25?.zoneRead || {};
  const zoneDecision = engine25?.zoneDecisionRead || {};
  const zoneState = zoneRead?.zoneState || {};

  const strategy = snapshotState?.data?.strategies?.[STRATEGY_ID] || null;
  const candidate = strategy?.engine26LocationCandidate || null;
  const geometry = strategy?.engine26ProposedGeometry || null;
  const entryZone = candidate?.entryZone || candidate?.zone || {};
  const t1 = firstTarget(geometry, 1);
  const t2 = firstTarget(geometry, 2);

  const marketHealthLabel = clean(headline?.label || headline?.state);
  const dataStatus =
    freshness?.state ||
    (participationArtifact ? "PARTICIPATION ARTIFACT AVAILABLE" : "WAITING FOR PARTICIPATION ARTIFACT");

  const activeSectorCount = cards.length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        fontFamily: FONT,
        padding: "18px 22px 40px",
      }}
    >
      <div style={{ maxWidth: 1900, margin: "0 auto", display: "grid", gap: 14 }}>
        <header
          style={{
            border: "1px solid #263244",
            borderRadius: 16,
            background: "#08111f",
            padding: "18px 20px",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 20,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#ef4444", letterSpacing: ".16em" }}>
              REDLINE TRADING · POWERED BY AI
            </div>
            <div style={{ fontSize: 30, fontWeight: 950, color: "#f8fafc", marginTop: 5 }}>
              ENGINE 25 — MARKET X-RAY
            </div>
            <div style={{ color: "#94a3b8", marginTop: 5, fontSize: 14 }}>
              Phase 1 preview · correct data first · no animation · no production replacement
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 950,
                lineHeight: 1,
                color: scoreColor(headline?.score),
              }}
            >
              {fmt(headline?.score)}
            </div>
            <div style={{ color: toneColor(marketHealthLabel), fontWeight: 900, marginTop: 4 }}>
              {marketHealthLabel}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 5 }}>
              ES {fmt(headline?.esClose, 2)} · {lastLoad ? new Date(lastLoad).toLocaleTimeString() : "loading"}
            </div>
          </div>
        </header>

        {error ? (
          <div
            style={{
              border: "1px solid rgba(239,68,68,.45)",
              background: "rgba(127,29,29,.25)",
              padding: 12,
              borderRadius: 12,
              color: "#fecaca",
            }}
          >
            Preview data error: {error}
          </div>
        ) : null}

        <Panel
          title={`1. Under the Market — ${totalScanned ? totalScanned.toLocaleString() : "5,470"} Stocks`}
          subtitle="The centerpiece: stock participation and actual stock volume from the broad scanner."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1.2fr) minmax(220px,.55fr) minmax(0,1.2fr)",
              gap: 18,
              alignItems: "center",
            }}
          >
            <SplitBar
              label="Stocks / Breadth"
              leftLabel="Buying"
              leftValue={breadthBuyPct}
              rightLabel="Selling"
              rightValue={breadthSellPct}
            />

            <div
              style={{
                textAlign: "center",
                borderLeft: "1px solid #263244",
                borderRight: "1px solid #263244",
                padding: "4px 16px",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>VOLUME COVERAGE</div>
              <div style={{ fontSize: 28, fontWeight: 950, color: "#f8fafc", marginTop: 3 }}>
                {fmtPct(coveragePct, 1)}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>
                {totalWithVolume ? totalWithVolume.toLocaleString() : "—"} stocks with volume
              </div>
              <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 900, marginTop: 10 }}>
                {volumeImbalancePct === null
                  ? "Directional imbalance unavailable"
                  : `${fmtSigned(volumeImbalancePct, 1)}% toward selling`}
              </div>
            </div>

            <SplitBar
              label="Actual Stock Volume"
              leftLabel="Buying Volume"
              leftValue={volumeBuyPct}
              rightLabel="Selling Volume"
              rightValue={volumeSellPct}
            />
          </div>

          <div
            style={{
              marginTop: 14,
              borderTop: "1px solid #263244",
              paddingTop: 12,
              fontSize: 16,
              fontWeight: 950,
              color: breadthSellPct > 55 || volumeSellPct > 55 ? "#ef4444" : "#f59e0b",
            }}
          >
            Overall: {breadthSellPct > 55 && volumeSellPct > 55
              ? "Broad selling pressure"
              : "Mixed participation"}
          </div>
        </Panel>

        <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr .75fr", gap: 14 }}>
          <Panel
            title="2. Index vs Underlying Market"
            subtitle="Price on top; participation underneath. Phase 1 shows the raw comparison without inventing a new canonical divergence state."
          >
            <KV label="ES Close" value={fmt(headline?.esClose, 2)} color="#f8fafc" />
            <KV label="ES 1D Change" value={fmtSigned(esRow?.oneDayChange, 2)} color={scoreColor(50)} />
            <KV
              label="Underlying Breadth"
              value={breadthSellPct === null ? "—" : `${fmtPct(breadthSellPct, 0)} selling`}
              color={breadthSellPct > 55 ? "#ef4444" : "#f59e0b"}
            />
            <KV
              label="Actual Stock Volume"
              value={volumeSellPct === null ? "—" : `${fmtPct(volumeSellPct, 0)} selling`}
              color={volumeSellPct > 55 ? "#ef4444" : "#f59e0b"}
            />
            <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.4, marginTop: 10 }}>
              This block intentionally does not manufacture a divergence label in Phase 1.
            </div>
          </Panel>

          <Panel title="3. Distribution Pressure" subtitle="Breadth + actual stock-volume pressure.">
            <div style={{ fontSize: 42, fontWeight: 950, color: scoreColor(rawDistributionPressure, true) }}>
              {fmtPct(rawDistributionPressure, 0)}
            </div>
            <div style={{ color: toneColor(distribution?.label), fontWeight: 900, marginBottom: 10 }}>
              {clean(distribution?.label)}
            </div>
            <KV label="Engine25 Score" value={fmt(distribution?.score)} />
            <KV label="Volume Pressure" value={fmtPct(stockVolume?.combinedVolumePressure, 0)} />
            <KV label="Legacy Pressure" value={fmtPct(distribution?.inputs?.legacyRawPressure, 0)} />
          </Panel>

          <Panel title="4. New Highs vs New Lows" subtitle="Live scanner totals across the 11 sector cards.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>NEW HIGHS</div>
                <div style={{ color: "#22c55e", fontSize: 30, fontWeight: 950 }}>
                  {totalNh.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>NEW LOWS</div>
                <div style={{ color: "#ef4444", fontSize: 30, fontWeight: 950 }}>
                  {totalNl.toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ color: "#cbd5e1", marginTop: 12, fontSize: 13 }}>
              Net: {fmtSigned(totalNh - totalNl, 0)}
            </div>
          </Panel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.35fr .65fr", gap: 14 }}>
          <Panel
            title={`5. 11-Sector Participation`}
            subtitle={activeSectorCount ? `${activeSectorCount} canonical sector cards from the live scanner.` : "Waiting for sector cards."}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {cards.map((card) => {
                const state = sectorState(card);
                const color = sectorTone(state);
                return (
                  <div
                    key={card?.sector}
                    style={{
                      border: `1px solid ${color}55`,
                      borderRadius: 10,
                      padding: 10,
                      background: "#07101c",
                    }}
                  >
                    <div style={{ color: "#f8fafc", fontSize: 12, fontWeight: 900 }}>
                      {card?.sector || "Sector"}
                    </div>
                    <div style={{ color, fontSize: 14, fontWeight: 950, marginTop: 6 }}>
                      {state}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 5 }}>
                      Breadth {fmtPct(card?.breadth_pct, 0)} · Momentum {fmtPct(card?.momentum_pct, 0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="6. Short-Term vs Broader Participation" subtitle="Current tactical read compared with the broader regime.">
            <KV
              label="1H Tactical"
              value={clean(tactical1h?.label)}
              color={toneColor(tactical1h?.label)}
            />
            <KV label="1H Score" value={fmt(tactical1h?.score, 2)} />
            <KV
              label="4H Regime"
              value={clean(regime4h?.label)}
              color={toneColor(regime4h?.label)}
            />
            <KV label="4H Score" value={fmt(regime4h?.score, 2)} />
          </Panel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Panel title="7. Credit / Financial Stress" subtitle="Institutional background stress gauges already owned by Engine25.">
            <KV label="Credit Fragility" value={fmt(creditScores?.creditFragility)} color={scoreColor(creditScores?.creditFragility)} />
            <KV label="Macro Credit Health" value={fmt(creditScores?.creditStress)} color={scoreColor(creditScores?.creditStress)} />
            <KV label="Bond Market" value={fmt(creditScores?.bondMarket)} color={scoreColor(creditScores?.bondMarket)} />
            <KV label="Liquidity" value={fmt(creditScores?.liquidity)} color={scoreColor(creditScores?.liquidity)} />
          </Panel>

          <Panel title="8. Macro Pressure" subtitle="Rates, dollar, energy and curve context from Engine25's existing MacroPressure component.">
            <div style={{ fontSize: 34, fontWeight: 950, color: scoreColor(macroPressure?.score) }}>
              {fmt(macroPressure?.score)}
            </div>
            <div style={{ color: toneColor(macroPressure?.label), fontWeight: 900, marginBottom: 8 }}>
              {clean(macroPressure?.label || macroPressure?.state)}
            </div>
            {macroRows.length ? (
              macroRows.map((row) => (
                <KV key={row.label} label={row.label} value={clean(row.value)} color={toneColor(row.value)} />
              ))
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 12 }}>
                MacroPressure inputs are not exposed on this build yet.
              </div>
            )}
          </Panel>

          <Panel title="9. Event Pressure / News Risk" subtitle="Top active material Engine25 event, not a scrolling news feed.">
            {event ? (
              <>
                <div style={{ color: "#f8fafc", fontSize: 17, fontWeight: 950 }}>
                  {clean(event?.eventType || event?.headlineSummary || "Market Event")}
                </div>
                <KV label="Severity" value={clean(event?.severity)} color={toneColor(event?.severity)} />
                <KV label="Material" value={event?.material === true ? "YES" : "NO"} color={event?.material ? "#ef4444" : "#94a3b8"} />
                <KV label="Entity" value={event?.primaryEntity || "—"} />
                <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.45, marginTop: 8 }}>
                  {event?.headlineSummary || "Engine25 active event is available."}
                </div>
              </>
            ) : (
              <div style={{ color: "#94a3b8" }}>No active material event in the current file.</div>
            )}
          </Panel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: ".9fr 1.1fr", gap: 14 }}>
          <Panel title="10. Price Zone + Market Health" subtitle="Location/context only. Engine6 remains the final permission authority.">
            <KV label="Zone State" value={clean(zoneState?.state || zoneDecision?.label)} color={toneColor(zoneState?.state || zoneDecision?.label)} />
            <KV label="Zone Context" value={clean(zoneDecision?.priorityRead || "Available")} />
            <KV
              label="Institutional Zone"
              value={
                zoneRead?.nearestZone?.institutional
                  ? `${fmt(zoneRead.nearestZone.institutional.lo, 2)}–${fmt(zoneRead.nearestZone.institutional.hi, 2)}`
                  : "—"
              }
            />
            <KV
              label="Negotiated Zone"
              value={
                zoneRead?.nearestZone?.negotiated
                  ? `${fmt(zoneRead.nearestZone.negotiated.lo, 2)}–${fmt(zoneRead.nearestZone.negotiated.hi, 2)}`
                  : "—"
              }
            />
            <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.45, marginTop: 10 }}>
              {zoneRead?.plainEnglish || "No zone-aware read available."}
            </div>
          </Panel>

          <Panel title="11. What Changed?" subtitle="Existing Engine25 1-day / 3-day comparisons.">
            <div style={{ display: "grid", gridTemplateColumns: "1.25fr .55fr .55fr", gap: 8, color: "#94a3b8", fontSize: 11, fontWeight: 900 }}>
              <div>METRIC</div>
              <div style={{ textAlign: "right" }}>1D</div>
              <div style={{ textAlign: "right" }}>3D</div>
            </div>
            {underRows.slice(0, 8).map((row) => (
              <div
                key={row?.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.25fr .55fr .55fr",
                  gap: 8,
                  padding: "6px 0",
                  borderTop: "1px solid rgba(148,163,184,.10)",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "#e5e7eb", fontWeight: 800 }}>{row?.label}</div>
                <div style={{ textAlign: "right", color: safeNumber(row?.oneDayChange) < 0 ? "#ef4444" : "#22c55e", fontWeight: 900 }}>
                  {fmtSigned(row?.oneDayChange, row?.label === "ES Close" ? 2 : 0)}
                </div>
                <div style={{ textAlign: "right", color: safeNumber(row?.threeDayChange) < 0 ? "#ef4444" : "#22c55e", fontWeight: 900 }}>
                  {fmtSigned(row?.threeDayChange, row?.label === "ES Close" ? 2 : 0)}
                </div>
              </div>
            ))}
          </Panel>
        </div>

        <Panel title="12. Market Health Trend" subtitle="Existing 6-month Engine25 composite history, renamed for normal users.">
          <MiniTrend rows={engine25?.overlay?.rows || []} />
        </Panel>

        <section
          style={{
            border: "2px solid rgba(56,189,248,.35)",
            background: "#07111d",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={{ color: "#38bdf8", fontSize: 22, fontWeight: 950 }}>
            ENGINE 26 — LOCATION / PLANNER
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3, marginBottom: 14 }}>
            Existing canonical Strategy 1 candidate and proposed geometry from the shared dashboard snapshot.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <Panel title="Setup Status" style={{ background: "#08111d" }}>
              <KV label="Setup Class" value={clean(candidate?.setupClass)} />
              <KV label="Grade" value={clean(candidate?.setupGrade)} color="#22c55e" />
              <KV label="Direction" value={clean(candidate?.currentObservationDirection || candidate?.direction)} color={toneColor(candidate?.currentObservationDirection || candidate?.direction)} />
              <KV label="State" value={clean(candidate?.status || candidate?.directionState)} color={toneColor(candidate?.status || candidate?.directionState)} />
            </Panel>

            <Panel title="Location / Zone" style={{ background: "#08111d" }}>
              <KV
                label="Zone"
                value={
                  safeNumber(entryZone?.low ?? entryZone?.lo) !== null &&
                  safeNumber(entryZone?.high ?? entryZone?.hi) !== null
                    ? `${fmt(entryZone?.low ?? entryZone?.lo, 2)}–${fmt(entryZone?.high ?? entryZone?.hi, 2)}`
                    : "—"
                }
              />
              <KV label="Mid" value={fmt(entryZone?.mid ?? entryZone?.midline, 2)} />
              <KV label="Current Price" value={fmt(candidate?.currentPrice, 2)} />
              <KV label="Candidate" value={candidate?.candidateId || "—"} />
            </Panel>

            <Panel title="Trade Geometry" style={{ background: "#08111d" }}>
              <KV label="Entry" value={fmt(geometry?.proposedEntryPrice, 2)} color="#f59e0b" />
              <KV label="Stop" value={fmt(geometry?.proposedStopPrice, 2)} color="#ef4444" />
              <KV label="T1" value={fmt(t1?.price ?? geometry?.target1Price, 2)} color="#22c55e" />
              <KV label="T2" value={fmt(t2?.price ?? geometry?.target2Price, 2)} color="#22c55e" />
            </Panel>

            <Panel title="Planner Read" style={{ background: "#08111d" }}>
              <KV label="Lifecycle" value={clean(geometry?.lifecycleStatus || geometry?.status)} color={toneColor(geometry?.lifecycleStatus || geometry?.status)} />
              <KV label="Geometry Ready" value={geometry?.geometryReady === true ? "YES" : "NO"} color={geometry?.geometryReady ? "#22c55e" : "#f59e0b"} />
              <KV label="Proposal Only" value={geometry?.proposalOnly === false ? "NO" : "YES"} />
              <KV label="Engine6" value="SEPARATE FINAL AUTHORITY" color="#93c5fd" />
            </Panel>
          </div>
        </section>

        <Panel title="Data Status" subtitle="Phase 1 truth check.">
          <KV
            label="Participation Freshness"
            value={clean(dataStatus)}
            color={freshness?.usableForTrapConfirmation ? "#22c55e" : "#f59e0b"}
          />
          <KV
            label="Usable for Trap Confirmation"
            value={freshness?.usableForTrapConfirmation === true ? "YES" : "NO"}
            color={freshness?.usableForTrapConfirmation ? "#22c55e" : "#f59e0b"}
          />
          <KV label="Stocks Scanned" value={totalScanned ? totalScanned.toLocaleString() : "—"} />
          <KV label="Stocks With Volume" value={totalWithVolume ? totalWithVolume.toLocaleString() : "—"} />
          <KV label="Snapshot" value={snapshotState?.data?.now || snapshotState?.data?.ts || "—"} />
          {snapshotState?.err ? (
            <div style={{ color: "#fecaca", fontSize: 12, marginTop: 8 }}>
              Snapshot warning: {snapshotState.err}
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
