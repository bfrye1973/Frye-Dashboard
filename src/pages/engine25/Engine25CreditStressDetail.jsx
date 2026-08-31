// src/pages/engine25/Engine25CreditStressDetail.jsx
// Engine 25 Credit / Rates / Liquidity full research page.
// Responsive macro-credit detail:
// - Macro Credit Health = Formula: 50% current systemic health + 50% four-week direction.
// - Shows current / 4W ago / delta / direction for NFCI, STLFSI4, and HY OAS.
// - Credit ETF Fragility remains the separate fast market-warning layer.

import React, { useEffect, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ROUTE = `${API_ROOT}/api/v1/engine25/full-dashboard`;
const FONT = "Arial, Helvetica, sans-serif";

function fmt(value, decimals = 2) {
  if (value === null || value === undefined || value === "") return "—";

  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function fmtPct(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

function fmtSigned(value, decimals = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}`;
}

function cleanLabel(value) {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function colorForScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "#64748b";
  if (n >= 70) return "#22c55e";
  if (n >= 50) return "#eab308";
  if (n >= 35) return "#f97316";
  return "#ef4444";
}

function macroCreditStressLevel(healthScore) {
  const n = Number(healthScore);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(100 - n)));
}

function macroCreditHealthLabel(healthScore) {
  const n = Number(healthScore);

  if (!Number.isFinite(n)) return "UNAVAILABLE";
  if (n >= 75) return "LOW STRESS / HEALTHY";
  if (n >= 50) return "NORMAL / WATCH";
  return "HIGH STRESS";
}

function macroCreditTrendDirection(change) {
  const n = Number(change);

  if (!Number.isFinite(n)) {
    return { label: "UNAVAILABLE", color: "#94a3b8" };
  }

  // NFCI, STLFSI4, and HY OAS are all lower-is-healthier.
  if (n < 0) {
    return { label: "IMPROVING", color: "#22c55e" };
  }

  if (n > 0) {
    return { label: "WORSENING", color: "#ef4444" };
  }

  return { label: "UNCHANGED", color: "#fbbf24" };
}

function pickCreditStressComponent(data) {
  return (
    data?.engine25Context?.marketHealth?.components?.creditStress ||
    data?.marketHealth?.components?.creditStress ||
    data?.liveMarketHealth?.components?.creditStress ||
    data?.creditStressDetail?.creditStressComponent ||
    null
  );
}

function colorForState(state) {
  const text = String(state || "").toUpperCase();

  if (
    text.includes("STRONG") ||
    text.includes("SUPPORTIVE") ||
    text.includes("CALM") ||
    text.includes("LOW") ||
    text.includes("NORMAL") ||
    text.includes("HOLDING") ||
    text.includes("IMPROVING")
  ) {
    return "#22c55e";
  }

  if (
    text.includes("WATCH") ||
    text.includes("MIXED") ||
    text.includes("MANAGEABLE") ||
    text.includes("CONTEXT") ||
    text.includes("STABLE")
  ) {
    return "#fbbf24";
  }

  if (
    text.includes("WEAK") ||
    text.includes("PRESSURE") ||
    text.includes("ELEVATED") ||
    text.includes("BREAKING") ||
    text.includes("TIGHT")
  ) {
    return "#f97316";
  }

  if (
    text.includes("STRESS") ||
    text.includes("RISK_OFF") ||
    text.includes("DETERIORATING") ||
    text.includes("WORSENING")
  ) {
    return "#ef4444";
  }

  return "#94a3b8";
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.28)",
        borderRadius: 14,
        background: "rgba(15,23,42,0.78)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.24)",
        padding: 16,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function KV({ label, value, color = "#e2e8f0" }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        fontFamily: FONT,
        fontSize: 17,
        lineHeight: 1.35,
      }}
    >
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color, fontWeight: 800, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function MetricCard({ item, marketProxy = false, macroTrend = null }) {
  const value = item?.close ?? item?.value;
  const stateColor = colorForState(item?.state);
  const trendDirection = macroCreditTrendDirection(macroTrend?.change);
  const macroDecimals = item?.key === "STLFSI4" ? 4 : 3;

  return (
    <Card style={{ padding: 15, display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 22,
              fontWeight: 900,
              color: "#f8fafc",
            }}
          >
            {item?.key || "—"}
          </div>

          <div
            style={{
              marginTop: 2,
              fontFamily: FONT,
              fontSize: 15,
              lineHeight: 1.35,
              color: "#94a3b8",
            }}
          >
            {item?.label || "—"}
          </div>
        </div>

        <div
          style={{
            color: macroTrend ? trendDirection.color : stateColor,
            fontSize: 15,
            fontWeight: 900,
            textTransform: "uppercase",
            textAlign: "right",
          }}
        >
          {macroTrend ? trendDirection.label : cleanLabel(item?.state)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "5px 12px",
          borderTop: "1px solid rgba(148,163,184,0.14)",
          paddingTop: 8,
        }}
      >
        <KV label="Current" value={fmt(value, macroTrend ? macroDecimals : 3)} color="#f8fafc" />

        {item?.observationDate && !macroTrend && (
          <KV label="Date" value={item.observationDate} />
        )}

        {macroTrend && (
          <>
            <KV
              label="4W Ago"
              value={fmt(macroTrend?.prior, macroDecimals)}
              color="#dbeafe"
            />

            <KV
              label="Δ 4W"
              value={fmtSigned(macroTrend?.change, macroDecimals)}
              color={trendDirection.color}
            />

            <KV
              label="Trend"
              value={trendDirection.label}
              color={trendDirection.color}
            />

            <KV
              label="Current Date"
              value={macroTrend?.latestDate || item?.observationDate || "—"}
              color="#94a3b8"
            />

            <KV
              label="Prior Date"
              value={macroTrend?.priorDate || "—"}
              color="#94a3b8"
            />
          </>
        )}

        {marketProxy && (
          <>
            <KV
              label="Above EMA10"
              value={
                item?.aboveEma10 === true
                  ? "YES"
                  : item?.aboveEma10 === false
                    ? "NO"
                    : "—"
              }
              color={
                item?.aboveEma10 === true
                  ? "#22c55e"
                  : item?.aboveEma10 === false
                    ? "#ef4444"
                    : "#94a3b8"
              }
            />

            <KV
              label="Above EMA20"
              value={
                item?.aboveEma20 === true
                  ? "YES"
                  : item?.aboveEma20 === false
                    ? "NO"
                    : "—"
              }
              color={
                item?.aboveEma20 === true
                  ? "#22c55e"
                  : item?.aboveEma20 === false
                    ? "#ef4444"
                    : "#94a3b8"
              }
            />

            <KV
              label="Above EMA50"
              value={
                item?.aboveEma50 === true
                  ? "YES"
                  : item?.aboveEma50 === false
                    ? "NO"
                    : "—"
              }
              color={
                item?.aboveEma50 === true
                  ? "#22c55e"
                  : item?.aboveEma50 === false
                    ? "#ef4444"
                    : "#94a3b8"
              }
            />

            <KV
              label="Above EMA200"
              value={
                item?.aboveEma200 === true
                  ? "YES"
                  : item?.aboveEma200 === false
                    ? "NO"
                    : "—"
              }
              color={
                item?.aboveEma200 === true
                  ? "#22c55e"
                  : item?.aboveEma200 === false
                    ? "#ef4444"
                    : "#94a3b8"
              }
            />

            <KV
              label="5D"
              value={fmtPct(item?.pctChange5d)}
              color={
                Number(item?.pctChange5d) >= 0 ? "#22c55e" : "#ef4444"
              }
            />

            <KV
              label="20D"
              value={fmtPct(item?.pctChange20d)}
              color={
                Number(item?.pctChange20d) >= 0 ? "#22c55e" : "#ef4444"
              }
            />

            <KV
              label="50D"
              value={fmtPct(item?.pctChange50d)}
              color={
                Number(item?.pctChange50d) >= 0 ? "#22c55e" : "#ef4444"
              }
            />
          </>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(148,163,184,0.14)",
          paddingTop: 8,
          color: "#cbd5e1",
          fontFamily: FONT,
          fontSize: 16,
          lineHeight: 1.45,
        }}
      >
        {macroTrend
          ? `${item?.key || "Macro series"} is ${trendDirection.label.toLowerCase()} over the last four weeks. For this indicator, lower readings mean less financial stress.`
          : item?.read || "Latest interpretation unavailable."}
      </div>
    </Card>
  );
}

function GroupColumn({
  title,
  score,
  items,
  marketProxyKeys = [],
  macroTrendByKey = {},
}) {
  return (
    <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          borderBottom: "1px solid rgba(148,163,184,0.22)",
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 900,
            color: "#93c5fd",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: colorForScore(score),
          }}
        >
          {fmt(score, 0)}
        </div>
      </div>

      {(items || []).map((item) => (
        <MetricCard
          key={item.key}
          item={item}
          marketProxy={marketProxyKeys.includes(item.key)}
          macroTrend={macroTrendByKey?.[item.key] || null}
        />
      ))}
    </div>
  );
}

export default function Engine25CreditStressDetail() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus("LOADING");
        setError(null);

        const res = await fetch(ROUTE, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || json?.ok === false) {
          throw new Error(
            json?.error || `Engine 25 credit detail HTTP ${res.status}`
          );
        }

        if (!cancelled) {
          setData(json);
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
    const timer = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const detail = data?.creditStressDetail || null;
  const groups = detail?.groups || {};
  const scores = detail?.scores || {};

  // The full-dashboard already returns engine25Context. Its embedded
  // marketHealth object carries the new responsive credit component.
  const creditStressComponent = pickCreditStressComponent(data);

  const systemicLevelScore =
    creditStressComponent?.systemicLevelScore ?? null;

  const macroTrendScore =
    creditStressComponent?.trendScore ?? null;

  const macroTrendLabel =
    creditStressComponent?.trendLabel ??
    "MACRO_CREDIT_TREND_UNAVAILABLE";

  const macroFourWeekChanges =
    creditStressComponent?.inputs?.fourWeekChange || {};

  const macroCreditStressLevelValue =
    macroCreditStressLevel(scores.creditStress);

  const macroCreditHealthState =
    macroCreditHealthLabel(scores.creditStress);

  const fastCreditScore = Number(scores.creditFragility);
  const macroCreditScore = Number(scores.creditStress);

  const fastMacroDivergence =
    Number.isFinite(fastCreditScore) &&
    Number.isFinite(macroCreditScore)
      ? Math.round(macroCreditScore - fastCreditScore)
      : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "18px 22px 28px",
        fontFamily: FONT,
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "none",
          margin: 0,
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            borderBottom: "1px solid rgba(148,163,184,0.26)",
            paddingBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.1,
                fontWeight: 900,
                color: "#f8fafc",
              }}
            >
              ENGINE 25 — CREDIT / RATES / LIQUIDITY DETAIL
            </div>

            <div
              style={{
                marginTop: 4,
                color: "#94a3b8",
                fontSize: 17,
              }}
            >
              Full learning view · Refreshes every 60 seconds
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.close()}
            style={{
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.38)",
              color: "#e5e7eb",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 16,
              fontWeight: 850,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {status === "LOADING" && !data && (
          <div style={{ color: "#94a3b8" }}>
            Loading credit detail…
          </div>
        )}

        {status === "ERROR" && (
          <Card style={{ borderColor: "rgba(239,68,68,0.4)" }}>
            <div style={{ color: "#fecaca" }}>
              Engine 25 credit detail error: {error}
            </div>
          </Card>
        )}

        {detail && (
          <>
            <Card
              style={{
                border: "1px solid rgba(249,115,22,0.42)",
                background: "rgba(67,32,12,0.24)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(560px, 1.65fr) repeat(4, minmax(210px, 0.6fr))",
                  gap: 12,
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    border: "1px solid rgba(249,115,22,0.22)",
                    borderRadius: 10,
                    padding: 12,
                    background: "rgba(124,45,18,0.14)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 25,
                      fontWeight: 900,
                      color: "#fb923c",
                      textTransform: "uppercase",
                    }}
                  >
                    {Number(scores.creditFragility) < 50 &&
                    Number(systemicLevelScore) >= 75
                      ? "FAST CREDIT IS WEAK — SYSTEMIC STRESS STILL LOW"
                      : Number(macroTrendScore) < 45
                        ? "MACRO CREDIT TREND IS DETERIORATING"
                        : cleanLabel(detail.displayLabel)}
                  </div>

                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 18,
                      lineHeight: 1.5,
                      color: "#fed7aa",
                    }}
                  >
                    {Number(scores.creditFragility) < 50 &&
                    Number(systemicLevelScore) >= 75
                      ? "Market-traded credit is showing weakness first, but the broader macro credit system is not in major stress right now."
                      : detail.interpretation}
                  </div>

                  {fastMacroDivergence !== null && (
                    <div
                      style={{
                        marginTop: 10,
                        borderTop: "1px solid rgba(249,115,22,0.2)",
                        paddingTop: 8,
                        color: "#f8fafc",
                        fontSize: 16,
                        lineHeight: 1.45,
                      }}
                    >
                      <strong>What this means:</strong> Credit Fragility is{" "}
                      <strong>{fmt(scores.creditFragility, 0)}</strong> while
                      Macro Credit Health is{" "}
                      <strong>{fmt(scores.creditStress, 0)}</strong>. The fast
                      market-credit layer is warning first. The slower macro
                      credit data has not fully confirmed that weakness yet.
                    </div>
                  )}
                </div>

                {[
                  ["Credit Fragility", scores.creditFragility],
                  ["Macro Credit Health", scores.creditStress],
                  ["Bond Market", scores.bondMarket],
                  ["Liquidity", scores.liquidity],
                ].map(([label, score]) => {
                  const isMacroCreditHealth =
                    label === "Macro Credit Health";

                  return (
                    <div
                      key={label}
                      style={{
                        border: "1px solid rgba(148,163,184,0.18)",
                        borderRadius: 10,
                        background: "rgba(2,6,23,0.34)",
                        padding: 12,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: 14,
                          fontWeight: 850,
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 46,
                          lineHeight: 1,
                          fontWeight: 900,
                          color: colorForScore(score),
                        }}
                      >
                        {fmt(score, 0)}
                      </div>

                      {isMacroCreditHealth && (
                        <div
                          style={{
                            marginTop: 7,
                            display: "grid",
                            gap: 5,
                          }}
                        >
                          <div
                            style={{
                              color: colorForScore(score),
                              fontSize: 14,
                              lineHeight: 1.25,
                              fontWeight: 900,
                              textTransform: "uppercase",
                            }}
                          >
                            {macroCreditHealthState}
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 6,
                              marginTop: 2,
                            }}
                          >
                            <div
                              style={{
                                border:
                                  "1px solid rgba(148,163,184,0.18)",
                                borderRadius: 7,
                                padding: "6px 4px",
                                background: "rgba(15,23,42,0.42)",
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
                                Systemic Level
                              </div>

                              <div
                                style={{
                                  marginTop: 2,
                                  color: colorForScore(systemicLevelScore),
                                  fontSize: 24,
                                  fontWeight: 900,
                                }}
                              >
                                {fmt(systemicLevelScore, 0)}
                              </div>
                            </div>

                            <div
                              style={{
                                border:
                                  "1px solid rgba(148,163,184,0.18)",
                                borderRadius: 7,
                                padding: "6px 4px",
                                background: "rgba(15,23,42,0.42)",
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
                                4W Trend
                              </div>

                              <div
                                style={{
                                  marginTop: 2,
                                  color: colorForScore(macroTrendScore),
                                  fontSize: 24,
                                  fontWeight: 900,
                                }}
                              >
                                {fmt(macroTrendScore, 0)}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              color: colorForState(macroTrendLabel),
                              fontSize: 12,
                              lineHeight: 1.25,
                              fontWeight: 850,
                              textTransform: "uppercase",
                            }}
                          >
                            {cleanLabel(macroTrendLabel)}
                          </div>

                          <div
                            style={{
                              color: "#94a3b8",
                              fontSize: 11,
                              lineHeight: 1.3,
                            }}
                          >
                            Formula: 50% current systemic health + 50% four-week direction
                          </div>

                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 11,
                              lineHeight: 1.3,
                            }}
                          >
                            Stress equivalent:{" "}
                            {macroCreditStressLevelValue ?? "—"}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(320px, 1fr))",
                gap: 16,
                width: "100%",
                alignItems: "start",
              }}
            >
              <GroupColumn
                title="Credit ETF Fragility"
                score={groups?.creditEtfFragility?.score}
                items={groups?.creditEtfFragility?.items}
                marketProxyKeys={["HYG", "JNK", "LQD", "KRE", "IWM"]}
              />

              <GroupColumn
                title="Macro Credit Health"
                score={groups?.macroCreditStress?.score}
                items={groups?.macroCreditStress?.items}
                macroTrendByKey={macroFourWeekChanges}
              />

              <GroupColumn
                title="Rates / Bonds"
                score={groups?.ratesCurvePressure?.score}
                items={groups?.ratesCurvePressure?.items}
                marketProxyKeys={["TLT"]}
              />

              <GroupColumn
                title="Liquidity"
                score={groups?.liquidityBackdrop?.score}
                items={groups?.liquidityBackdrop?.items}
              />
            </div>

            <Card>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#93c5fd",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Bottom Line
              </div>

              <div
                style={{
                  color: "#dbeafe",
                  fontSize: 19,
                  lineHeight: 1.5,
                }}
              >
                <strong>Fast credit markets are weakening first.</strong>{" "}
                HYG, JNK, LQD, KRE, and IWM are the early-warning group.
                The slower macro-credit indicators are still healthier overall:
                NFCI and high-yield spreads improved over the last four weeks,
                while STLFSI4 worsened only slightly. That means credit-market
                weakness is real, but broad systemic stress is not confirmed yet.
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
