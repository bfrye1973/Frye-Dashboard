// src/features/drawings/api.js
const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API = (BACKEND || "").replace(/\/+$/, "");

function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    p.set(k, String(v));
  });
  return p.toString();
}

async function jsonFetch(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    cache: "no-store",
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
  return data;
}

export async function getDrawings(symbol, tf) {
  return jsonFetch(`${API}/api/v1/drawings?${qs({ symbol, tf })}`, { method: "GET" });
}

export async function createDrawing(item) {
  return jsonFetch(`${API}/api/v1/drawings`, { method: "POST", body: JSON.stringify(item) });
}

export async function updateDrawing(id, item) {
  return jsonFetch(`${API}/api/v1/drawings/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(item),
  });
}

export async function deleteDrawing(id) {
  return jsonFetch(`${API}/api/v1/drawings/${encodeURIComponent(id)}`, { method: "DELETE" });
}
