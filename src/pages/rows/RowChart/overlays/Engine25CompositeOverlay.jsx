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

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(min, Math.min(max, n));
}

function buildPath(rows, width, height, pad = 10) {
  if (!Array.isArray(rows) || rows.length < 2) return "";

  const usableW = Math.max(1, width - pad * 2);
  const usableH = Math.max(1, height - pad * 2);

  return rows
    .map((row, index) => {
      const x = pad + (index / (rows.length - 1)) * usableW;
      const score = clamp(row.engine25CompositeScore);
      const y = pad + (1 - score / 100) * usableH;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function scoreColor(score) {
  if (score >= 75) return "#22c55e";
  if (score >= 65) return "#84cc16";
  if (score >= 55) return "#f59e0b";
  if (score >= 45) return "#fb923c";
  return "#ef4444";
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
    const width = 420;
    const height = 96;
    const path = buildPath(rows, width, height, 10);

    const latestScore = Number(latest?.engine25CompositeScore);
    const stroke = scoreColor(latestScore);

    return {
      width,
      height,
      path,
      stroke,
    };
  }, [rows, latest]);

  if (!visible || String(symbol || "").toUpperCase() !== "ES") return null;

  const latestScore = Number(latest?.engine25CompositeScore);
  const latestState = latest?.overlayLabel || latest?.overlayState || "—";
  const latestPermission = latest?.permissions?.finalPermission || "—";
  const latestDate = latest?.date || "—";

  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        bottom: 14,
        zIndex: 115,
        width: 460,
        maxWidth: "calc(100% - 28px)",
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px 4px",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.4 }}>
            ENGINE 25 MARKET HEALTH
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            6-month ES composite overlay
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 22,
              lineHeight: 1,
              fontWeight: 950,
              color: Number.isFinite(latestScore)
                ? scoreColor(latestScore)
                : "#e5e7eb",
            }}
          >
            {Number.isFinite(latestScore) ? Math.round(latestScore) : "—"}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            {latestDate}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 10px 6px" }}>
        {status === "ERROR" ? (
          <div style={{ color: "#fca5a5", fontSize: 12, padding: "14px 0" }}>
            Engine 25 overlay error: {error}
          </div>
        ) : status === "LOADING" && !rows.length ? (
          <div style={{ color: "#cbd5e1", fontSize: 12, padding: "14px 0" }}>
            Loading Engine 25 overlay…
          </div>
        ) : (
          <svg
            width="100%"
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            style={{
              display: "block",
              height: 96,
            }}
          >
            {[25, 50, 75].map((level) => {
              const y = 10 + (1 - level / 100) * (chart.height - 20);
              return (
                <line
                  key={level}
                  x1="10"
                  x2={chart.width - 10}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.22)"
                  strokeWidth="1"
                />
              );
            })}

            <text
              x="12"
              y="20"
              fill="rgba(203,213,225,0.65)"
              fontSize="9"
              fontWeight="700"
            >
              100
            </text>
            <text
              x="12"
              y={chart.height - 12}
              fill="rgba(203,213,225,0.65)"
              fontSize="9"
              fontWeight="700"
            >
              0
            </text>

            {chart.path && (
              <path
                d={chart.path}
                fill="none"
                stroke={chart.stroke}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </svg>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(148,163,184,0.18)",
          padding: "6px 10px 8px",
          display: "grid",
          gap: 3,
          fontSize: 10,
          color: "#cbd5e1",
        }}
      >
        <div>
          <strong style={{ color: "#e5e7eb" }}>State:</strong> {latestState}
        </div>
        <div>
          <strong style={{ color: "#e5e7eb" }}>Permission:</strong>{" "}
          {latestPermission}
        </div>
      </div>
    </div>
  );
}
