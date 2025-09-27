// src/pages/rows/RowTradingReadOnly.jsx
import React, { useEffect, useMemo, useState } from "react";

/* --------------------- CRA-safe backend base resolver --------------------- */
function getApiBase() {
  // Same default you’re already using elsewhere
  const DEFAULT_BACKEND = "https://frye-market-backend-1.onrender.com";
  return DEFAULT_BACKEND;
}

/* ------------------------------ time helpers ------------------------------ */
const fmtAz = (iso) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

/* ------------------------- tiny fetch util (GET) -------------------------- */
async function safeGet(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      // 404/500 → show “Not available yet” without crashing
      return { ok: false, status: res.status, data: null };
    }
    const data = await res.json().catch(() => null);
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e?.message || "Network error" };
  }
}

/* ----------------------------- pretty badges ------------------------------ */
function Pill({ color = "#374151", children, title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: color,
        color: "#e5e7eb",
        fontSize: 12,
        lineHeight: "18px",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Section({ title, right, children }) {
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: 12, padding: 12, background: "#0b0f14" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "#93c5fd", fontSize: 14 }}>{title}</h3>
        </div>
        <div>{right}</div>
      </div>
      {children}
    </div>
  );
}

function SimpleTable({ columns, rows, emptyText }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || "left",
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "#9ca3af",
                  borderBottom: "1px solid #1f2937",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #111827" }}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      padding: "8px 10px",
                      textAlign: c.align || "left",
                      fontSize: 13,
                      color: "#e5e7eb",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.render ? c.render(r[c.key], r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------- main component ----------------------------- */
export default function RowTradingReadOnly() {
  const apiBase = getApiBase();
  const URLS = useMemo(() => {
    const base = apiBase.replace(/\/+$/, "");
    return {
      positions: `${base}/api/trading/positions`,
      orders: `${base}/api/trading/orders`,
      executions: `${base}/api/trading/executions`,
    };
  }, [apiBase]);

  const [positions, setPositions] = useState({ data: [], available: null, last: null });
  const [orders, setOrders] = useState({ data: [], available: null, last: null });
  const [executions, setExecutions] = useState({ data: [], available: null, last: null });

  // Poll each endpoint every 15s (safe read-only)
  useEffect(() => {
    let alive = true;

    async function tick() {
      const [p, o, e] = await Promise.all([
        safeGet(URLS.positions),
        safeGet(URLS.orders),
        safeGet(URLS.executions),
      ]);

      if (!alive) return;

      setPositions({
        data: Array.isArray(p.data) ? p.data : [],
        available: p.ok ? true : p.status !== 404 ? false : false, // 404 → not available yet
        last: new Date().toISOString(),
      });
      setOrders({
        data: Array.isArray(o.data) ? o.data : [],
        available: o.ok ? true : o.status !== 404 ? false : false,
        last: new Date().toISOString(),
      });
      setExecutions({
        data: Array.isArray(e.data) ? e.data : [],
        available: e.ok ? true : e.status !== 404 ? false : false,
        last: new Date().toISOString(),
      });
    }

    tick(); // initial
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [URLS.positions, URLS.orders, URLS.executions]);

  /* ------------------------------ render UI ------------------------------ */
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Positions */}
      <Section
        title="Positions (read-only)"
        right={
          <>
            <Pill color="#374151">Updated (AZ): {fmtAz(positions.last)}</Pill>
            {" "}
            <Pill color={positions.available ? "#065f46" : "#7c2d12"}>
              {positions.available ? "Available" : "Not available yet"}
            </Pill>
          </>
        }
      >
        <SimpleTable
          emptyText={positions.available === false ? "Endpoint not available yet." : "No positions."}
          columns={[
            { key: "symbol", label: "Symbol" },
            { key: "qty", label: "Qty", align: "right" },
            { key: "avgPrice", label: "Avg Price", align: "right", render: (v) => (v != null ? v.toFixed?.(2) ?? v : "—") },
            { key: "pnl", label: "Unrealized P/L", align: "right", render: (v) => (v != null ? v.toFixed?.(2) ?? v : "—") },
            { key: "realizedPnl", label: "Realized P/L", align: "right", render: (v) => (v != null ? v.toFixed?.(2) ?? v : "—") },
          ]}
          rows={positions.data}
        />
      </Section>

      {/* Orders */}
      <Section
        title="Orders (read-only)"
        right={
          <>
            <Pill color="#374151">Updated (AZ): {fmtAz(orders.last)}</Pill>
            {" "}
            <Pill color={orders.available ? "#065f46" : "#7c2d12"}>
              {orders.available ? "Available" : "Not available yet"}
            </Pill>
          </>
        }
      >
        <SimpleTable
          emptyText={orders.available === false ? "Endpoint not available yet." : "No orders."}
          columns={[
            { key: "id", label: "Order ID" },
            { key: "symbol", label: "Symbol" },
            { key: "side", label: "Side" },
            { key: "type", label: "Type" },
            { key: "qty", label: "Qty", align: "right" },
            { key: "limitPrice", label: "Limit", align: "right", render: (v) => (v != null ? v : "—") },
            { key: "stopPrice", label: "Stop", align: "right", render: (v) => (v != null ? v : "—") },
            { key: "tif", label: "TIF" },
            { key: "status", label: "Status" },
            { key: "createdAt", label: "Created (AZ)", render: (v) => fmtAz(v) },
            { key: "updatedAt", label: "Updated (AZ)", render: (v) => fmtAz(v) },
          ]}
          rows={orders.data}
        />
      </Section>

      {/* Executions */}
      <Section
        title="Executions (read-only)"
        right={
          <>
            <Pill color="#374151">Updated (AZ): {fmtAz(executions.last)}</Pill>
            {" "}
            <Pill color={executions.available ? "#065f46" : "#7c2d12"}>
              {executions.available ? "Available" : "Not available yet"}
            </Pill>
          </>
        }
      >
        <SimpleTable
          emptyText={executions.available === false ? "Endpoint not available yet." : "No executions."}
          columns={[
            { key: "id", label: "Exec ID" },
            { key: "orderId", label: "Order ID" },
            { key: "symbol", label: "Symbol" },
            { key: "qty", label: "Qty", align: "right" },
            { key: "price", label: "Price", align: "right" },
            { key: "time", label: "Time (AZ)", render: (v) => fmtAz(v) },
          ]}
          rows={executions.data}
        />
      </Section>
    </div>
  );
}
