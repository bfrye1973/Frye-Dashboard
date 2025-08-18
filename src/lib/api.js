// src/lib/api.js
// Centralized API helper (Vite/CRA compatible)

// Resolve backend base URL in this order:
// 1) Vite env (VITE_API_BASE_URL)
// 2) CRA env  (REACT_APP_API_BASE)
// 3) Runtime override injected in index.html (window.__API_BASE__)
// 4) Hard fallback (Render backend URL)
const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_API_BASE) ||
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://frye-market-backend-1.onrender.com";

// Build URL safely
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
export async function fetchHistory(ticker, tf /* from, to unused */) {
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

// (Optional) Market metrics — keep if/when you add the route
export async function fetchMetrics() {
  const r = await fetch(apiUrl("/api/market-metrics"), { cache: "no-store" });
  if (!r.ok) throw new Error(`Metrics ${r.status}`);
  return r.json();
}
