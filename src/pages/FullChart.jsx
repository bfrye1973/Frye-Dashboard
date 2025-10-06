// src/pages/FullChart.jsx
import React, { useEffect, useMemo } from "react";
import RowChart from "./rows/RowChart"; // same component you use in the dashboard
import { useSearchParams, useNavigate } from "react-router-dom";

export default function FullChart() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const symbol = useMemo(() => params.get("symbol") || "SPY", [params]);
  const tf     = useMemo(() => params.get("tf") || "10m", [params]);

  // Prevent the dashboard page from scrolling behind this route
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0b0b14",
        display: "flex",
        flexDirection: "column",
        minHeight: 0, // important so the chart child can grow
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          borderBottom: "1px solid #1f2a44",
          color: "#d1d5db",
        }}
      >
        <button
          onClick={() => nav(-1)}
          style={{
            background: "#111827", color: "#e5e7eb", border: "1px solid #374151",
            padding: "6px 10px", borderRadius: 6, cursor: "pointer"
          }}
        >
          ← Back
        </button>
        <div style={{ opacity: 0.7 }}>Full Chart</div>
        <div style={{ marginLeft: "auto", opacity: 0.6 }}>
          {symbol} · {tf}
        </div>
      </div>

      {/* Chart area fills the rest of the screen */}
      <div style={{ flex: "1 1 0%", minHeight: 0 }}>
        <RowChart
          defaultSymbol={symbol}
          defaultTimeframe={tf}
          fullScreen   // IMPORTANT: tells RowChart to use 100% height
        />
      </div>
    </div>
  );
}
