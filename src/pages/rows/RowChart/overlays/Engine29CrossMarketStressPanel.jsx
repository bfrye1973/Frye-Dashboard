// src/pages/rows/RowChart/overlays/Engine29CrossMarketStressPanel.jsx
// Engine 29 floating chart-window panel.
// Opened from RowChart -> Indicators -> Engine 29 — Cross-Market Stress.
// Read-only. Uses Engine 29 summary API and never owns trade permission.

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const SUMMARY_ROUTE = `${API_ROOT}/api/v1/engine29/cross-market-stress/summary`;

const FONT = "Arial, Helvetica, sans-serif";

function clean(value) {
  return String(value || "—").replaceAll("_", " ");
}

function stateColor(value) {
  const text = String(value || "").toUpperCase();

  if (
    text.includes("SYSTEMIC") ||
    text.includes("RISK OFF") ||
    text.includes("RISK_OFF") ||
    text.includes("BREAKING") ||
    text.includes("CONFIRMED") ||
    text.includes("NEGATIVE") ||
    text.includes("DETERIORATION") ||
    text.includes("SELLING")
  ) {
    return "#ef4444";
  }

  if (
    text.includes("CAUTION") ||
    text.includes("WARNING") ||
    text.includes("WEAKENING") ||
    text.includes("BUILDING") ||
    text.includes("STABILIZING") ||
    text.includes("RECOVERY") ||
    text.includes("MIXED") ||
    text.includes("NO ACTIVE")
  ) {
    return "#fbbf24";
  }

  if (
    text.includes("HEALTHY") ||
    text.includes("NORMAL") ||
    text.includes("POSITIVE") ||
    text.includes("BROAD MOVE UP") ||
    text.includes("BUYING")
  ) {
    return "#22c55e";
  }

  return "#94a3b8";
}

function TinyState({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.22)",
        borderRadius: 8,
        padding: "7px 8px",
        background: "rgba(2,6,23,0.48)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 10,
          fontWeight: 850,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          color: stateColor(value),
          fontSize: 13,
          lineHeight: 1.15,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {clean(value)}
      </div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 12,
        lineHeight: 1.28,
      }}
    >
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span
        style={{
          color: stateColor(value),
          fontWeight: 900,
          textAlign: "right",
          textTransform: "uppercase",
        }}
      >
        {clean(value)}
      </span>
    </div>
  );
}

export default function Engine29CrossMarketStressPanel({ visible = false, symbol = "ES" }) {
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("IDLE");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return undefined;

    let cancelled = false;

    async function load() {
      try {
        setStatus((current) => (payload ? current : "LOADING"));
        setError(null);

        const res = await fetch(SUMMARY_ROUTE, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || `Engine 29 summary HTTP ${res.status}`);
        }

        if (!cancelled) {
          setPayload(json?.data || null);
          setStatus("READY");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("ERROR");
          setError(err?.message || String(err));
        }
      }
    }

    load();
    const id = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [visible]); // intentionally starts/stops polling with chart-window visibility

  const display = payload?.display || {};
  const hood = display?.underTheHood || {};
  const pressure = hood?.pressure || {};

  const titleBorder = useMemo(
    () => stateColor(payload?.overallState || display?.overall),
    [payload?.overallState, display?.overall]
  );

  if (!visible) return null;

  return (
    <div
      style={{
        fontFamily: FONT,
        position: "absolute",
        top: 126,
        left: 28,
        zIndex: 117,
        width: 760,
        maxWidth: "calc(100vw - 70px)",
        maxHeight: "calc(100vh - 150px)",
        overflowY: "auto",
        borderRadius: 14,
        border: `1px solid ${titleBorder}`,
        background: "rgba(6,10,20,0.96)",
        padding: "12px 14px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "auto",
        textAlign: "left",
        boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
        display: "grid",
        gap: 9,
      }}
      title="Engine 29 Cross-Market Stress"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          borderBottom: "1px solid rgba(148,163,184,0.18)",
          paddingBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              color: "#60a5fa",
              fontSize: 16,
              lineHeight: 1.15,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            Engine 29 — Cross-Market Stress
          </div>
          <div style={{ marginTop: 3, color: "#cbd5e1", fontSize: 11, fontWeight: 650 }}>
            ES tactical anchor · 1W structure · 1H intraday · 30m shift
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.open("/engine29-full", "_blank", "noopener,noreferrer");
          }}
          style={{
            background: "rgba(15,23,42,0.92)",
            border: "1px solid rgba(96,165,250,0.4)",
            color: "#bfdbfe",
            borderRadius: 8,
            padding: "6px 9px",
            fontSize: 10,
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Open Full View
        </button>
      </div>

      {status === "ERROR" && (
        <div style={{ color: "#fecaca", fontSize: 12, fontWeight: 700 }}>
          Engine 29 error: {error}
        </div>
      )}

      {status === "LOADING" && !payload && (
        <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>
          Loading Engine 29…
        </div>
      )}

      {payload && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 7 }}>
            <TinyState label="1W Structure" value={display?.oneWeek?.state || payload?.structuralState} />
            <TinyState label="1H Now" value={display?.oneHour?.state || payload?.tacticalState} />
            <TinyState label="30m Shift" value={display?.thirtyMinute?.state || payload?.fastTacticalState} />
            <TinyState label="ES Move" value={display?.thirtyMinute?.status || payload?.moveCharacter} />
          </div>

          <div
            style={{
              border: "1px solid rgba(59,130,246,0.24)",
              borderRadius: 9,
              background: "rgba(30,64,175,0.10)",
              padding: "8px 9px",
              display: "grid",
              gap: 5,
            }}
          >
            <div style={{ color: "#93c5fd", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
              Under The Hood
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
              <KV label="Large Indexes" value={hood?.largeIndexes} />
              <KV label="Breadth" value={hood?.breadth} />
              <KV label="Leadership" value={hood?.techLeadership} />
              <KV label="Credit" value={hood?.credit} />
              <KV label="Rates / Bonds" value={hood?.ratesBonds} />
              <KV label="Oil" value={hood?.oil} />
              <KV label="Volatility" value={hood?.volatility} />
              <KV label="Financial Conditions" value={hood?.financialConditions} />
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(148,163,184,0.20)",
              borderRadius: 9,
              padding: "8px 9px",
              background: "rgba(2,6,23,0.44)",
              display: "grid",
              gap: 5,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ color: "#93c5fd", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
                30m Underlying Pressure
              </span>
              <span style={{ color: stateColor(pressure?.state || payload?.underlyingPressure), fontSize: 12, fontWeight: 900 }}>
                {clean(pressure?.state || payload?.underlyingPressure)}
              </span>
            </div>

            <div style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.35 }}>
              Breadth {clean(pressure?.breadth)} · Leadership {clean(pressure?.leadership)} · Credit {clean(pressure?.credit)} · Financials {clean(pressure?.financials)}
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(148,163,184,0.18)",
              paddingTop: 7,
              color: "#cbd5e1",
              fontSize: 11,
              lineHeight: 1.35,
            }}
          >
            <strong style={{ color: "#f8fafc" }}>Overall:</strong>{" "}
            <span style={{ color: stateColor(display?.overall), fontWeight: 900 }}>
              {clean(display?.overall)}
            </span>
            {display?.overallSummary ? ` — ${display.overallSummary}` : ""}
          </div>

          {Array.isArray(display?.missingConfirmation) && display.missingConfirmation.length > 0 && (
            <div style={{ color: "#fbbf24", fontSize: 10, lineHeight: 1.3, fontWeight: 700 }}>
              Missing confirmation: {display.missingConfirmation.map(clean).join(" · ")}
            </div>
          )}

          <div style={{ color: "#64748b", fontSize: 9, textAlign: "right" }}>
            {symbol || "ES"} · refresh 60s · Engine 29 is contextual only
          </div>
        </>
      )}
    </div>
  );
}
