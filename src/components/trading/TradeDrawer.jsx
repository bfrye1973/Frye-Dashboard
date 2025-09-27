// src/components/trading/TradeDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";

/* --------------------- CRA-safe backend base resolver --------------------- */
function getApiBase() {
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

function Pill({ color = "#374151", children }) {
  return (
    <span
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

/* --------------------------------- Drawer -------------------------------- */
export default function TradeDrawer({ open, onClose, defaultSymbol = "SPY" }) {
  const apiBase = getApiBase();
  const [tab, setTab] = useState("ticket"); // ticket | positions | orders | executions | journal | options
  const [symbol, setSymbol] = useState(defaultSymbol);

  // Read-only datasets (poll light)
  const URLS = useMemo(() => {
    const base = apiBase.replace(/\/+$/, "");
    return {
      positions: `${base}/api/trading/positions`,
      orders: `${base}/api/trading/orders`,
      executions: `${base}/api/trading/executions`,
      optionsMeta: `${base}/api/options/meta?symbol=${encodeURIComponent(symbol)}`,
      // Suggested contract for chain:
      // /api/options/chain?symbol=SPY&expiration=YYYY-MM-DD&side=call|put
      chain: ({ expiration, side }) =>
        `${base}/api/options/chain?symbol=${encodeURIComponent(symbol)}${
          expiration ? `&expiration=${encodeURIComponent(expiration)}` : ""
        }${side ? `&side=${encodeURIComponent(side)}` : ""}`,
    };
  }, [apiBase, symbol]);

  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [executions, setExecutions] = useState([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    async function tick() {
      const [p, o, e] = await Promise.all([
        safeGet(URLS.positions),
        safeGet(URLS.orders),
        safeGet(URLS.executions),
      ]);
      if (!alive) return;
      setPositions(Array.isArray(p.data) ? p.data : []);
      setOrders(Array.isArray(o.data) ? o.data : []);
      setExecutions(Array.isArray(e.data) ? e.data : []);
    }
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [URLS.positions, URLS.orders, URLS.executions, open]);

  /* ---------------------------- Options Chain UI --------------------------- */
  const [expirations, setExpirations] = useState([]);
  const [expiration, setExpiration] = useState("");
  const [side, setSide] = useState("call"); // call | put
  const [chainRows, setChainRows] = useState([]);
  const [chainAvail, setChainAvail] = useState(null);

  useEffect(() => {
    if (!open || tab !== "options") return;
    let alive = true;

    (async () => {
      // meta: expirations list
      const meta = await safeGet(URLS.optionsMeta);
      if (!alive) return;
      const list = Array.isArray(meta.data?.expirations) ? meta.data.expirations : [];
      setExpirations(list);
      if (!expiration && list.length) setExpiration(list[0]);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [URLS.optionsMeta, open, tab]);

  useEffect(() => {
    if (!open || tab !== "options") return;
    let alive = true;

    (async () => {
      const url = URLS.chain({ expiration, side });
      const res = await safeGet(url);
      if (!alive) return;
      if (res.ok && Array.isArray(res.data)) {
        setChainRows(res.data);
        setChainAvail(true);
      } else {
        setChainRows([]);
        setChainAvail(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [URLS, expiration, side, open, tab]);

  /* --------------------------------- UI ----------------------------------- */
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        pointerEvents: "auto",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: 460,
          background: "#0b0f14",
          borderLeft: "1px solid #1f2937",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong style={{ color: "#93c5fd" }}>Trade</strong>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol"
              style={{
                width: 90,
                background: "#0f172a",
                color: "#e5e7eb",
                border: "1px solid #1f2937",
                borderRadius: 8,
                padding: "6px 8px",
                textTransform: "uppercase",
              }}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#111827",
              color: "#e5e7eb",
              border: "1px solid #1f2937",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "8px 10px", borderBottom: "1px solid #1f2937" }}>
          {[
            ["ticket", "Ticket"],
            ["positions", "Positions"],
            ["orders", "Orders"],
            ["executions", "Executions"],
            ["journal", "Journal"],
            ["options", "Options"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                background: tab === key ? "#1f2937" : "#0f172a",
                color: "#e5e7eb",
                border: "1px solid #1f2937",
                borderRadius: 999,
                padding: "6px 10px",
                marginRight: 6,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 12, display: "grid", gap: 12 }}>
          {/* Ticket (read-only UX; submit comes later) */}
          {tab === "ticket" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Paper ticket UI (read-only for now). We’ll wire POST /api/trading/orders next.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Side</label>
                  <select style={selStyle}>
                    <option>BUY</option>
                    <option>SELL</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Qty</label>
                  <input type="number" defaultValue={100} min={1} style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Type</label>
                  <select style={selStyle}>
                    <option>MKT</option>
                    <option>LMT</option>
                    <option>STOP</option>
                    <option>STOP-LMT</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Limit</label>
                  <input type="number" placeholder="—" style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Stop</label>
                  <input type="number" placeholder="—" style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>TIF</label>
                  <select style={selStyle}>
                    <option>DAY</option>
                    <option>GTC</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={primaryBtn} disabled>Review (paper)</button>
                <button style={ghostBtn} onClick={onClose}>Cancel</button>
              </div>
            </div>
          )}

          {tab === "positions" && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <Pill color="#374151">Updated (AZ): {fmtAz(new Date().toISOString())}</Pill>
              </div>
              <SimpleTable
                emptyText={positions.length ? "" : "No positions or endpoint not available yet."}
                columns={[
                  { key: "symbol", label: "Symbol" },
                  { key: "qty", label: "Qty", align: "right" },
                  { key: "avgPrice", label: "Avg", align: "right" },
                  { key: "pnl", label: "Unrealized P/L", align: "right" },
                  { key: "realizedPnl", label: "Realized P/L", align: "right" },
                ]}
                rows={positions}
              />
            </div>
          )}

          {tab === "orders" && (
            <div>
              <SimpleTable
                emptyText={orders.length ? "" : "No orders or endpoint not available yet."}
                columns={[
                  { key: "id", label: "Order ID" },
                  { key: "symbol", label: "Symbol" },
                  { key: "side", label: "Side" },
                  { key: "type", label: "Type" },
                  { key: "qty", label: "Qty", align: "right" },
                  { key: "limitPrice", label: "Limit", align: "right" },
                  { key: "stopPrice", label: "Stop", align: "right" },
                  { key: "tif", label: "TIF" },
                  { key: "status", label: "Status" },
                  { key: "createdAt", label: "Created (AZ)", render: (v) => fmtAz(v) },
                ]}
                rows={orders}
              />
            </div>
          )}

          {tab === "executions" && (
            <div>
              <SimpleTable
                emptyText={executions.length ? "" : "No executions or endpoint not available yet."}
                columns={[
                  { key: "id", label: "Exec ID" },
                  { key: "orderId", label: "Order ID" },
                  { key: "symbol", label: "Symbol" },
                  { key: "qty", label: "Qty", align: "right" },
                  { key: "price", label: "Price", align: "right" },
                  { key: "time", label: "Time (AZ)", render: (v) => fmtAz(v) },
                ]}
                rows={executions}
              />
            </div>
          )}

          {tab === "journal" && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Quick Trading Journal (local text for now; we can wire to backend later).
              </div>
              <textarea
                rows={8}
                placeholder="Why this trade? Plan, risk, entry/exit, emotions…"
                style={{
                  width: "100%",
                  background: "#0f172a",
                  color: "#e5e7eb",
                  border: "1px solid #1f2937",
                  borderRadius: 10,
                  padding: 10,
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={primaryBtn} disabled>Save to Journal (coming next)</button>
                <button style={ghostBtn} onClick={() => setTab("ticket")}>Back to Ticket</button>
              </div>
            </div>
          )}

          {tab === "options" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Options Chain (read-only). Backend should expose:
                <code> /api/options/meta?symbol=SPY </code> → {"{ expirations: [...] }"} and
                <code> /api/options/chain?symbol=SPY&expiration=YYYY-MM-DD&side=call|put </code>
              </div>

              {/* Filters */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Expiration</label>
                  <select value={expiration} onChange={(e) => setExpiration(e.target.value)} style={selStyle}>
                    {expirations.length === 0 && <option value="">(not available yet)</option>}
                    {expirations.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Side</label>
                  <select value={side} onChange={(e) => setSide(e.target.value)} style={selStyle}>
                    <option value="call">Calls</option>
                    <option value="put">Puts</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Strikes (view)</label>
                  <input placeholder="e.g., 5 OTM each side" style={inputStyle} disabled />
                </div>
              </div>

              <SimpleTable
                emptyText={
                  chainAvail === false
                    ? "Options chain endpoint not available yet."
                    : "No rows."
                }
                columns={[
                  { key: "strike", label: "Strike", align: "right" },
                  { key: "mark", label: "Mark", align: "right" },
                  { key: "bid", label: "Bid", align: "right" },
                  { key: "ask", label: "Ask", align: "right" },
                  { key: "delta", label: "Δ", align: "right" },
                  { key: "theta", label: "Θ", align: "right" },
                  { key: "gamma", label: "Γ", align: "right" },
                  { key: "vega", label: "V", align: "right" },
                  { key: "oi", label: "OI", align: "right" },
                  { key: "volume", label: "Vol", align: "right" },
                ]}
                rows={chainRows}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- styles ---------------------------------- */
const inputStyle = {
  width: "100%",
  background: "#0f172a",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: "6px 8px",
};

const selStyle = {
  ...inputStyle,
  appearance: "auto",
};

const primaryBtn = {
  background: "#2563eb",
  color: "#fff",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
};

const ghostBtn = {
  background: "#111827",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};
