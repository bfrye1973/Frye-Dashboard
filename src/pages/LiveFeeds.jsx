import React from "react";
import MarketMeters from "../components/MarketMeters";
import LiveFeedsChart from "../components/LiveFeedsChart";

export default function LiveFeeds() {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const toISO = (d) => d.toISOString().slice(0, 10);

  return (
    <div style={{ padding: 16, display: "grid", gap: 24 }}>
      <h2>Trading Platform — Live Feeds</h2>
      <MarketMeters />
      <LiveFeedsChart
        ticker="AAPL"
        tf="minute"
        from={toISO(from)}
        to={toISO(now)}
        height={520}
      />
    </div>
  );
}
