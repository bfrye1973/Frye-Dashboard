// src/components/MarketMeters.jsx
import React, { useEffect, useState } from "react";
import { fetchMetrics } from "../lib/api.js";
import { openMarketSocket } from "../lib/ws.js";

export default function MarketMeters() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let stop = null;
    (async () => {
      try {
        setData(await fetchMetrics());
      } catch (e) {
        console.error(e);
      }
      stop = openMarketSocket({ onMetrics: (m) => setData(m) });
    })();
    return () => {
      try {
        stop && stop();
      } catch {}
    };
  }, []);

  if (!data) return <div>Loading market metrics…</div>;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      }}
    >
      {data.sectors.map((s) => (
        <div
          key={s.sector}
          style={{ padding: 12, background: "#141414", borderRadius: 8 }}
        >
          <div style={{ fontWeight: 700 }}>{s.sector}</div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            TS: {new Date(data.timestamp * 1000).toLocaleString()}
          </div>
          <div style={{ marginTop: 8 }}>New Highs: {s.newHighs}</div>
          <div>New Lows: {s.newLows}</div>
          <div>ADR Avg: {s.adrAvg ?? "-"}%</div>
        </div>
      ))}
    </div>
  );
}
