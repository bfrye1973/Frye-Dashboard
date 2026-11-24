// Trader View docked on the Chart page (replaces the engine panels by default).
// DISPLAY ONLY: same single endpoint and hook as /trader-view; no engine logic here.
// Turned on/off from the Indicators menu ("Trader View panel"); off shows the original engine panels.

import React from "react";
import useTraderView from "../../../../hooks/useTraderView";
import { TraderViewView } from "../../../traderView/TraderViewPage";

export default function TraderViewChartPanel({ visible }) {
  if (!visible) return null;
  return <TraderViewChartPanelInner />;
}

function TraderViewChartPanelInner() {
  const tv = useTraderView("ES");
  return (
    <div
      data-testid="chart-trader-view-panel"
      style={{
        position: "absolute",
        top: 52,
        left: "50%", // centered in the chart
        transform: "translateX(-50%)",
        zIndex: 108, // below the Indicators dropdown (300)
        width: "min(900px, 62%)",
        maxHeight: "calc(100vh - 110px)",
        overflowY: "auto",
        borderRadius: 14,
        boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
        pointerEvents: "auto",
      }}
    >
      <TraderViewView
        data={tv.data}
        err={tv.err}
        loading={tv.loading}
        refreshing={tv.refreshing}
        mock={tv.mock}
        compact
      />
    </div>
  );
}
