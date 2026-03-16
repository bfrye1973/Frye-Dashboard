// src/lib/chartOverlayClient.js

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API = (BACKEND || "").replace(/\/+$/, "");

function normalizeTf(tf) {
  const t = String(tf || "30m").toLowerCase().trim();
  return t;
}

export async function getChartOverlay(symbol = "SPY", timeframe = "30m") {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = normalizeTf(timeframe);

  const url =
    `${API}/api/v1/chart-overlay?symbol=${encodeURIComponent(sym)}` +
    `&tf=${encodeURIComponent(tf)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`chart-overlay ${r.status}`);

  return r.json();
}

export default { getChartOverlay };
