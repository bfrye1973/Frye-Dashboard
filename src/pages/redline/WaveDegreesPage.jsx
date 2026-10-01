// src/pages/redline/WaveDegreesPage.jsx
// Redline Wave Degrees page.
// Reuses the canonical combined RowStrategies presentation so Engine 22 Wave Degrees
// and Engine 27 Trader Intelligence stay together and read the same live snapshot.

import React from "react";
import RowStrategies from "../rows/RowStrategies";

export default function WaveDegreesPage() {
  const qs = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );

  const candidateId = qs.get("candidateId") || "";
  const strategyId = qs.get("strategyId") || "";
  const setupClass = qs.get("setupClass") || "";
  const symbol = (qs.get("symbol") || "ES").toUpperCase();
  const tf = qs.get("tf") || "10m";

  return (
    <div style={{ maxWidth: 1900, margin: "0 auto", minWidth: 0 }}>
      <div
        style={{
          border: "1px solid rgba(239,68,68,.24)",
          borderLeft: "4px solid #ef4444",
          borderRadius: 12,
          padding: "12px 14px",
          background:
            "linear-gradient(90deg, rgba(127,29,29,.16), rgba(10,13,17,.96) 32%)",
          marginBottom: 14,
        }}
      >
        <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>
          WAVE DEGREES + TRADER INTELLIGENCE
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
          Engine22 structure and Engine27 trader-facing intelligence in one synchronized view.
        </div>
      </div>

      {candidateId ? (
        <div
          style={{
            border: "1px solid rgba(251,191,36,.34)",
            background: "rgba(120,53,15,.14)",
            borderRadius: 12,
            padding: "10px 12px",
            marginBottom: 14,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <strong style={{ color: "#fde68a" }}>
            LINKED ENGINE26 SETUP
          </strong>
          <span style={{ color: "#f8fafc", fontWeight: 900 }}>
            {candidateId}
          </span>
          <span style={{ color: "#94a3b8" }}>
            {symbol} · {tf}
          </span>
          {strategyId ? (
            <span style={{ color: "#94a3b8" }}>
              {strategyId}
            </span>
          ) : null}
          {setupClass ? (
            <span style={{ color: "#94a3b8" }}>
              {setupClass.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid rgba(148,163,184,.16)",
          borderRadius: 14,
          background: "rgba(7,10,14,.92)",
          padding: 10,
          overflowX: "auto",
        }}
      >
        <RowStrategies />
      </div>
    </div>
  );
}
