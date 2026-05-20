// src/pages/rows/RowChart/overlays/Engine25CompositeOverlay.jsx

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const ROUTE = `${API_BASE.replace(
  /\/+$/,
  ""
)}/api/v1/engine25/composite-overlay-6mo`;

const PANEL_HEIGHT = 148;
const SVG_WIDTH = 1200;
const SVG_HEIGHT = 86;
const PAD_X = 34;
const PAD_Y = 10;

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(min, Math.min(max, n));
}

function scoreColor(score) {
  if (score >= 75) return "#22c55e";
  if (score >= 65) return "#84cc16";
  if (score >= 55) return "#f59e0b";
  if (score >= 45) return "#fb923c";
  return "#ef4444";
}

function stateColor(state, fallbackScore) {
  const s = String(state || "").toUpperCase();

  if (s.includes("RISK_ON")) return "#22c55e";
  if (s.includes("CONSTRUCTIVE")) return "#84cc16";
  if (s.includes("MIXED")) return "#f59e0b";
  if (s.includes("DEFENSIVE")) return "#fb923c";
  if (s.includes("RISK_OFF")) return "#ef4444";

  return scoreColor(fallbackScore);
}

function buildPath(rows, width, height) {
  if (!Array.isArray(rows) || rows.length < 2) return "";

  const usableW = Math.max(1, width - PAD_X * 2);
  const usableH = Math.max(1, height - PAD_Y * 2);

  return rows
    .map((row, index) => {
      const x = PAD_X + (index / (rows.length - 1)) * usableW;
      const score = clamp(row.engine25CompositeScore);
      const y = PAD_Y + (1 - score / 100) * usableH;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(linePath, rows, width, height) {
  if (!linePath || !Array.isArray(rows) || rows.length < 2) return "";

  const usableW = Math.max(1, width - PAD_X * 2);
  const lastX = PAD_X + usableW;
  const bottomY = height - PAD_Y;

  return `${linePath} L ${lastX.toFixed(2)} ${bottomY.toFixed(
    2
  )} L ${PAD_X.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

function levelY(level, height) {
  const usableH = Math.max(1, height - PAD_Y * 2);
  return PAD_Y + (1 - level / 100) * usableH;
}

function formatPermission(value) {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Engine25CompositeOverlay({
  visible = true,
  symbol = "ES",
}) {
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible || String(symbol || "").toUpperCase() !== "ES") return;

    let cancelled = false;

    async function load() {
      try {
        setStatus("LOADING");
        setError(null);

        const res = await fetch(ROUTE, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || `Engine25 overlay HTTP ${res.status}`);
        }

        if (!cancelled) {
          setPayload(json);
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
  }, [visible, symbol]);

  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const latest = rows[rows.length - 1] || null;

  const chart = useMemo(() => {
    const path = buildPath(rows, SVG_WIDTH, SVG_HEIGHT);
    const areaPath = buildAreaPath(path, rows, SVG_WIDTH, SVG_HEIGHT);

    const latestScore = Number(latest?.engine25CompositeScore);
    const stroke = stateColor(latest?.overlayState, latestScore);

    return {
      width: SVG_WIDTH,
      height: SVG_HEIGHT,
      path,
      areaPath,
      stroke,
    };
  }, [rows, latest]);

  if (!visible || String(symbol || "").toUpperCase() !== "ES") return null;

  const latestScore = Number(latest?.engine25CompositeScore);
  const latestState = latest?.overlayLabel || latest?.overlayState || "—";
  const latestPermission = latest?.permissions?.finalPermission || "—";
  const latestDate = latest?.date || "—";
  const latestDistribution = latest?.labels?.distribution || "—";
  const latestBreadth = latest?.labels?.breadth || "—";

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 115,
        height: PANEL_HEIGHT,
        border: "1px solid rgba(148,163,184,0.35)",
        borderRadius: 12,
        background: "rgba(7,10,18,0.88)",
        color: "#e5e7eb",
        boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        pointerEvents: "none",
        overflow: "hidden",
      }}
      title="Engine 25 Composite Market Health"
    >
      <div
        style={{
          height: 38,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "7px 12px 3px",
          borderBottom: "1px solid rgba(148,163,184,0.14)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: 0.5 }}>
            ENGINE 25 MARKET HEALTH OVERLAY
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#94a3b8",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "72vw",
            }}
          >
            6-month composite line · Macro + Distribution + Breadth · ES
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "3px 7px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 900,
              background: "rgba(15,23,42,0.75)",
              border: "1px solid rgba(148,163,184,0.25)",
              color: chart.stroke,
              whiteSpace: "nowrap",
            }}
          >
            {latestState}
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 24,
                lineHeight: 1,
                fontWeight: 950,
                color: Number.isFinite(latestScore)
                  ? chart.stroke
                  : "#e5e7eb",
              }}
            >
              {Number.isFinite(latestScore) ? Math.round(latestScore) : "—"}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
              {latestDate}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 86, padding: "0 8px" }}>
        {status === "ERROR" ? (
          <div style={{ color: "#fca5a5", fontSize: 12, padding: "22px 8px" }}>
            Engine 25 overlay error: {error}
          </div>
        ) : status === "LOADING" && !rows.length ? (
          <div style={{ color: "#cbd5e1", fontSize: 12, padding: "22px 8px" }}>
            Loading Engine 25 overlay…
          </div>
        ) : (
          <svg
            width="100%"
            height="86"
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            preserveAspectRatio="none"
            style={{
              display: "block",
              height: 86,
            }}
          >
            <defs>
              <linearGradient id="engine25AreaFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={chart.stroke} stopOpacity="0.22" />
                <stop offset="100%" stopColor={chart.stroke} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {[25, 50, 75].map((level) => {
              const y = levelY(level, chart.height);
              return (
                <g key={level}>
                  <line
                    x1={PAD_X}
                    x2={chart.width - PAD_X}
                    y1={y}
                    y2={y}
                    stroke="rgba(148,163,184,0.22)"
                    strokeWidth="1"
                  />
                  <text
                    x="7"
                    y={y + 3}
                    fill="rgba(203,213,225,0.65)"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {level}
                  </text>
                </g>
              );
            })}

            <line
              x1={PAD_X}
              x2={chart.width - PAD_X}
              y1={levelY(55, chart.height)}
              y2={levelY(55, chart.height)}
              stroke="rgba(245,158,11,0.35)"
              strokeWidth="1"
              strokeDasharray="5 5"
            />

            {chart.areaPath && (
              <path d={chart.areaPath} fill="url(#engine25AreaFill)" />
            )}

            {chart.path && (
              <path
                d={chart.path}
                fill="none"
                stroke={chart.stroke}
                strokeWidth="2.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {Number.isFinite(latestScore) && (
              <circle
                cx={chart.width - PAD_X}
                cy={levelY(clamp(latestScore), chart.height)}
                r="4"
                fill={chart.stroke}
                stroke="#020617"
                strokeWidth="2"
              />
            )}
          </svg>
        )}
      </div>

      <div
        style={{
          height: 24,
          borderTop: "1px solid rgba(148,163,184,0.14)",
          padding: "4px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 10,
          color: "#cbd5e1",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ color: "#e5e7eb" }}>Permission:</strong>{" "}
          {formatPermission(latestPermission)}
        </div>

        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ color: "#e5e7eb" }}>Distribution:</strong>{" "}
          {formatPermission(latestDistribution)}
        </div>

        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ color: "#e5e7eb" }}>Breadth:</strong>{" "}
          {formatPermission(latestBreadth)}
        </div>
      </div>
    </div>
  );
}
