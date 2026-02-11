// src/replay/replayApi.js
// CRA-safe: do NOT use import.meta

function getCoreBase() {
  // Prefer explicit env var if set
  const env = (process.env.REACT_APP_API_BASE || "").trim();

  // Default to backend-1 (Render)
  const fallback = "https://frye-market-backend-1.onrender.com";

  const base = (env || fallback).trim();

  // If someone set REACT_APP_API_BASE to ".../api", strip it
  return base.replace(/\/api\/?$/, "");
}

const CORE_BASE = getCoreBase();

async function j(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function replayDates() {
  return j(`${CORE_BASE}/api/v1/replay/dates`);
}

export function replayTimes(date) {
  return j(`${CORE_BASE}/api/v1/replay/times?date=${encodeURIComponent(date)}`);
}

export function replaySnapshot(date, time) {
  return j(
    `${CORE_BASE}/api/v1/replay/snapshot?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`
  );
}

export function replayEvents(date) {
  return j(`${CORE_BASE}/api/v1/replay/events?date=${encodeURIComponent(date)}`);
}
