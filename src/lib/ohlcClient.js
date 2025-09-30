// src/lib/ohlcClient.js
// Canonical OHLC client (compat-safe):
// - getOHLC(symbol, timeframe, limit) -> returns plain bars array in EPOCH SECONDS
// - fetchOHLCResilient({ symbol, timeframe, limit }) -> { source, bars }  (shim for legacy callers)

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API = (BACKEND || "").replace(/\/+$/, "");

const isMs = (t) => typeof t === "number" && t > 1e12;
const toSec = (t) => (isMs(t) ? Math.floor(t / 1000) : t);

function normalizeBars(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(Boolean)
    .map((b) => ({
      time: toSec(b.time ?? b.t ?? b.ts ?? b.timestamp),
      open: Number(b.open ?? b.o),
      high: Number(b.high ?? b.h),
      low: Number(b.low ?? b.l),
      close: Number(b.close ?? b.c),
      volume: Number(b.volume ?? b.v ?? 0),
    }))
    .filter(
      (b) =>
        Number.isFinite(b.time) &&
        Number.isFinite(b.open) &&
        Number.isFinite(b.high) &&
        Number.isFinite(b.low) &&
        Number.isFinite(b.close)
    );
}

/** Minimal canonical call used by the new RowChart */
export async function getOHLC(symbol = "SPY", timeframe = "1h", limit = 1500) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = String(timeframe || "1h");
  const url =
    `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}` +
    `&timeframe=${encodeURIComponent(tf)}&limit=${limit}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`OHLC ${r.status}`);

  // Backend returns a plain array: [{ time, open, high, low, close, volume }, ...]
  const data = await r.json();
  const bars = normalizeBars(Array.isArray(data) ? data : data?.bars || []);
  return bars;
}

/** Compatibility shim: some code still imports fetchOHLCResilient */
export async function fetchOHLCResilient({ symbol, timeframe, limit = 1500 }) {
  const bars = await getOHLC(symbol, timeframe, limit);
  return { source: "api/v1/ohlc", bars };
}

// Optional default export for any legacy default imports
export default { getOHLC, fetchOHLCResilient };
