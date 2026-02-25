// src/lib/drawingsClient.js
// Drawings API client for Backend-1 (core)

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
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    cache: "no-store",
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = data?.detail || data?.error || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function getDrawings(symbol, tf) {
  const url = `${API}/api/v1/drawings?${qs({ symbol, tf })}`;
  return jsonFetch(url, { method: "GET" });
}

export async function createDrawing(item) {
  const url = `${API}/api/v1/drawings`;
  return jsonFetch(url, { method: "POST", body: JSON.stringify(item) });
}

export async function updateDrawing(id, item) {
  const url = `${API}/api/v1/drawings/${encodeURIComponent(id)}`;
  return jsonFetch(url, { method: "PUT", body: JSON.stringify(item) });
}

export async function deleteDrawing(id) {
  const url = `${API}/api/v1/drawings/${encodeURIComponent(id)}`;
  return jsonFetch(url, { method: "DELETE" });
}
