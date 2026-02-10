// src/replay/replayApi.js
const CORE_BASE =
  import.meta.env.VITE_CORE_BASE_URL ||
  "https://<YOUR-BACKEND-1-URL>"; // set this in env

async function j(url) {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
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
  return j(`${CORE_BASE}/api/v1/replay/snapshot?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`);
}

export function replayEvents(date) {
  return j(`${CORE_BASE}/api/v1/replay/events?date=${encodeURIComponent(date)}`);
}
