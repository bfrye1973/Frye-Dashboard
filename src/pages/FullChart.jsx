// src/pages/FullChart.jsx
import React, { useEffect, useMemo } from "react";
import RowChart from "./rows/RowChart";        // same chart component you already use
import { useSearchParams, useNavigate } from "react-router-dom";

export default function FullChart() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  const symbol = useMemo(() => params.get("symbol") || "SPY", [params]);
  const tf     = useMemo(() => params.get("tf") || "10m", [params]);

  // Lock page scroll while full chart is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  return (
    <div className="fullchart-page"> {/* fixed to the viewport */}
      {/* Top bar */}
      <div className="fullchart-topbar">
        <button className="fullchart-back" onClick={() => nav(-1)}>← Back</button>
        <div className="fullchart-title">Full Chart</div>
        <div className="fullchart-meta">{symbol} · {tf}</div>
      </div>

      {/* Body fills the rest of the viewport */}
      <div className="fullchart-body">
        {/* Render the same chart component, but in bare/fullscreen mode */}
        <RowChart
          defaultSymbol={symbol}
          defaultTimeframe={tf}
          fullScreen
        />
      </div>
    </div>
  );
}
