// src/lib/api.js
// Centralized API helper

// Always resolve a full backend base URL.
// Order: build-time env -> runtime window override -> hard fallback.
const API_BASE =
  process.env.REACT_APP_API_BASE || // set in Render frontend env
  (typeof window !== "undefined" && window.__API_BASE__) || // optional override from index.html
  "https://frye-market-backend-1.onrender.com"; // safe default fallback

// Helper to build URLs safely
export const apiUrl = (path) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
};

// Health check
export async function apiHealth() {
  const r = await fetch(apiUrl("/api/health"));
  if (!r.ok) throw new Error(`Health ${r.status}`);
  return r.json();
}

// Fetch OHLC history (frontend params -> backend shape)
export async function fetchHistory(ticker, tf /* from, to unused for now */) {
  const symbol = String(ticker || "").toUpperCase();
  const timeframe = String(tf || "1m").toLowerCase();

  const q = new URLSearchParams({ symbol, timeframe }).toString();
  const r = await fetch(apiUrl(`/api/v1/ohlc?${q}`), { cache: "no-store" });
  if (!r.ok) throw new Error(`History ${r.status}`);

  const j = await r.json();
  const bars = Array.isArray(j?.bars) ? j.bars : [];

  return bars.map((b) => ({
    time: b.t,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
    volume: b.v,
  }));
}

// Fetch market metrics (keep as-is if you add this route later)
export async function fetchMetrics() {
  const r = await fetch(apiUrl("/api/market-metrics"), { cache: "no-store" });
  if (!r.ok) throw new Error(`Metrics ${r.status}`);
  return r.json();
}
