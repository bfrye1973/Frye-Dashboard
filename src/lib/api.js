// src/lib/api.js
const API =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://frye-market-backend-1.onrender.com";

export async function apiHealth() {
  const r = await fetch(`${API}/api/health`);
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json();
}

export async function fetchHistory(ticker, tf, from, to) {
  const q = new URLSearchParams({ ticker, tf, from, to }).toString();
  const r = await fetch(`${API}/api/history?${q}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`history ${r.status}`);
  const data = await r.json();
  return (data ?? []).map((b) => {
    const raw = b.time ?? b.t;
    const time = Math.round(raw / (raw > 2_000_000_000 ? 1000 : 1)); // force seconds
    return {
      time,
      open: b.open ?? b.o,
      high: b.high ?? b.h,
      low: b.low ?? b.l,
      close: b.close ?? b.c,
      volume: b.volume ?? b.v,
    };
  });
}

export async function fetchMetrics() {
  const r = await fetch(`${API}/api/market-metrics`, { cache: "no-store" });
  if (!r.ok) throw new Error(`metrics ${r.status}`);
  return r.json();
}
