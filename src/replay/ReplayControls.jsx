// src/replay/ReplayControls.jsx
import React from "react";
import { useReplay } from "./ReplayContext";

export default function ReplayControls() {
  const r = useReplay();

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={r.enabled}
          onChange={(e) => r.setEnabled(e.target.checked)}
        />
        Replay Mode
      </label>

      {r.enabled && (
        <>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Date
            <select value={r.date} onChange={(e) => r.setDate(e.target.value)}>
              {r.dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Time
            <select value={r.time} onChange={(e) => r.setTime(e.target.value)}>
              {r.times.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <button onClick={r.prevEvent} disabled={r.eventIdx <= 0}>
            Prev event
          </button>
          <button onClick={r.nextEvent} disabled={r.eventIdx < 0 || r.eventIdx >= r.events.length - 1}>
            Next event
          </button>

          <span style={{ opacity: 0.8 }}>
            {r.eventIdx >= 0 && r.events[r.eventIdx]
              ? `${r.events[r.eventIdx].type} @ ${r.events[r.eventIdx].tsUtc}`
              : "No events"}
          </span>
        </>
      )}
    </div>
  );
}
