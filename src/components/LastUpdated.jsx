// src/components/LastUpdated.jsx
import React from "react";

export function LastUpdated({ ts, liveWindowMs = 2 * 60 * 1000 }) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  const now = Date.now();
  const ageMs = now - t;
  const live = ageMs >= 0 && ageMs <= liveWindowMs;

  const fmt = new Date(ts).toLocaleString(); // hover tooltip

  // e.g., 95s ago
  const secs = Math.max(0, Math.round(ageMs / 1000));

  return (
    <span
      className={`badge ${live ? "live" : "stale"}`}
      title={`Last update: ${fmt}`}
      style={{ marginLeft: 8 }}
    >
      {live ? "LIVE" : "STALE"} • {secs}s ago
    </span>
  );
}
