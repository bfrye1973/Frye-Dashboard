// src/pages/redline/WaveDegreesPage.jsx
import React from "react";
import { useDashboardSnapshot } from "../../hooks/useDashboardSnapshot";
import Engine22MarketStructureCard from "../rows/RowChart/overlays/Engine22MarketStructureCard";

export default function WaveDegreesPage() {
  const {
    data: snapshot,
    err,
    loading,
    refreshing,
    lastFetch,
  } = useDashboardSnapshot("ES", {
    pollMs: 20000,
    timeoutMs: 20000,
    includeContext: 1,
  });

  const strategy =
    snapshot?.strategies?.["intraday_scalp@10m"] || null;

  const engine22Display =
    strategy?.engine22WaveStrategy?.engine22Display || null;

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
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>
            WAVE DEGREES
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
            Engine22 structural view from Subminute through Primary.
          </div>
        </div>

        <div style={{ color: refreshing ? "#fbbf24" : "#22c55e", fontSize: 12, fontWeight: 900 }}>
          {loading && !snapshot ? "LOADING" : refreshing ? "REFRESHING" : "LIVE"}
          {lastFetch ? " · " + lastFetch : ""}
        </div>
      </div>

      {err && (
        <div
          style={{
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(127,29,29,.18)",
            color: "#fecaca",
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
          }}
        >
          Wave Degrees data error: {err}
        </div>
      )}

      <div
        style={{
          border: "1px solid rgba(148,163,184,.16)",
          borderRadius: 14,
          background: "rgba(7,10,14,.92)",
          padding: 12,
          overflowX: "auto",
        }}
      >
        <Engine22MarketStructureCard engine22Display={engine22Display} />
      </div>
    </div>
  );
}
