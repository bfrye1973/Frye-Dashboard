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

const PRICE_SCALE_ID = "engine25-composite-score";

function scoreColor(score) {
  if (score >= 75) return "#22c55e";
  if (score >= 65) return "#84cc16";
  if (score >= 55) return "#f59e0b";
  if (score >= 45) return "#fb923c";
  return "#ef4444";
}

function formatPermission(value) {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLineData(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  return rows
    .filter(
      (row) =>
        Number.isFinite(Number(row.time)) &&
        Number.isFinite(Number(row.engine25CompositeScore))
    )
    .map((row) => ({
      time: Number(row.time),
      value: Number(row.engine25CompositeScore),
    }));
}

export default function Engine25CompositeOverlay({
  visible = true,
  symbol = "ES",
  chart = null,
  chartReady = false,
}) {
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);

  const isES = String(symbol || "").toUpperCase() === "ES";

  useEffect(() => {
    if (!visible || !isES) return;

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
  }, [visible, isES]);

  const latest = Array.isArray(payload?.rows)
    ? payload.rows[payload.rows.length - 1] || null
    : null;

  const latestScore = Number(latest?.engine25CompositeScore);
  const latestState = latest?.overlayLabel || latest?.overlayState || "—";
  const latestPermission = latest?.permissions?.finalPermission || "—";
  const latestDate = latest?.date || "—";

  const lineData = useMemo(() => buildLineData(payload), [payload]);

  useEffect(() => {
    if (!visible || !isES || !chartReady || !chart || !lineData.length) {
      return;
    }

    let scoreLine = null;
    let thresholdLine = null;

    try {
      scoreLine = chart.addLineSeries({
        priceScaleId: PRICE_SCALE_ID,
        color: Number.isFinite(latestScore) ? scoreColor(latestScore) : "#f59e0b",
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        title: "Engine 25 Market Health",
      });

      thresholdLine = chart.addLineSeries({
        priceScaleId: PRICE_SCALE_ID,
        color: "rgba(245,158,11,0.55)",
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: "Engine 25 A+ Threshold",
      });

      scoreLine.setData(lineData);

      thresholdLine.setData(
        lineData.map((point) => ({
          time: point.time,
          value: 55,
        }))
      );

      try {
        const scale = chart.priceScale(PRICE_SCALE_ID);

        scale.applyOptions({
          visible: false,
          borderVisible: false,

          // Keeps the 0–100 Engine 25 line visually in the lower chart band
          // without changing the ES candle price scale.
          scaleMargins: {
            top: 0.68,
            bottom: 0.05,
          },
        });
      } catch {}
    } catch (err) {
      console.error("[Engine25CompositeOverlay] attach failed:", err);
    }

    return () => {
      try {
        if (scoreLine) chart.removeSeries(scoreLine);
      } catch {}

      try {
        if (thresholdLine) chart.removeSeries(thresholdLine);
      } catch {}
    };
  }, [visible, isES, chartReady, chart, lineData, latestScore]);

  if (!visible || !isES) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        bottom: 14,
        zIndex: 116,
        minWidth: 290,
        maxWidth: 430,
        border: "1px solid rgba(148,163,184,0.35)",
        borderRadius: 10,
        background: "rgba(7,10,18,0.82)",
        color: "#e5e7eb",
        boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        pointerEvents: "none",
        overflow: "hidden",
      }}
      title="Engine 25 Composite Market Health"
    >
      <div
        style={{
          padding: "7px 9px",
          display: "grid",
          gap: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 950, letterSpacing: 0.4 }}>
            ENGINE 25 MARKET HEALTH
          </div>

          <div
            style={{
              fontSize: 20,
              lineHeight: 1,
              fontWeight: 950,
              color: Number.isFinite(latestScore)
                ? scoreColor(latestScore)
                : "#e5e7eb",
            }}
          >
            {Number.isFinite(latestScore) ? Math.round(latestScore) : "—"}
          </div>
        </div>

        {status === "ERROR" ? (
          <div style={{ color: "#fca5a5", fontSize: 10 }}>
            Overlay error: {error}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 10, color: "#cbd5e1" }}>
              <strong>State:</strong> {latestState}{" "}
              <span style={{ color: "#64748b" }}>· {latestDate}</span>
            </div>

            <div
              style={{
                fontSize: 10,
                color: "#cbd5e1",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <strong>Permission:</strong> {formatPermission(latestPermission)}
            </div>

            <div style={{ fontSize: 9, color: "#94a3b8" }}>
              Time-synced 0–100 composite line on chart
            </div>
          </>
        )}
      </div>
    </div>
  );
}
