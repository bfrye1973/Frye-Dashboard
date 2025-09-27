// src/components/trading/PositionsDock.jsx
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

const fmt = (n, d = 2) => (typeof n === "number" ? n.toFixed(d) : "—");
const pnlColor = (v) =>
  typeof v === "number" ? (v > 0 ? "#16a34a" : v < 0 ? "#dc2626" : "#9ca3af") : "#9ca3af";

export default function PositionsDock() {
  const apiBase = getApiBase();
  const url = useMemo(() => `${apiBase.replace(/\/+$/, "")}/api/trading/positions`, [apiBase]);

  const [rows, setRows] = useState([]);
  const [available, setAvailable] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

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
        setAvailable(false);
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
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1500,
        pointerEvents: "auto",
      }}
    >
      {/* subtle backdrop blur bar */}
      <div
        style={{
          margin: 8,
          borderRadius: 12,
          border: "1px solid #1f2937",
          background: "rgba(11,15,20,0.92)",
          backdropFilter: "blur(6px)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px",
            borderBottom: collapsed ? "none" : "1px solid #111827",
          }}
        >
          <strong style={{ color: "#93c5fd", fontSize: 13 }}>Positions</strong>
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
            {available ? "live" : "endpoint not available"}
          </span>

          <button
            onClick={() => setCollapsed((v) => !v)}
            style={{
              marginLeft: "auto",
              background: "#111827",
              color: "#e5e7eb",
              border: "1px solid #1f2937",
              borderRadius: 999,
              padding: "3px 10px",
              cursor: "pointer",
              fontSize: 12,
            }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "Expand ▲" : "Collapse ▼"}
          </button>
        </div>

        {!collapsed && (
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              padding: "6px 8px",
              maxHeight: 56, // keeps it short
            }}
          >
            {rows.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 12, padding: "2px 6px" }}>
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
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
