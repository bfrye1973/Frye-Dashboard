// src/pages/engine25/Engine25FullDashboard.jsx
// Engine 25D Full Dashboard Layout v2
// Bigger readable Open Full Chart page. No App.js changes.

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const ROUTE = `${API_BASE.replace(/\/+$/, "")}/api/v1/engine25/full-dashboard`;

const FONT = "Arial, Helvetica, sans-serif";

function colorFor(value, inverse = false) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "#64748b";

  if (inverse) {
    if (n < 30) return "#22c55e";
    if (n < 50) return "#f59e0b";
    if (n < 70) return "#ef4444";
    return "#7f1d1d";
  }

  if (n >= 70) return "#22c55e";
  if (n >= 50) return "#eab308";
  if (n >= 35) return "#f97316";
  return "#ef4444";
}

function fmt(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function fmtChange(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n > 0) return `+${n}`;
  return String(n);
}

function cleanLabel(value) {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function changeColor(value, inverse = false) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "#cbd5e1";

  if (inverse) {
    if (n > 0) return "#ef4444";
    if (n < 0) return "#22c55e";
    return "#cbd5e1";
  }

  if (n > 0) return "#22c55e";
  if (n < 0) return "#ef4444";
  return "#cbd5e1";
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.28)",
        borderRadius: 16,
        background: "rgba(15,23,42,0.76)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
        padding: 22,
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
        fontFamily: FONT,
        fontSize: 18,
        lineHeight: 1.3,
        fontWeight: 800,
        color,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function BodyText({ children, color = "#dbeafe" }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: 18,
        lineHeight: 1.5,
        fontWeight: 500,
        color,
      }}
    >
      {children}
    </div>
  );
}

function ScoreBar({ label, score, color, inverse = false }) {
  const n = Number(score);
  const width = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const c = color || colorFor(score, inverse);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          fontFamily: FONT,
          fontSize: 18,
          lineHeight: 1.35,
          fontWeight: 500,
          color: "#dbeafe",
        }}
      >
        <span>{label}</span>
        <span style={{ color: c, fontWeight: 800 }}>
          {Number.isFinite(n) ? Math.round(n) : "—"}
        </span>
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "rgba(148,163,184,0.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            background: c,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function MiniCompositeChart({ rows = [] }) {
  const chart = useMemo(() => {
    const clean = rows
      .filter(
        (row) =>
          Number.isFinite(Number(row.time)) &&
          Number.isFinite(Number(row.engine25CompositeScore))
      )
      .map((row) => ({
        time: Number(row.time),
        value: Number(row.engine25CompositeScore),
      }));

    const width = 1500;
    const height = 420;
    const padX = 70;
    const padY = 44;

    if (clean.length < 2) {
      return { width, height, path: "" };
    }

    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const path = clean
      .map((point, index) => {
        const x = padX + (index / (clean.length - 1)) * usableW;
        const y = padY + (1 - point.value / 100) * usableH;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    return { width, height, path };
  }, [rows]);

  return (
    <Card style={{ padding: 22 }}>
      <SectionTitle>Engine 25 Composite Overlay — 6 Months</SectionTitle>

      <svg
        width="100%"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        style={{ display: "block", height: 420 }}
      >
        {[25, 50, 75].map((level) => {
          const y = 44 + (1 - level / 100) * (chart.height - 88);
          return (
            <g key={level}>
              <line
                x1="70"
                x2={chart.width - 70}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.24)"
                strokeWidth="1.2"
              />
              <text
                x="20"
                y={y + 6}
                fill="#94a3b8"
                fontSize="18"
                fontFamily={FONT}
                fontWeight="500"
              >
                {level}
              </text>
            </g>
          );
        })}

        <line
          x1="70"
          x2={chart.width - 70}
          y1={44 + (1 - 55 / 100) * (chart.height - 88)}
          y2={44 + (1 - 55 / 100) * (chart.height - 88)}
          stroke="rgba(245,158,11,0.6)"
          strokeDasharray="8 8"
        />

        {chart.path && (
          <path
            d={chart.path}
            fill="none"
            stroke="#f97316"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
    </Card>
  );
}

function UnderTheHoodTable({ rows = [], interpretation }) {
  return (
    <Card style={{ padding: 22, overflow: "hidden" }}>
      <SectionTitle>Under The Hood Change</SectionTitle>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontFamily: FONT,
            fontSize: 18,
            lineHeight: 1.45,
            color: "#dbeafe",
          }}
        >
          <thead>
            <tr
              style={{
                color: "#93c5fd",
                textAlign: "right",
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
              }}
            >
              {[
                ["Metric", "left"],
                ["Current", "right"],
                ["1D Ago", "right"],
                ["1D Change", "right"],
                ["3D Ago", "right"],
                ["3D Change", "right"],
              ].map(([label, align]) => (
                <th
                  key={label}
                  style={{
                    textAlign: align,
                    padding: "13px 14px",
                    fontWeight: 800,
                    borderBottom: "1px solid rgba(148,163,184,0.26)",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const isES = row.label === "ES Close";
              const inverse =
                row.label === "Distribution" ||
                row.label === "Credit Fragility";

              return (
                <tr
                  key={row.label}
                  style={{
                    background:
                      index % 2 === 0
                        ? "rgba(2,6,23,0.18)"
                        : "rgba(15,23,42,0.24)",
                  }}
                >
                  <td
                    style={{
                      textAlign: "left",
                      padding: "14px 14px",
                      fontWeight: 650,
                      color: "#f8fafc",
                      borderBottom: "1px solid rgba(148,163,184,0.13)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.label}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "14px 14px",
                      fontWeight: 500,
                      borderBottom: "1px solid rgba(148,163,184,0.13)",
                    }}
                  >
                    {fmt(row.current, isES ? 2 : 0)}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "14px 14px",
                      fontWeight: 500,
                      borderBottom: "1px solid rgba(148,163,184,0.13)",
                    }}
                  >
                    {fmt(row.oneDayAgo, isES ? 2 : 0)}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "14px 14px",
                      color: changeColor(row.oneDayChange, inverse),
                      fontWeight: 800,
                      borderBottom: "1px solid rgba(148,163,184,0.13)",
                    }}
                  >
                    {fmtChange(row.oneDayChange)}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "14px 14px",
                      fontWeight: 500,
                      borderBottom: "1px solid rgba(148,163,184,0.13)",
                    }}
                  >
                    {fmt(row.threeDaysAgo, isES ? 2 : 0)}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "14px 14px",
                      color: changeColor(row.threeDayChange, inverse),
                      fontWeight: 800,
                      borderBottom: "1px solid rgba(148,163,184,0.13)",
                    }}
                  >
                    {fmtChange(row.threeDayChange)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {interpretation && (
        <div
          style={{
            marginTop: 18,
            border: "1px solid rgba(245,158,11,0.3)",
            background: "rgba(120,53,15,0.2)",
            color: "#fed7aa",
            borderRadius: 12,
            padding: 16,
            fontFamily: FONT,
            fontSize: 18,
            lineHeight: 1.48,
            fontWeight: 650,
          }}
        >
          {interpretation}
        </div>
      )}
    </Card>
  );
}

export default function Engine25FullDashboard() {
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
            json?.error || `Engine 25 full dashboard HTTP ${res.status}`
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

  const headline = data?.headline || {};
  const breakdown = Array.isArray(data?.componentBreakdown)
    ? data.componentBreakdown
    : [];
  const comparison = Array.isArray(data?.underTheHood?.rows)
    ? data.underTheHood.rows
    : [];
  const overlayRows = Array.isArray(data?.overlay?.rows)
    ? data.overlay.rows
    : [];
  const zoneRead = data?.zoneRead || null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "28px 34px 46px",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 1900,
          margin: "0 auto",
          display: "grid",
          gap: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "center",
            borderBottom: "1px solid rgba(148,163,184,0.26)",
            paddingBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 32,
                lineHeight: 1.2,
                fontWeight: 800,
                color: "#f8fafc",
              }}
            >
              ENGINE 25 — U.S. MARKET HEALTH MODEL
            </div>

            <div
              style={{
                color: "#cbd5e1",
                marginTop: 7,
                fontSize: 18,
                lineHeight: 1.35,
                fontWeight: 500,
              }}
            >
              Full dashboard · Composite overlay · Under-the-hood comparison ·
              Full Layout v2
            </div>
          </div>

          <button
            onClick={() => window.close()}
            style={{
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.38)",
              color: "#e5e7eb",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {status === "ERROR" && (
          <div
            style={{
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(127,29,29,0.35)",
              borderRadius: 12,
              padding: 18,
              color: "#fecaca",
              fontSize: 18,
              lineHeight: 1.45,
              fontWeight: 500,
            }}
          >
            Engine 25 full dashboard error: {error}
          </div>
        )}

        {status === "LOADING" && !data && (
          <div
            style={{
              color: "#94a3b8",
              fontSize: 18,
              lineHeight: 1.45,
              fontWeight: 500,
            }}
          >
            Loading Engine 25 full dashboard…
          </div>
        )}

        {data && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(480px, 0.92fr) minmax(680px, 1.08fr)",
                gap: 22,
              }}
            >
              <Card style={{ display: "grid", gap: 16 }}>
                <SectionTitle>Headline</SectionTitle>

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div
                    style={{
                      fontSize: 72,
                      lineHeight: 1,
                      fontWeight: 800,
                      color: colorFor(headline.score),
                    }}
                  >
                    {fmt(headline.score)}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        lineHeight: 1.3,
                        fontWeight: 650,
                        color: "#f8fafc",
                      }}
                    >
                      {cleanLabel(headline.label)}
                    </div>

                    <div
                      style={{
                        color: "#cbd5e1",
                        marginTop: 6,
                        fontSize: 18,
                        lineHeight: 1.35,
                        fontWeight: 500,
                      }}
                    >
                      {headline.date} · ES {fmt(headline.esClose, 2)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(245,158,11,0.35)",
                    background: "rgba(120,53,15,0.25)",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 18,
                    lineHeight: 1.42,
                    fontWeight: 800,
                    color: "#fed7aa",
                    textTransform: "uppercase",
                  }}
                >
                  {headline.permissionText}
                  {headline.size !== null && headline.size !== undefined
                    ? ` · Size ${headline.size}`
                    : ""}
                </div>

                <BodyText>{headline.interpretation}</BodyText>
              </Card>

              <Card>
                <SectionTitle>Why Is Engine 25 Saying This?</SectionTitle>

                <div style={{ display: "grid", gap: 16 }}>
                  {breakdown.map((item) => (
                    <ScoreBar
                      key={item.key}
                      label={item.label}
                      score={item.score}
                      color={item.color === "darkRed" ? "#7f1d1d" : undefined}
                      inverse={item.direction === "lower_is_better"}
                    />
                  ))}
                </div>
              </Card>
            </div>

            <MiniCompositeChart rows={overlayRows} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(980px, 1.45fr) minmax(520px, 0.55fr)",
                gap: 22,
              }}
            >
              <UnderTheHoodTable
                rows={comparison}
                interpretation={data?.underTheHood?.interpretation}
              />

              <Card style={{ display: "grid", gap: 16 }}>
                <SectionTitle>Zone + Market Health Read</SectionTitle>

                <BodyText>
                  {zoneRead?.plainEnglish || "No zone-aware read available."}
                </BodyText>

                {zoneRead?.nearestZone && (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      fontSize: 17,
                      lineHeight: 1.45,
                      borderTop: "1px solid rgba(148,163,184,0.18)",
                      paddingTop: 14,
                      color: "#dbeafe",
                      fontWeight: 500,
                    }}
                  >
                    <div>
                      <strong style={{ color: "#f8fafc", fontWeight: 700 }}>
                        Nearest Zone:
                      </strong>{" "}
                      {zoneRead.nearestZone.id}
                    </div>

                    <div>
                      <strong style={{ color: "#f8fafc", fontWeight: 700 }}>
                        Institutional:
                      </strong>{" "}
                      {zoneRead.nearestZone.institutional?.lo}–
                      {zoneRead.nearestZone.institutional?.hi}
                    </div>

                    <div>
                      <strong style={{ color: "#f8fafc", fontWeight: 700 }}>
                        Negotiated:
                      </strong>{" "}
                      {zoneRead.nearestZone.negotiated?.lo}–
                      {zoneRead.nearestZone.negotiated?.hi}
                    </div>

                    <div>
                      <strong style={{ color: "#f8fafc", fontWeight: 700 }}>
                        Zone State:
                      </strong>{" "}
                      {cleanLabel(zoneRead?.zoneState?.state)}
                    </div>

                    <div>
                      <strong style={{ color: "#f8fafc", fontWeight: 700 }}>
                        Permission:
                      </strong>{" "}
                      {cleanLabel(zoneRead?.zoneState?.permission)}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <Card
              style={{
                border: "1px solid rgba(59,130,246,0.3)",
              }}
            >
              <SectionTitle color="#93c5fd">Desk Note</SectionTitle>

              <div
                style={{
                  fontSize: 18,
                  lineHeight: 1.5,
                  color: "#dbeafe",
                  fontWeight: 500,
                }}
              >
                {data?.deskNote}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
