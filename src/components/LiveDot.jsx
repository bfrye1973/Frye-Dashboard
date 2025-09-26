// src/components/LiveDot.jsx
import React from "react";

/**
 * LiveDot
 * status: "green" | "yellow" | "red"
 * tip: tooltip text
 */
export default function LiveDot({ status = "yellow", tip = "" }) {
  const colors = {
    green: { bg: "#16a34a", ring: "#22c55e" },
    yellow:{ bg: "#f59e0b", ring: "#fbbf24" },
    red:   { bg: "#ef4444", ring: "#f87171" },
  }[status] || { bg:"#9ca3af", ring:"#cbd5e1" };

  return (
    <span title={tip} style={{
      display:"inline-block", width:10, height:10, borderRadius:999,
      background:colors.bg, boxShadow:`0 0 0 2px ${colors.ring}44`, marginLeft:6
    }}/>
  );
}
