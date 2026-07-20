// src/pages/engine25/Engine25CreditStressDetail.jsx
// Engine 25 Credit / Rates / Liquidity full research page.

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
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function fmtPct(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
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

function colorForState(state) {
  const text = String(state || "").toUpperCase();

  if (
    text.includes("STRONG") ||
    text.includes("SUPPORTIVE") ||
    text.includes("CALM") ||
    text.includes("LOW") ||
    text.includes("NORMAL") ||
    text.includes("HOLDING")
  ) {
    return "#22c55e";
  }

  if (
    text.includes("WATCH") ||
    text.includes("MIXED") ||
    text.includes("MANAGEABLE") ||
    text.includes("CONTEXT")
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
    text.includes("DETERIORATING")
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
        padding: 14,
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
        fontSize: 14,
        lineHeight: 1.3,
      }}
    >
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color, fontWeight: 800, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function MetricCard({ item, marketProxy = false }) {
  const value = item?.close ?? item?.value;
  const stateColor = colorForState(item?.state);

  return (
    <Card style={{ padding: 12, display: "grid", gap: 8 }}>
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
              fontSize: 17,
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
              fontSize: 12,
              lineHeight: 1.25,
              color: "#94a3b8",
            }}
          >
            {item?.label || "—"}
          </div>
        </div>

        <div
          style={{
            color: stateColor,
            fontSize: 12,
            fontWeight: 900,
            textTransform: "uppercase",
            textAlign: "right",
          }}
        >
          {cleanLabel(item?.state)}
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
        <KV label="Value" value={fmt(value, 3)} color="#f8fafc" />

        {item?.observationDate && (
          <KV label="Date" value={item.observationDate} />
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
          fontSize: 13,
          lineHeight: 1.35,
        }}
      >
        {item?.read || "Latest interpretation unavailable."}
      </div>
    </Card>
  );
}

function GroupColumn({ title, score, items, marketProxyKeys = [] }) {
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
            fontSize: 16,
            fontWeight: 900,
            color: "#93c5fd",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 22,
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "20px 26px 34px",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 2200,
          width: "96vw",
          margin: "0 auto",
          display: "grid",
          gap: 14,
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
                fontSize: 28,
                lineHeight: 1.15,
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
                fontSize: 14,
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
              padding: "8px 13px",
              fontSize: 14,
              fontWeight: 850,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {status === "LOADING" && !data && (
          <div style={{ color: "#94a3b8" }}>Loading credit detail…</div>
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
                  gridTemplateColumns: "minmax(420px, 1.5fr) repeat(4, minmax(160px, 0.5fr))",
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
                      fontSize: 20,
                      fontWeight: 900,
                      color: "#fb923c",
                      textTransform: "uppercase",
                    }}
                  >
                    {cleanLabel(detail.displayLabel)}
                  </div>

                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 14,
                      lineHeight: 1.4,
                      color: "#fed7aa",
                    }}
                  >
                    {detail.interpretation}
                  </div>
                </div>

                {[
                  ["Credit Fragility", scores.creditFragility],
                  ["Macro Credit Stress", scores.creditStress],
                  ["Bond Market", scores.bondMarket],
                  ["Liquidity", scores.liquidity],
                ].map(([label, score]) => (
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
                        fontSize: 12,
                        fontWeight: 850,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 32,
                        lineHeight: 1,
                        fontWeight: 900,
                        color: colorForScore(score),
                      }}
                    >
                      {fmt(score, 0)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 14,
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
                title="Macro Credit Stress"
                score={groups?.macroCreditStress?.score}
                items={groups?.macroCreditStress?.items}
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
                  fontSize: 15,
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
                  fontSize: 15,
                  lineHeight: 1.45,
                }}
              >
                Credit ETFs are weak, regional banks remain strong, macro credit
                stress is calm, Treasury bonds are under pressure, the yield curve
                is not inverted, liquidity is mixed, and systemic stress is not
                confirmed.
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
