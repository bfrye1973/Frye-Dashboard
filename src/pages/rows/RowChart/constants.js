// src/pages/rows/RowChart/constants.js

// Preset symbols for dropdown
export const SYMBOLS = [
  // ETFs / Majors
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "MDY",

  // Large cap techs
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "NVDA",

  // Indexes (normalized Polygon IDs)
  "I:SPX", // S&P 500 index
  "I:NDX", // Nasdaq-100 index
  "I:DJI", // Dow Jones index
  "I:VIX", // VIX index (inverse condition handled separately)
];

// Preset timeframes for dropdown
export const TIMEFRAMES = [
  "1m",
  "5m",
  "10m",  // ✅ added 10m, important for Alignment Scalper
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
];

// Resolve API base URL (priority: explicit prop > env > same-origin)
export function resolveApiBase(explicit) {
  const env = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");
  const prop = (explicit || "").replace(/\/$/, "");
  return prop || env || window.location.origin;
}
