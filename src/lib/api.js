// src/lib/api.js
// Centralized API helper

const API_BASE =
  process.env.REACT_APP_API_BASE || // from Vercel/Render env variable
  (typeof window !== "undefined" && window.__API_BASE__) || // optional override
  ""; // default to relative (/api/...) in dev with proxy

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

// Fetch OHLC history
export async function fetchHistory(ticker, tf, from, to) {
  const q = new URLSearchParams({ ticker, tf, from, to }).toString();
  const r = await fetch(apiUrl(`/api/v1/ohlc?${q}`), { cache: "no-store" });
  if (!r.ok) throw new Error(`History ${r.status}`);
  const data = await r.json();
  return (data ?? []).map((b) => ({
    time: b.t,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
    volume: b.v,
  }));
}

// Fetch market metrics
export async function fetchMetrics() {
  const r = await fetch(apiUrl("/api/market-metrics"), { cache: "no-store" });
  if (!r.ok) throw new Error(`Metrics ${r.status}`);
  return r.json();
}

