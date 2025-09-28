import React from "react";

export default function LinkOnly({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  label = "Open Full Chart ↗",
}) {
  const symbol = String(defaultSymbol || "SPY").toUpperCase();
  const tf = String(defaultTimeframe || "10m");
  const base =
    (typeof window !== "undefined" && window.location?.origin) || "";
  const href = `${base}/chart?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 700 }}>Chart</div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open Full Chart in a new tab"
        style={{
          border: "1px solid #2b2b2b",
          background: "#0b0b0b",
          color: "#e5e7eb",
          borderRadius: 8,
          padding: "8px 12px",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        {label}
      </a>
    </div>
  );
}
