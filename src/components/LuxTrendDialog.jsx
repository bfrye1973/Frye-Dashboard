// src/components/LuxTrendDialog.jsx
import React from "react";

const asTone = (s) => {
  const v = String(s ?? "").toLowerCase();
  if (v.includes("bull") || v.includes("green")) return "bull";
  if (v.includes("bear") || v.includes("red"))   return "bear";
  return "neutral"; // compression / chop => yellow
};

const asText = (v) => {
  if (v == null) return "";
  try {
    // strings & numbers pass through; objects become short JSON
    return typeof v === "string" || typeof v === "number"
      ? String(v)
      : JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export default function LuxTrendDialog({ title, state, reason, updatedAt }) {
  const t = asTone(state);
  const color =
    t === "bull"    ? "var(--ok)" :
    t === "bear"    ? "var(--danger)" :
                      "var(--warn)";   // YELLOW

  const styles = {
    base: {
      display: "inline-flex", flexDirection: "column", gap: 2,
      padding: "6px 10px", borderRadius: 10,
      border: "1px solid var(--border)", background: "rgba(12,19,32,.85)",
      boxShadow: "0 1px 0 rgba(0,0,0,.35) inset, 0 0 0 1px rgba(255,255,255,.03)",
      whiteSpace: "nowrap"
    },
    title: { fontSize: 12, opacity: .8 },
    state: { fontSize: 13, fontWeight: 700, color },
    reason:{ fontSize: 12, opacity: .75, maxWidth: 300, overflow:"hidden", textOverflow:"ellipsis" },
    time:  { fontSize: 11, opacity: .6 },
  };

  const titleText  = asText(title);
  const stateText  = asText(state);
  const reasonText = asText(reason);
  const timeText   = asText(updatedAt);

  return (
    <div className="lux-dialog" style={styles.base} title={reasonText}>
      <div style={styles.title}>{titleText}</div>
      <div style={styles.state}>{stateText || "—"}</div>
      {reasonText ? <div style={styles.reason}>{reasonText}</div> : null}
      {timeText   ? <div style={styles.time}>{timeText}</div>     : null}
    </div>
  );
}

