// src/pages/engine25/Engine25MarketXrayPreview.jsx
// Phase 1: correctness-first Engine25 Market X-Ray preview.
// No animation. No Engine26. No production dashboard replacement.

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ENGINE25_ROUTE = `${API_ROOT}/api/v1/engine25/full-dashboard`;
const MASTER_ROUTE = `${API_ROOT}/api/v1/futures/market-meter?symbol=ES`;

const COLORS = {
  bg: "#05070b",
  panel: "#0b1018",
  panel2: "#0e1520",
  border: "#263241",
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
        background: COLORS.panel,
        border: `1px solid ${accent}`,
        borderRadius: 12,
        padding: 14,
        minWidth: 0,
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
          border: "10px solid rgba(148,163,184,.18)",
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

function currentNewsEvent(news) {
  const events = Array.isArray(news?.events) ? news.events : [];
  const active = events.filter((e) => {
    const exp = Date.parse(e?.expiresAt || "");
    return e?.material === true && (!Number.isFinite(exp) || Date.now() < exp);
  });
  const rank = { EXTREME: 4, HIGH: 3, MODERATE: 2, LOW: 1 };
  return active.sort(
    (a, b) => (rank[String(b?.severity || "").toUpperCase()] || 0) -
              (rank[String(a?.severity || "").toUpperCase()] || 0)
  )[0] || events[0] || null;
}

function changeRow(rows, label) {
  return (Array.isArray(rows) ? rows : []).find((r) => r?.label === label) || null;
}

export default function Engine25MarketXrayPreview() {
  const [data, setData] = useState(null);
  const [master, setMaster] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);

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
  const cards = Array.isArray(tactical?.cards) ? tactical.cards : [];
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

  const nh = n(tacticalSummary?.totalNh);
  const nl = n(tacticalSummary?.totalNl);

  const weakSectors = cards.filter((c) => n(c?.breadth_pct) <= 45 && n(c?.momentum_pct) <= 45).length;
  const strongSectors = cards.filter((c) => n(c?.breadth_pct) >= 55 && n(c?.momentum_pct) >= 55).length;
  const mixedSectors = Math.max(0, cards.length - weakSectors - strongSectors);

  const changed = [
    changeRow(underRows, "Breadth"),
    changeRow(underRows, "Distribution"),
    changeRow(underRows, "Credit Fragility"),
    changeRow(underRows, "Macro Aware"),
  ].filter(Boolean);

  const priceContext =
    data?.zoneDecisionRead?.priorityRead ||
    data?.zoneRead?.plainEnglish ||
    "Price / zone context unavailable.";

  const marketRead =
    scanned
      ? `${fmt(scanned)} stocks scanned. ${sellBreadthPct != null ? pct(sellBreadthPct) : "—"} of directional breadth and ${sellVolPct != null ? pct(sellVolPct) : "—"} of directional volume are on the selling side.`
      : headline?.interpretation || data?.deskNote || "Engine25 market-health read available.";

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, padding: "18px 22px 40px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 1900, margin: "0 auto", display: "grid", gap: 14 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", borderBottom: "1px solid #263241", paddingBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 28 }}>REDLINE TRADING — ENGINE 25 MARKET X-RAY</div>
            <div style={{ color: COLORS.muted, marginTop: 4 }}>Phase 1 preview · correctness first · live Engine25 data · no animation</div>
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

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,.55fr) minmax(520px,1fr) minmax(320px,.65fr)", gap: 14 }}>
              <Card title="Market Health" accent={toneForScore(headline?.score)}>
                <SimpleGauge value={headline?.score} label={upper(headline?.label || headline?.state)} />
                <div style={{ marginTop: 10, fontSize: 13, color: COLORS.muted, textAlign: "center" }}>
                  ES {fmt(headline?.esClose, 2)}
                </div>
              </Card>

              <Card title={`Under the Market — ${fmt(scanned || 5470)} Stocks`} accent={COLORS.red}>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>Stocks / Breadth</div>
                    <SplitBar buy={buyBreadthPct} sell={sellBreadthPct} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>Actual Stock Volume</div>
                    <SplitBar buy={buyVolPct} sell={sellVolPct} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                    <KV label="Stocks with volume" value={fmt(withVolume)} />
                    <KV label="Coverage" value={pct(coverage, 1)} color={coverage >= 70 ? COLORS.green : COLORS.red} />
                    <KV label="Directional imbalance" value={imbalance == null ? "—" : `${imbalance >= 0 ? "+" : ""}${imbalance.toFixed(1)}% selling`} color={COLORS.red} />
                  </div>
                  <div style={{ color: COLORS.red, fontWeight: 1000, fontSize: 17 }}>
                    Overall: {sellVolPct != null && sellVolPct > buyVolPct ? "BROAD SELLING PRESSURE" : "MIXED / BUYING PRESSURE"}
                  </div>
                </div>
              </Card>

              <Card title="Index vs Underlying Market">
                <KV label="ES Market Meter" value={masterScore == null ? "—" : fmt(masterScore, 1)} color={toneForScore(masterScore)} />
                <KV label="Underlying Breadth" value={underlyingScore == null ? "—" : fmt(underlyingScore, 0)} color={toneForScore(underlyingScore)} />
                <KV label="Engine25 ES Close" value={fmt(headline?.esClose, 2)} />
                <div style={{ marginTop: 10, color: COLORS.muted, lineHeight: 1.4 }}>
                  {masterScore != null && underlyingScore != null && masterScore - underlyingScore >= 10
                    ? "The headline index is reading stronger than the market underneath it."
                    : masterScore != null && underlyingScore != null && underlyingScore - masterScore >= 10
                    ? "Underlying participation is stronger than the headline index."
                    : "Index conditions and underlying participation are broadly similar."}
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
              <Card title="Distribution Pressure" accent={COLORS.red}>
                <SimpleGauge value={distributionPressurePct} label={upper(distribution?.label || "Distribution")} inverse />
                <KV label="Raw pressure" value={pct(distributionPressurePct, 1)} color={COLORS.red} />
                <KV label="Volume pressure" value={fmt(volume?.combinedVolumePressure, 0)} color={COLORS.red} />
                <KV label="Engine25 health score" value={fmt(distribution?.score, 0)} />
              </Card>

              <Card title="New Highs vs New Lows">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, textAlign: "center" }}>
                  <div><div style={{ fontSize: 34, color: COLORS.green, fontWeight: 1000 }}>{fmt(nh)}</div><div style={{ color: COLORS.muted }}>New Highs</div></div>
                  <div><div style={{ fontSize: 34, color: COLORS.red, fontWeight: 1000 }}>{fmt(nl)}</div><div style={{ color: COLORS.muted }}>New Lows</div></div>
                </div>
                <div style={{ marginTop: 14, fontWeight: 900, color: (nl ?? 0) > (nh ?? 0) ? COLORS.red : COLORS.green }}>
                  {(nl ?? 0) > (nh ?? 0) ? "New lows dominate market leadership." : "New highs lead market leadership."}
                </div>
              </Card>

              <Card title="11-Sector Participation">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 7 }}>
                  {cards.map((c) => {
                    const b = n(c?.breadth_pct);
                    const m = n(c?.momentum_pct);
                    const weak = b <= 45 && m <= 45;
                    const strong = b >= 55 && m >= 55;
                    const color = weak ? COLORS.red : strong ? COLORS.green : COLORS.yellow;
                    return (
                      <div key={c?.sector} style={{ border: `1px solid ${color}`, borderRadius: 8, padding: 8, background: COLORS.panel2 }}>
                        <div style={{ fontSize: 11, color: COLORS.muted, minHeight: 28 }}>{c?.sector}</div>
                        <div style={{ color, fontWeight: 950 }}>{fmt(b, 0)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 14, color: COLORS.muted, fontSize: 12 }}>
                  <span><b style={{ color: COLORS.green }}>{strongSectors}</b> strong</span>
                  <span><b style={{ color: COLORS.yellow }}>{mixedSectors}</b> mixed</span>
                  <span><b style={{ color: COLORS.red }}>{weakSectors}</b> weak</span>
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
              <Card title="Short-Term vs Broader Participation">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <SimpleGauge value={tactical?.classification?.score} label={upper(tactical?.classification?.label || "1H")} />
                  <SimpleGauge value={regime?.classification?.score} label={upper(regime?.classification?.label || "4H")} />
                </div>
              </Card>

              <Card title="Credit / Financial Stress">
                <KV label="Credit Fragility" value={fmt(credit?.scores?.creditFragility)} color={toneForScore(credit?.scores?.creditFragility)} />
                <KV label="Macro Credit" value={fmt(credit?.scores?.creditStress)} color={toneForScore(credit?.scores?.creditStress)} />
                <KV label="Bond Market" value={fmt(credit?.scores?.bondMarket)} color={toneForScore(credit?.scores?.bondMarket)} />
                <KV label="Liquidity" value={fmt(credit?.scores?.liquidity)} color={toneForScore(credit?.scores?.liquidity)} />
                <div style={{ marginTop: 10, color: COLORS.muted, lineHeight: 1.4 }}>{credit?.interpretation || "Credit / rates / liquidity read unavailable."}</div>
              </Card>

              <Card title="Macro Pressure">
                <KV label="Score" value={fmt(macro?.score)} color={toneForScore(macro?.score)} />
                <KV label="State" value={upper(macro?.state || macro?.label)} color={toneForScore(macro?.score)} />
                <KV label="2Y Treasury" value={fmt(macro?.inputs?.DGS2?.value ?? macro?.inputs?.DGS2?.latestValue, 2)} />
                <KV label="Yield Curve" value={fmt(macro?.inputs?.T10Y2Y?.value ?? macro?.inputs?.T10Y2Y?.latestValue, 2)} />
                <KV label="Dollar" value={fmt(macro?.inputs?.UUP?.close ?? macro?.inputs?.UUP?.value, 2)} />
                <KV label="Energy / Oil" value={fmt(macro?.inputs?.energyOil?.score ?? macro?.inputs?.WTI?.value, 2)} />
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card title="Active Event Pressure" accent={COLORS.orange}>
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

              <Card title="Price / Zone Context">
                <div style={{ fontSize: 16, lineHeight: 1.5 }}>{priceContext}</div>
                <div style={{ marginTop: 10 }}>
                  <KV label="Zone state" value={upper(data?.zoneDecisionRead?.label)} />
                  <KV label="Nearest zone" value={data?.zoneRead?.nearestZone?.id || "—"} />
                  <KV label="Buying support" value={upper(data?.zoneClassification?.accumulationRead?.state)} color={COLORS.yellow} />
                  <KV label="Distribution in zone" value={upper(data?.zoneClassification?.distributionRead?.state)} color={COLORS.red} />
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(360px,.75fr) minmax(650px,1.25fr)", gap: 14 }}>
              <Card title="What Changed?">
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

              <Card title="Market Health Trend — 6 Months">
                <PlainLineChart rows={overlayRows} />
              </Card>
            </div>

            <Card title="Engine25 Bottom Line" accent={COLORS.blue}>
              <div style={{ fontSize: 18, lineHeight: 1.5, fontWeight: 800 }}>{marketRead}</div>
              <div style={{ marginTop: 8, color: COLORS.muted }}>{data?.deskNote}</div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
