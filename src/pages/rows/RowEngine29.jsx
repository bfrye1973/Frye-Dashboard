// src/pages/rows/RowEngine29.jsx
// Compact Engine 29 card for the main dashboard.

import React from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ROUTE = `${API_ROOT}/api/v1/engine29/cross-market-stress/summary`;

function clean(value) {
  return String(value ?? "—").replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function colorFor(value) {
  const text = String(value || "").toUpperCase();
  if (text.includes("RISK_OFF") || text.includes("SYSTEMIC") || text.includes("BREAKING") || text.includes("NEGATIVE")) return "#ef4444";
  if (text.includes("BROAD_DETERIORATION") || text.includes("STRESS CONFIRMED") || text.includes("WEAKENING") || text.includes("STRESS BUILDING")) return "#f97316";
  if (text.includes("CAUTION") || text.includes("STABILIZING") || text.includes("FORMING") || text.includes("WARNING") || text.includes("NO ACTIVE") || text.includes("MIXED")) return "#fbbf24";
  if (text.includes("RECOVERING") || text.includes("HEALTHY") || text.includes("POSITIVE")) return "#22c55e";
  return "#94a3b8";
}

function MiniState({ label, value }) {
  return (
    <div style={{ minWidth: 150, padding: "8px 10px", borderRadius: 10, background: "rgba(15,23,42,0.72)", border: "1px solid rgba(148,163,184,0.2)" }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 4, color: colorFor(value), fontSize: 15, fontWeight: 900 }}>{clean(value)}</div>
    </div>
  );
}

export default function RowEngine29() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let stop = false;

    async function load() {
      try {
        const res = await fetch(`${ROUTE}?t=${Date.now()}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!stop) {
          setData(json?.data || null);
          setError(null);
        }
      } catch (err) {
        if (!stop) setError(err?.message || String(err));
      }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const display = data?.display || {};
  const hood = display?.underTheHood || {};

  return (
    <section className="panel" style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(59,130,246,0.35)", background: "#0b0b0c", boxShadow: "0 10px 24px rgba(0,0,0,0.28)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#f8fafc" }}>ENGINE 29 — CROSS-MARKET STRESS</div>
          <div style={{ marginTop: 3, color: "#94a3b8", fontSize: 12 }}>1W structure · 1H intraday · 30m shift · ES squeeze / liquidity character</div>
        </div>

        <button
          type="button"
          onClick={() => window.open("/engine29-full", "_blank", "noopener,noreferrer")}
          style={{ background: "rgba(37,99,235,0.22)", border: "1px solid rgba(96,165,250,0.5)", color: "#bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer", textTransform: "uppercase" }}
        >
          Open Engine 29
        </button>
      </div>

      {error && <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 12 }}>Engine 29: {error}</div>}

      {data && (
        <>
          <div style={{ marginTop: 11, display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 8 }}>
            <MiniState label="1W" value={display?.oneWeek?.state || data?.structuralState} />
            <MiniState label="1H" value={display?.oneHour?.state || data?.tacticalState} />
            <MiniState label="30m" value={display?.thirtyMinute?.state || data?.fastTacticalState} />
            <MiniState label="ES Move" value={data?.moveCharacter || display?.thirtyMinute?.moveCharacter || display?.thirtyMinute?.status} />
          </div>

          <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(6, minmax(130px, 1fr))", gap: 7 }}>
            {[
              ["Breadth", hood?.breadth],
              ["Leadership", hood?.techLeadership],
              ["Credit", hood?.credit],
              ["Rates", hood?.ratesBonds],
              ["Oil", hood?.oil],
              ["Pressure", hood?.pressure?.state || data?.underlyingPressure],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "7px 9px", borderRadius: 8, background: "rgba(2,6,23,0.4)", border: "1px solid rgba(148,163,184,0.14)" }}>
                <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>{label}</div>
                <div style={{ marginTop: 3, color: colorFor(value), fontSize: 13, fontWeight: 900 }}>{clean(value)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
