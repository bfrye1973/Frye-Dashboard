// src/pages/FullChart.jsx
import React from "react";
import RowChart from "./rows/RowChart";

// Constants
const HEADER_H = 52; // must match your real header height (px)

function useQuery() {
  const [q] = React.useState(() => new URLSearchParams(window.location.search));
  return q;
}

export default function FullChart() {
  const q = useQuery();
  const symbol = (q.get("symbol") || "SPY").toUpperCase();
  const tf = q.get("tf") || "1h";

  // Ref for the chart body container (the area below the header)
  const bodyRef = React.useRef(null);

  // We measure the exact clientHeight of the chart body and feed that to RowChart
  const [chartHeight, setChartHeight] = React.useState(400); // safe default

  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    // Measure now
    const measure = () => {
      // exact pixels available for the chart
      const h = el.clientHeight;
      // floor to integer to avoid sub-pixel canvas seams
      setChartHeight(Math.max(120, Math.floor(h)));
    };

    // Initial measure
    measure();

    // Watch size changes
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    // Also listen to window resize (e.g., browser UI changes)
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      className="fullchart-page"
      style={{
        // Page fills viewport; body area gets exact measured height
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* Header spacer: fixed height (must match HEADER_H) */}
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
        <div style={{ color: "#e5e7eb", fontWeight: 700 }}>Full Chart</div>
        <div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12 }}>
          {symbol} · {tf}
        </div>
      </div>

      {/* Chart body: takes all remaining space precisely */}
      <div
        ref={bodyRef}
        className="fullchart-body"
        style={{
          flex: "1 1 auto",
          minHeight: 0,           // critical to avoid slack
          overflow: "hidden",     // hide any sub-pixel seams
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="chart-shell"
          style={{
            flex: "1 1 auto",
            minHeight: 0,         // allow the chart host to reach the bottom
            display: "flex",
            flexDirection: "column",
          }}
        >
          <RowChart
            apiBase="https://frye-market-backend-1.onrender.com"
            defaultSymbol={symbol}
            defaultTimeframe={tf}
            height={chartHeight}   // exact measured pixels for the canvas
            showDebug={false}
          />
        </div>
      </div>
    </div>
  );
}
