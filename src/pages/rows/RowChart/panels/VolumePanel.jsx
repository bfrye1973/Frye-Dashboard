// src/pages/rows/RowChart/panels/VolumePanel.jsx
import React, { useEffect, useRef } from "react";
import useSubpanelChart from "./useSubpanelChart";

export default function VolumePanel({ theme, bars }) {
  const { containerRef, chart } = useSubpanelChart({ height: 120, theme });
  const volSeriesRef = useRef(null);

  // create series once
  useEffect(() => {
    if (!chart || volSeriesRef.current) return;

    // histogram series for volume
    const series = chart.addHistogramSeries({
      priceScaleId: "", // own scale
      color: "#6b7280", // neutral gray; color per bar below
      base: 0,
    });
    volSeriesRef.current = series;

    return () => {
      try { chart.removeSeries(series); } catch {}
      volSeriesRef.current = null;
    };
  }, [chart]);

  // update data
  useEffect(() => {
    if (!volSeriesRef.current) return;
    const data = (bars || []).map((b) => ({
      time: Number(b.time),
      value: Number(b.volume || 0),
      color: Number(b.close) >= Number(b.open) ? "#16a34a" : "#ef4444", // green/red
    }));
    volSeriesRef.current.setData(data);
  }, [bars]);

  return (
    <div style={{ height: 120, borderTop: "1px solid #2b2b2b" }} ref={containerRef} />
  );
}
