// Trader View docked on the Chart page (replaces the engine panels by default).
// DISPLAY ONLY: same single endpoint and hook as /trader-view; no engine logic here.
// The old engine panels remain available behind the Chart's "Advanced" switch.

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
        top: 88,
        left: 18,
        zIndex: 108,
        width: "min(940px, 56%)",
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
