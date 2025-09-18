// src/components/CadenceBadge.jsx
import React from "react";

/**
 * CadenceBadge
 * - Shows "cadence: intraday • age 2 min"
 * - Uses America/Phoenix timezone for the clock math (same as backend display)
 *
 * Props:
 *   ts: ISO timestamp string
 *   cadence: "intraday" | "hourly" | "eod" | "legacy" | string
 *   tz?: IANA tz (default America/Phoenix)
 */
export default function CadenceBadge({ ts, cadence, tz = "America/Phoenix" }) {
  // compute "age X min"
  let ageMin = null;
  try {
    if (ts) {
      const now = new Date();
      const t = new Date(ts);
      ageMin = Math.max(0, Math.round((now.getTime() - t.getTime()) / 60000));
    }
  } catch {
    ageMin = null;
  }

  const label =
    (cadence ? `cadence: ${cadence}` : "cadence: —") +
    (ageMin !== null ? ` • age ${ageMin} min` : "");

  // color hint by cadence
  const tone =
    cadence === "intraday"
      ? "#10b981" // green
      : cadence === "hourly"
      ? "#60a5fa" // blue
      : cadence === "eod"
      ? "#f59e0b" // amber
      : "#94a3b8"; // slate

  return (
    <span
      title={ts ? new Date(ts).toLocaleString("en-US", { timeZone: tz }) : ""}
      style={{
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #2b2b2b",
        background: "#0b0b0c",
        color: tone,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
