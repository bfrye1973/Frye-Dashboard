// src/pages/engine25/Engine25FullDashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../App";

const ROUTE = `${API_BASE.replace(
  /\/+$/,
  ""
)}/api/v1/engine25/full-dashboard`;

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

function pageCardStyle(extra = {}) {
  return {
    border: "1px solid rgba(148,163,184,0.24)",
    borderRadius: 14,
    background: "rgba(15,23,42,0.72)",
    boxShadow: "0 8px 22px rgba(0,0,0,0.22)",
    ...extra,
  };
}

function SectionTitle({ children, color = "#93c5fd" }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: 17,
        lineHeight: 1.3,
        fontWeight: 800,
        color,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function BodyText({ children, color = "#dbeafe", weight = 500 }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: 17,
        lineHeight: 1.45,
        fontWeight: weight,
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
    <div style={{ display: "grid", gap: 7 }}>
      <div
        style={{
          fontFamily: FONT,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 17,
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
          height: 9,
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

    const width = 1200;
    const height = 320;
    const padX = 52;
    const padY = 28;

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
    <div style={pageCardStyle({ padding: 16 })}>
      <SectionTitle>Engine 25 Composite Overlay — 6 Months</SectionTitle>

      <svg
        width="100%"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        style={{ display: "block", height: 320 }}
      >
        {[25, 50, 75].map((level) => {
          const y = 28 + (1 - level / 100) * (chart.height - 56);
          return (
            <g key={level}>
              <line
                x1="52"
                x2={chart.width - 52}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.22)"
                strokeWidth="1"
              />
              <text
                x="14"
                y={y + 5}
                fill="#94a3b8"
                fontSize="16"
                fontFamily={FONT}
                fontWeight="500"
              >
                {level}
              </text>
            </g>
          );
        })}

        <line
          x1="52"
          x2={chart.width - 52}
          y1={28 + (1 - 55 / 100) * (chart.height - 56)}
          y2={28 + (1 - 55 / 100) * (chart.height - 56)}
          stroke="rgba(245,158,11,0.55)"
          strokeDasharray="7 7"
        />

        {chart.path && (
          <path
            d={chart.path}
            fill="none"
            stroke="#f97316"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}

function UnderTheHoodTable({ rows = [], interpretation }) {
  return (
    <div style={pageCardStyle({ padding: 18, overflow: "hidden" })}>
      <SectionTitle>Under The Hood Change</SectionTitle>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontFamily: FONT,
            fontSize: 17,
            lineHeight: 1.42,
            color: "#dbeafe",
          }}
        >
          <thead>
            <tr
              style={{
                color: "#93c5fd",
                textAlign: "right",
                fontSize: 15,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
              }}
            >
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  fontWeight: 800,
                  borderBottom: "1px solid rgba(148,163,184,0.22)",
                }}
              >
                Metric
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontWeight: 800,
                  borderBottom: "1px solid rgba(148,163,184,0.22)",
                }}
              >
                Current
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontWeight: 800,
                  borderBottom: "1px solid rgba(148,163,184,0.22)",
                }}
              >
                1D Ago
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontWeight: 800,
                  borderBottom: "1px solid rgba(148,163,184,0.22)",
                }}
              >
                1D Change
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontWeight: 800,
                  borderBottom: "1px solid rgba(148,163,184,0.22)",
                }}
              >
                3D Ago
              </th>
              <th
                style={{
                  padding: "10px 12px",
                  fontWeight: 800,
                  borderBottom: "1px solid rgba(148,163,184,0.22)",
                }}
              >
                3D Change
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const one = Number(row.oneDayChange);
              const three = Number(row.threeDayChange);
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
                        ? "rgba(2,6,23,0.20)"
                        : "rgba(15,23,42,0.20)",
                  }}
                >
                  <td
                    style={{
                      textAlign: "left",
                      padding: "11px 12px",
                      fontWeight: 650,
                      color: "#f8fafc",
                      borderBottom: "1px solid rgba(148,163,184,0.12)",
                    }}
                  >
                    {row.label}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "11px 12px",
                      fontWeight: 500,
                      borderBottom: "1px solid rgba(148,163,184,0.12)",
                    }}
                  >
                    {fmt(row.current, isES ? 2 : 0)}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "11px 12px",
                      fontWeight: 500,
                      borderBottom: "1px solid rgba(148,163,184,0.12)",
                    }}
                  >
                    {fmt(row.oneDayAgo, isES ? 2 : 0)}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "11px 12px",
                      color: changeColor(one, inverse),
                      fontWeight: 800,
                      borderBottom: "1px solid rgba(148,163,184,0.12)",
                    }}
                  >
                    {fmtChange(row.oneDayChange)}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "11px 12px",
                      fontWeight: 500,
                      borderBottom: "1px solid rgba(148,163,184,0.12)",
                    }}
                  >
                    {fmt(row.threeDaysAgo, isES ? 2 : 0)}
                  </td>

                  <td
                    style={{
                      textAlign: "right",
                      padding: "11px 12px",
                      color: changeColor(three, inverse),
                      fontWeight: 800,
                      borderBottom: "1px solid rgba(148,163,184,0.12)",
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
            marginTop: 16,
            border: "1px solid rgba(245,158,11,0.28)",
            background: "rgba(120,53,15,0.18)",
            color: "#fed7aa",
            borderRadius: 12,
            padding: 14,
            fontFamily: FONT,
            fontSize: 17,
            lineHeight: 1.45,
            fontWeight: 650,
          }}
        >
          {interpretation}
        </div>
      )}
    </div>
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
        padding: "22px 24px 38px",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 1680,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            borderBottom: "1px solid rgba(148,163,184,0.24)",
            paddingBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 29,
                lineHeight: 1.25,
                fontWeight: 800,
                color: "#f8fafc",
                letterSpacing: "0.01em",
              }}
            >
              ENGINE 25 — U.S. MARKET HEALTH MODEL
            </div>

            <div
              style={{
                fontFamily: FONT,
                color: "#cbd5e1",
                marginTop: 5,
                fontSize: 17,
                lineHeight: 1.35,
                fontWeight: 500,
              }}
            >
              Full dashboard · Composite overlay · Under-the-hood comparison
            </div>
          </div>

          <button
            onClick={() => window.close()}
            style={{
              fontFamily: FONT,
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.35)",
              color: "#e5e7eb",
              borderRadius: 10,
              padding: "9px 13px",
              fontSize: 15,
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
              padding: 16,
              color: "#fecaca",
              fontSize: 17,
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
              fontSize: 17,
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
                  "minmax(360px, 0.88fr) minmax(520px, 1.12fr)",
                gap: 18,
              }}
            >
              <div
                style={pageCardStyle({
                  padding: 18,
                  display: "grid",
                  gap: 14,
                })}
              >
                <SectionTitle>Headline</SectionTitle>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 60,
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
                        fontFamily: FONT,
                        fontSize: 21,
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
                        marginTop: 5,
                        fontSize: 17,
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
                    border: "1px solid rgba(245,158,11,0.32)",
                    background: "rgba(120,53,15,0.25)",
                    borderRadius: 12,
                    padding: 13,
                    fontSize: 17,
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

                <BodyText color="#dbeafe" weight={500}>
                  {headline.interpretation}
                </BodyText>
              </div>

              <div
                style={pageCardStyle({
                  padding: 18,
                })}
              >
                <SectionTitle>Why Is Engine 25 Saying This?</SectionTitle>

                <div style={{ display: "grid", gap: 13 }}>
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
              </div>
            </div>

            <MiniCompositeChart rows={overlayRows} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(760px, 1.35fr) minmax(440px, 0.65fr)",
                gap: 18,
              }}
            >
              <UnderTheHoodTable
                rows={comparison}
                interpretation={data?.underTheHood?.interpretation}
              />

              <div
                style={pageCardStyle({
                  padding: 18,
                  display: "grid",
                  gap: 14,
                })}
              >
                <SectionTitle>Zone + Market Health Read</SectionTitle>

                <BodyText color="#dbeafe" weight={500}>
                  {zoneRead?.plainEnglish || "No zone-aware read available."}
                </BodyText>

                {zoneRead?.nearestZone && (
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      fontSize: 16,
                      lineHeight: 1.4,
                      borderTop: "1px solid rgba(148,163,184,0.16)",
                      paddingTop: 12,
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
              </div>
            </div>

            <div
              style={pageCardStyle({
                padding: 18,
                border: "1px solid rgba(59,130,246,0.28)",
              })}
            >
              <SectionTitle color="#93c5fd">Desk Note</SectionTitle>

              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 17,
                  lineHeight: 1.48,
                  color: "#dbeafe",
                  fontWeight: 500,
                }}
              >
                {data?.deskNote}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
