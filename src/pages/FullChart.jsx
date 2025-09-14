// src/pages/FullChart.jsx
import React from "react";
import RowChart from "./rows/RowChart";

function useQuery() {
  const [q] = React.useState(() => new URLSearchParams(window.location.search));
  return q;
}
function useViewportHeight() {
  const [vh, setVh] = React.useState(() => window.innerHeight);
  React.useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return vh;
}

export default function FullChart() {
  const q = useQuery();
  const symbol = (q.get("symbol") || "SPY").toUpperCase();
  const tf = q.get("tf") || "1h";
  const vh = useViewportHeight();

  const HEADER_H = 52;                        // fixed header height
  const chartHeight = Math.max(120, vh - HEADER_H);

  return (
    <div
      style={{
        minHeight: "100vh",
        height: vh,
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid #2b2b2b",
          background: "#0f0f0f",
          height: HEADER_H,
          boxSizing: "border-box",
        }}
      >
        <button
          onClick={() =>
            window.history.length > 1 ? window.history.back() : (window.location.href = "/")
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
        <div style={{ color: "#e5e7eb", fontWeight: 700 }}>Full Chart</div>
        <div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12 }}>
          {symbol} · {tf}
        </div>
      </div>

      {/* Chart fills the remainder exactly */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <RowChart
          apiBase="https://frye-market-backend-1.onrender.com"
          defaultSymbol={symbol}
          defaultTimeframe={tf}
          height={chartHeight}       // 👈 exact pixel height
          showDebug={false}
        />
      </div>
    </div>
  );
}
