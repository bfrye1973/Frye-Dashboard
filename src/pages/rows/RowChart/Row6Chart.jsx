// src/pages/rows/RowChart/Row6Chart.jsx
import React from "react";
 import RowChart from ".";           // ✅ resolves to index.jsx

/**
 * Row6Chart — measures the exact pixel height available in Row 6
 * and passes that height to RowChart so there is ZERO slack (no black canvas).
 */
export default function Row6Chart({
  apiBase = "https://frye-market-backend-1.onrender.com",
  symbol = "SPY",
  timeframe = "1h",
  floor = 120,       // minimum canvas height safeguard
}) {
  const shellRef = React.useRef(null);
  const [h, setH] = React.useState(520); // safe default for first paint

  React.useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const measure = () => {
      const px = Math.max(floor, Math.floor(el.clientHeight));
      setH(px);
    };

    // initial measure
    measure();

    // keep measuring when Row 6 geometry changes
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    // also re-measure on window resize just in case
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [floor]);

  return (
    <div
      ref={shellRef}
      className="row6-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        minHeight: 0,          // CRITICAL: allow child to reach the bottom
        overflow: "hidden",    // hides any sub-pixel seam
      }}
    >
      <RowChart
        apiBase={apiBase}
        defaultSymbol={symbol}
        defaultTimeframe={timeframe}
        height={h}            // exact measured pixels for the canvas
        showDebug={false}
      />
    </div>
  );
}
