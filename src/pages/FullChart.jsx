// src/pages/FullChart.jsx
import React, { useMemo } from "react";
import RowChart from "./rows/RowChart";

const HEADER_H = 52;

function getQueryParams() {
  if (typeof window === "undefined") return { symbol: "SPY", timeframe: "10m" };
  const q = new URLSearchParams(window.location.search);
  const symbol = (q.get("symbol") || "SPY").toUpperCase();
  const timeframe = q.get("timeframe") || q.get("tf") || "10m";
  return { symbol, timeframe };
}

export default function FullChart() {
  const { symbol, timeframe } = useMemo(() => getQueryParams(), []);

  return (
    <div
      className="fullchart-page"
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* Header (kept) */}
      <div
        style={{
          height: HEADER_H,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid #2b2b2b",
          background: "#0f0f0f",
          boxSizing: "border-box",
          flex: "0 0 auto",
        }}
      >
        <button
          onClick={() =>
            window.history.length > 1
              ? window.history.back()
              : (window.location.href = "/")
          }
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            padding: "6px 10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <div style={{ color: "#e5e7eb", fontWeight: 700, marginLeft: 8 }}>Full Chart</div>
        <div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12 }}>
          {symbol} · {timeframe}
        </div>
      </div>

      {/* Body fills the rest of the viewport */}
      <div
        className="fullchart-body"
        style={{
          height: `calc(100vh - ${HEADER_H}px)`,
          width: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <RowChart
            apiBase="https://frye-market-backend-1.onrender.com"
            defaultSymbol={symbol}
            defaultTimeframe={timeframe}
            showDebug={false}
            fullScreen={true}   // <-- only /chart passes this
          />
        </div>
      </div>
    </div>
  );
}
