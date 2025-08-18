// src/pages/LiveFeeds.jsx
import React, { useEffect, useMemo, useState } from "react";
import LiveLWChart from "../components/LiveLWChart";

const TF_OPTIONS = ["1m", "1h", "1d"];
const TICKERS = ["AAPL", "MSFT", "SPY", "NVDA", "TSLA"];

// Map UI -> API timeframe; tweak if your backend expects different keys.
const TF_TO_API = { "1m": "1m", "1h": "1H", "1d": "1D" };

export default function LiveFeedsPage() {
  const [ticker, setTicker] = useState(() => localStorage.getItem("lf:ticker") || "AAPL");
  const [tf, setTf] = useState(() => localStorage.getItem("lf:tf") || "1m");

  // Persist choices
  useEffect(() => localStorage.setItem("lf:ticker", ticker), [ticker]);
  useEffect(() => localStorage.setItem("lf:tf", tf), [tf]);

  // Nice page title
  useEffect(() => {
    document.title = `Live • ${ticker} • ${tf.toUpperCase()} — Frye Dashboard`;
  }, [ticker, tf]);

  // Ensure timeframe always valid
  const safeTf = useMemo(() => (TF_OPTIONS.includes(tf) ? tf : "1m"), [tf]);
  const apiTf = TF_TO_API[safeTf] || "1m";

  return (
    <main style={styles.page}>
      <div style={styles.toolbar} role="region" aria-label="Live chart controls">
        <div style={styles.title}>Live Chart (Lightweight Charts)</div>

        <div style={{ display: "flex", gap: 8 }}>
          <label style={styles.srOnly} htmlFor="symbol-select">Symbol</label>
          <select
            id="symbol-select"
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
                background: safeTf === k ? "#182230" : "#0f1520",
                color: safeTf === k ? "#cde3ff" : "#96a4bd",
              }}
              title={`Timeframe: ${k}`}
              aria-pressed={safeTf === k}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Lightweight Charts */}
      <LiveLWChart symbol={ticker} timeframe={apiTf} height={560} />
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
