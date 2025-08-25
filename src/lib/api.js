// src/lib/api.js
// Ferrari Dashboard API config

// 🔗 Backend base URLs (Render service)
export const HTTP_BASE = "https://frye-market-backend-1.onrender.com";
export const WS_BASE   = "wss://frye-market-backend-1.onrender.com";

// Health check
export async function checkHealth() {
  const r = await fetch(`${HTTP_BASE}/health`);
  return r.json();
}

// Example fetchers for gauges
export async function fetchGauge(name) {
  const r = await fetch(`${HTTP_BASE}/gauges/${name}`);
  return r.json();
}

export async function fetchSignals() {
  const r = await fetch(`${HTTP_BASE}/signals`);
  return r.json();
}

// Example WebSocket connectors
export function wsGauge(name, onMsg) {
  const ws = new WebSocket(`${WS_BASE}/gauges/${name}`);
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  return ws;
}

export function wsSignals(onMsg) {
  const ws = new WebSocket(`${WS_BASE}/signals`);
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  return ws;
}
