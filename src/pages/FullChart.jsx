// src/pages/FullChart.jsx
import React, { useMemo, useRef, useLayoutEffect, useState } from "react";
import RowChart from "./rows/RowChart"; // resolves to ./rows/RowChart/index.jsx

// Simple header height (matches your dashboard top bar)
const HEADER_H = 52;

export default function FullChart() {
  // Read query params
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const symbol = (params.get("symbol") || "SPY").toUpperCase();
  const tf = params.get("tf") || "1h";

  // Ref to the body area (below header) so we can ensure it fills the viewport
  const bodyRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Ensure the body area has the exact viewport space (vh minus header)
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const apply = () => {
      const h = window.innerHeight || document.documentElement.clientHeight || 800;
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
      {/* Header spacer (use your real header if present) */}
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
        <div style={{ color: "#e5e7eb", fontWeight: 700, marginLeft: 8 }}>Full Chart</div>
        <div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12 }}>
          {symbol} · {tf}
        </div>
      </div>

      {/* Body → RowChart flex-fills this box; RowChart/Hook handle the timeline and resizing */}
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
            <RowChart
              apiBase="https://frye-market-backend-1.onrender.com"
              defaultSymbol={symbol}
              defaultTimeframe={tf}
              showDebug={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
