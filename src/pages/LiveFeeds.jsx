// src/pages/LiveFeeds.jsx
import React, { useEffect, useState } from "react";
import LiveLWChart from "../components/LiveLWChart";

const TF_OPTIONS = ["1m", "1H", "1D"]; // match backend keys
const TICKERS = ["AAPL", "MSFT", "SPY", "NVDA", "TSLA"];

export default function LiveFeedsPage() {
  const [ticker, setTicker] = useState("AAPL");
  const [tf, setTf] = useState("1m");

  useEffect(() => {
    document.title = `Live • ${ticker} • ${tf} — Frye Dashboard`;
  }, [ticker, tf]);

  return (
    <main style={styles.page}>
      <div style={styles.toolbar} role="region" aria-label="Live chart controls">
        <div style={styles.title}>Live Chart (Lightweight Charts)</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label htmlFor="symbol" style={styles.srOnly}>Symbol</label>
          <select
            id="symbol"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            title="Symbol"
            style={styles.select}
            aria-label="Choose symbol"
          >
            {TICKERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {TF_OPTIONS.map((k) => (
            <button
              key={k}
              onClick={() => setTf(k)}
              style={{
                ...styles.btn,
                background: tf === k ? "#182230" : "#0f1520",
                color: tf === k ? "#cde3ff" : "#96a4bd",
              }}
              title={`Timeframe: ${k}`}
              aria-pressed={tf === k}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <LiveLWChart symbol={ticker} timeframe={tf} height={560} />
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "12px 14px 18px",
    background: "#0b0f17",
    color: "#d1d4dc",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  title: { fontWeight: 700, letterSpacing: ".06em", opacity: 0.95 },
  select: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #202733",
    background: "#0f1520",
    color: "#c9d6ea",
  },
  btn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #202733",
    cursor: "pointer",
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },
};
