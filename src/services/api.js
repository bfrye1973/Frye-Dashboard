// src/services/api.js

// In dev, we'll use a relative path so Webpack devServer proxy forwards
// requests to the backend without hitting CORS issues.
// In production, you can set API_BASE_URL in .env.production.

const isProd = process.env.NODE_ENV === 'production';
const API_BASE = isProd ? process.env.API_BASE_URL : '';

export async function getHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function openWS(path = '/') {
  if (!isProd) {
    console.warn('WebSocket not configured for dev mode');
    return null;
  }
  return new WebSocket(`${process.env.WS_URL}${path}`);
}
