// src/pages/rows/RowChart/constants.js

// Preset symbols for dropdown
export const SYMBOLS = [
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "NVDA",
  "I:SPX", // S&P 500 index (normalized)
  "I:NDX", // Nasdaq-100 index
  "I:DJI", // Dow Jones index
  "I:VIX", // VIX (you can keep it hidden in UI if desired)
  "MDY"
  ];

// Preset timeframes for dropdown
export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

// Resolve API base URL (priority: explicit prop > env > same-origin)
export function resolveApiBase(explicit) {
  const env = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");
  const prop = (explicit || "").replace(/\/$/, "");
  return prop || env || window.location.origin;
}
