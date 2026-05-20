// src/pages/engine25/Engine25FullDashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../App";

const ROUTE = `${API_BASE.replace(
  /\/+$/,
  ""
)}/api/v1/engine25/full-dashboard`;

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
  return String(value || "—").replaceAll("_", " ");
}

function ScoreBar({ label, score, color, inverse = false }) {
  const n = Number(score);
  const width = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const c = color || colorFor(score, inverse);

  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        <span>{label}</span>
        <span style={{ color: c }}>{Number.isFinite(n) ? Math.round(n) : "—"}</span>
      </div>

      <div
        style={{
          height: 8,
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

    const width = 1100;
    const height = 280;
    const padX = 42;
    const padY = 22;

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
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.22)",
        borderRadius: 14,
        background: "rgba(2,6,23,0.65)",
        padding: 14,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 950, marginBottom: 8 }}>
        ENGINE 25 COMPOSITE OVERLAY — 6 MONTHS
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        style={{ display: "block", height: 280 }}
      >
        {[25, 50, 75].map((level) => {
          const y = 22 + (1 - level / 100) * (chart.height - 44);
          return (
            <g key={level}>
              <line
                x1="42"
                x2={chart.width - 42}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.22)"
                strokeWidth="1"
              />
              <text x="8" y={y + 4} fill="#94a3b8" fontSize="12">
                {level}
              </text>
            </g>
          );
        })}

        <line
          x1="42"
          x2={chart.width - 42}
          y1={22 + (1 - 55 / 100) * (chart.height - 44)}
          y2={22 + (1 - 55 / 100) * (chart.height - 44)}
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
          throw new Error(json?.error || `Engine 25 full dashboard HTTP ${res.status}`);
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
  const overlayRows = Array.isArray(data?.overlay?.rows) ? data.overlay.rows : [];
  const zoneRead = data?.zoneRead || null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: 18,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            borderBottom: "1px solid rgba(148,163,184,0.22)",
            paddingBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 950 }}>
              ENGINE 25 — U.S. MARKET HEALTH MODEL
            </div>
            <div style={{ color: "#94a3b8", marginTop: 4 }}>
              Full dashboard · Composite overlay · Under-the-hood comparison
            </div>
          </div>

          <button
            onClick={() => window.close()}
            style={{
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.35)",
              color: "#e5e7eb",
              borderRadius: 10,
              padding: "8px 12px",
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
              padding: 14,
              color: "#fecaca",
            }}
          >
            Engine 25 full dashboard error: {error}
          </div>
        )}

        {status === "LOADING" && !data && (
          <div style={{ color: "#94a3b8" }}>Loading Engine 25 full dashboard…</div>
        )}

        {data && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(280px, 0.9fr) minmax(360px, 1.1fr)",
                gap: 16,
              }}
            >
              <div
                style={{
                  border: "1px solid rgba(148,163,184,0.22)",
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.72)",
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 900 }}>
                  HEADLINE
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      fontSize: 54,
                      lineHeight: 1,
                      fontWeight: 950,
                      color: colorFor(headline.score),
                    }}
                  >
                    {fmt(headline.score)}
                  </div>

                  <div>
                    <div style={{ fontSize: 20, fontWeight: 950 }}>
                      {cleanLabel(headline.label)}
                    </div>
                    <div style={{ color: "#94a3b8", marginTop: 4 }}>
                      {headline.date} · ES {fmt(headline.esClose, 2)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(245,158,11,0.32)",
                    background: "rgba(120,53,15,0.25)",
                    borderRadius: 12,
                    padding: 12,
                    fontWeight: 850,
                    color: "#fed7aa",
                  }}
                >
                  {headline.permissionText}
                  {headline.size !== null && headline.size !== undefined
                    ? ` · Size ${headline.size}`
                    : ""}
                </div>

                <div style={{ color: "#cbd5e1", lineHeight: 1.45 }}>
                  {headline.interpretation}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(148,163,184,0.22)",
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.72)",
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 900 }}>
                  WHY IS ENGINE 25 SAYING THIS?
                </div>

                <div style={{ display: "grid", gap: 11, marginTop: 14 }}>
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
                gridTemplateColumns: "minmax(520px, 1.35fr) minmax(360px, 0.65fr)",
                gap: 16,
              }}
            >
              <div
                style={{
                  border: "1px solid rgba(148,163,184,0.22)",
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.72)",
                  padding: 16,
                  overflow: "hidden",
                }}
              >
                <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 900 }}>
                  UNDER THE HOOD CHANGE
                </div>

                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: "#94a3b8", textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "8px 8px" }}>Metric</th>
                        <th style={{ padding: "8px 8px" }}>Current</th>
                        <th style={{ padding: "8px 8px" }}>1D Ago</th>
                        <th style={{ padding: "8px 8px" }}>Change</th>
                        <th style={{ padding: "8px 8px" }}>3D Ago</th>
                        <th style={{ padding: "8px 8px" }}>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map((row) => {
                        const one = Number(row.oneDayChange);
                        const three = Number(row.threeDayChange);

                        return (
                          <tr
                            key={row.label}
                            style={{ borderTop: "1px solid rgba(148,163,184,0.16)" }}
                          >
                            <td style={{ textAlign: "left", padding: "9px 8px", fontWeight: 800 }}>
                              {row.label}
                            </td>
                            <td style={{ textAlign: "right", padding: "9px 8px" }}>
                              {fmt(row.current, row.label === "ES Close" ? 2 : 0)}
                            </td>
                            <td style={{ textAlign: "right", padding: "9px 8px" }}>
                              {fmt(row.oneDayAgo, row.label === "ES Close" ? 2 : 0)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "9px 8px",
                                color: Number.isFinite(one)
                                  ? one > 0
                                    ? "#22c55e"
                                    : one < 0
                                      ? "#ef4444"
                                      : "#cbd5e1"
                                  : "#cbd5e1",
                                fontWeight: 900,
                              }}
                            >
                              {fmtChange(row.oneDayChange)}
                            </td>
                            <td style={{ textAlign: "right", padding: "9px 8px" }}>
                              {fmt(row.threeDaysAgo, row.label === "ES Close" ? 2 : 0)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "9px 8px",
                                color: Number.isFinite(three)
                                  ? three > 0
                                    ? "#22c55e"
                                    : three < 0
                                      ? "#ef4444"
                                      : "#cbd5e1"
                                  : "#cbd5e1",
                                fontWeight: 900,
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

                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid rgba(245,158,11,0.25)",
                    background: "rgba(120,53,15,0.18)",
                    color: "#fed7aa",
                    borderRadius: 12,
                    padding: 12,
                    lineHeight: 1.45,
                    fontWeight: 800,
                  }}
                >
                  {data?.underTheHood?.interpretation}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(148,163,184,0.22)",
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.72)",
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 900 }}>
                  ZONE + MARKET HEALTH READ
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.55, color: "#cbd5e1" }}>
                  {zoneRead?.plainEnglish || "No zone-aware read available."}
                </div>

                {zoneRead?.nearestZone && (
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      fontSize: 12,
                      borderTop: "1px solid rgba(148,163,184,0.16)",
                      paddingTop: 10,
                    }}
                  >
                    <div>
                      <strong>Nearest Zone:</strong> {zoneRead.nearestZone.id}
                    </div>
                    <div>
                      <strong>Institutional:</strong>{" "}
                      {zoneRead.nearestZone.institutional?.lo}–{zoneRead.nearestZone.institutional?.hi}
                    </div>
                    <div>
                      <strong>Negotiated:</strong>{" "}
                      {zoneRead.nearestZone.negotiated?.lo}–{zoneRead.nearestZone.negotiated?.hi}
                    </div>
                    <div>
                      <strong>Zone State:</strong>{" "}
                      {cleanLabel(zoneRead?.zoneState?.state)}
                    </div>
                    <div>
                      <strong>Permission:</strong>{" "}
                      {cleanLabel(zoneRead?.zoneState?.permission)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(59,130,246,0.24)",
                borderRadius: 14,
                background: "rgba(15,23,42,0.72)",
                padding: 16,
              }}
            >
              <div style={{ fontSize: 13, color: "#93c5fd", fontWeight: 900 }}>
                DESK NOTE
              </div>
              <div style={{ marginTop: 8, lineHeight: 1.55, color: "#dbeafe", fontWeight: 750 }}>
                {data?.deskNote}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
