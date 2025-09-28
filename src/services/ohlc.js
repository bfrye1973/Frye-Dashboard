// src/services/ohlc.js
const API_BASE =
  (process.env.REACT_APP_API_BASE && process.env.REACT_APP_API_BASE.replace(/\/+$/, "")) ||
  "https://frye-market-backend-1.onrender.com";

/**
 * Fetch historical OHLC for charts.
 * Returns an array of { time, open, high, low, close, volume } in EPOCH SECONDS.
 */
export async function getOHLC(symbol = "SPY", timeframe = "10m", limit = 1500) {
  const url = `${API_BASE}/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`OHLC ${r.status}`);
  const bars = await r.json();
  // Backend already returns seconds; do not convert again.
  return Array.isArray(bars) ? bars : [];
}
