// src/pages/FullChart.jsx
import React, { useMemo, useRef, useLayoutEffect, useState } from "react";
import RowChart from "./rows/RowChart/index.jsx"; // <-- explicit folder index

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
  const bodyRef = useRef(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const apply = () => {
      const h =
        window.innerHeight ||
        document.documentElement.clientHeight ||
        800;
      el.style.height = Math.max(200, h - HEADER_H) + "px";
    };
    apply();
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    setReady(true);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      className="fullchart-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* Header */}
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
        <div style={{ color: "#e5e7eb", fontWeight: 700, marginLeft: 8 }}>
          Full Chart
        </div>
        <div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12 }}>
          {symbol} · {timeframe}
        </div>
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        className="fullchart-body"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {ready && (
          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
            {/* Key forces remount on URL change */}
            <RowChart key={`${symbol}-${timeframe}`} defaultSymbol={symbol} defaultTimeframe={timeframe} />
          </div>
        )}
      </div>
    </div>
  );
}
