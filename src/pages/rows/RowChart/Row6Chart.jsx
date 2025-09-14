// src/pages/rows/RowChart/Row6Chart.jsx
import React from "react";
import RowChart from "."; // resolves to ./index.jsx

/**
 * Row6Chart — measures the exact pixel height available in Row 6
 * and feeds that height to RowChart (so the canvas fills the row).
 */
export default function Row6Chart({
  apiBase = "https://frye-market-backend-1.onrender.com",
  symbol = "SPY",
  timeframe = "1h",
  floor = 120,            // safety minimum canvas height
}) {
  const shellRef = React.useRef(null);
  const [h, setH] = React.useState(520);  // safe first paint

  React.useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const measure = () => {
      // exact available pixels for the chart
      const px = Math.max(floor, Math.floor(el.clientHeight || 0));
      setH(px);
    };

    // initial measure on next frame to avoid sub-pixel seams
    const raf = requestAnimationFrame(measure);

    // watch size changes of the shell (row height, layout shifts, etc.)
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    // also re-measure on window resize
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(raf);
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
        minHeight: 0,        // critical: allow child to reach bottom
        overflow: "hidden",  // hide any 1–2px rounding seam
      }}
    >
      <RowChart
        apiBase={apiBase}
        defaultSymbol={symbol}
        defaultTimeframe={timeframe}
        height={h}          // exact measured pixels for the canvas
        showDebug={false}
      />
    </div>
  );
}
