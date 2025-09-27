// src/pages/rows/RowPositionsStrip.jsx
import React, { useEffect, useMemo, useState } from "react";

/* --------------------- CRA-safe backend base resolver --------------------- */
function getApiBase() {
  const DEFAULT_BACKEND = "https://frye-market-backend-1.onrender.com";
  return DEFAULT_BACKEND;
}

async function safeGet(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = await res.json().catch(() => null);
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e?.message || "Network error" };
  }
}

/* ------------------------------ tiny helpers ------------------------------ */
const fmt = (n, d = 2) => (typeof n === "number" ? n.toFixed(d) : "—");
const pnlColor = (v) =>
  typeof v === "number" ? (v > 0 ? "#16a34a" : v < 0 ? "#dc2626" : "#9ca3af") : "#9ca3af";

/* ------------------------------- main strip ------------------------------- */
export default function RowPositionsStrip() {
  const apiBase = getApiBase();
  const url = useMemo(() => `${apiBase.replace(/\/+$/, "")}/api/trading/positions`, [apiBase]);

  const [rows, setRows] = useState([]);
  const [available, setAvailable] = useState(null); // null = unknown, true/false after first hit

  useEffect(() => {
    let alive = true;

    async function tick() {
      const res = await safeGet(url);
      if (!alive) return;

      if (res.ok && Array.isArray(res.data)) {
        setRows(res.data);
        setAvailable(true);
      } else {
        setRows([]);
        setAvailable(res.status === 404 ? false : false); // show “not available yet”
      }
    }

    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url]);

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 12,
        background: "#0b0f14",
        padding: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <strong style={{ color: "#93c5fd", fontSize: 14 }}>Positions</strong>
        <span
          style={{
            fontSize: 11,
            color: available ? "#10b981" : "#9ca3af",
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: 999,
            padding: "1px 8px",
          }}
        >
          {available ? "live" : "endpoint not available yet"}
        </span>
      </div>

      {/* Horizontal chips list (small, scrollable if overflow) */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 2,
          maxHeight: 56, // keeps the row short
        }}
      >
        {rows.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 12, padding: "4px 6px" }}>
            No positions.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={i}
              title={`${r.symbol} • qty ${r.qty} @ ${fmt(r.avgPrice)} • P/L ${fmt(r.pnl)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#0f172a",
                border: "1px solid #1f2937",
                borderRadius: 10,
                padding: "6px 8px",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{r.symbol}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>qty</span>
              <span style={{ color: "#e5e7eb" }}>{r.qty}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>avg</span>
              <span style={{ color: "#e5e7eb" }}>{fmt(r.avgPrice)}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>P/L</span>
              <span style={{ color: pnlColor(r.pnl), fontWeight: 700 }}>{fmt(r.pnl)}</span>
              {typeof r.realizedPnl === "number" && (
                <>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>real</span>
                  <span style={{ color: pnlColor(r.realizedPnl) }}>{fmt(r.realizedPnl)}</span>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
