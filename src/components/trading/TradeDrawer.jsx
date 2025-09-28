// src/components/trading/TradeDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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

/* ------------------------------- net utils -------------------------------- */
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
async function safePost(url, body, headers = {}) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e?.message || "Network error" };
  }
}
async function safeDelete(url) {
  try {
    const res = await fetch(url, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e?.message || "Network error" };
  }
}

/* ------------------------------- helpers ---------------------------------- */
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function numberOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------ small UI bits ----------------------------- */
const FONT = 13;

function Pill({ color = "#374151", children }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: color,
        color: "#e5e7eb",
        fontSize: FONT,
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
                  fontSize: FONT,
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
              <td colSpan={columns.length} style={{ padding: 10, color: "#6b7280", fontSize: FONT }}>
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
                      fontSize: FONT + 1,
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

  const [tab, setTab] = useState("ticket"); // ticket | positions | orders | executions | options | risk
  const [symbol, setSymbol] = useState(defaultSymbol);

  // Asset type
  const [assetType, setAssetType] = useState("OPTION"); // OPTION | EQUITY

  // status (LIVE stays read-only)
  const [status, setStatus] = useState({ mode: "PAPER", liveEnabled: false, connected: false });

  const URLS = useMemo(() => {
    const base = apiBase.replace(/\/+$/, "");
    return {
      status: `${base}/api/trading/status`,
      positions: `${base}/api/trading/positions`,
      orders: `${base}/api/trading/orders`,
      executions: `${base}/api/trading/executions`,
      // options
      optionsMeta: `${base}/api/options/meta?symbol=${encodeURIComponent(symbol)}`,
      chain: ({ expiration, side }) =>
        `${base}/api/options/chain?symbol=${encodeURIComponent(symbol)}${
          expiration ? `&expiration=${encodeURIComponent(expiration)}` : ""
        }${side ? `&side=${encodeURIComponent(side)}` : ""}`,
      // risk
      riskStatus: `${base}/api/risk/status`,
      riskKill: `${base}/api/risk/kill`,
      // place/cancel
      placeOrder: `${base}/api/trading/orders`,
      cancelOrder: (id) => `${base}/api/trading/orders/${encodeURIComponent(id)}`,
    };
  }, [apiBase, symbol]);

  /* --------------------------- status + polling --------------------------- */
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [executions, setExecutions] = useState([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    const tick = async () => {
      const s = await safeGet(URLS.status);
      if (alive && s.ok && s.data) {
        setStatus({
          mode: s.data.mode || "PAPER",
          liveEnabled: !!s.data.liveEnabled,
          connected: !!s.data.connected,
        });
      }
      const [p, o, e] = await Promise.all([
        safeGet(URLS.positions),
        safeGet(URLS.orders),
        safeGet(URLS.executions),
      ]);
      if (!alive) return;
      setPositions(Array.isArray(p.data) ? p.data : []);
      setOrders(Array.isArray(o.data) ? o.data : []);
      setExecutions(Array.isArray(e.data) ? e.data : []);
    };

    tick();
    const id = setInterval(tick, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [URLS.status, URLS.positions, URLS.orders, URLS.executions, open]);

  /* ------------------------------ Options data ---------------------------- */
  const [expirations, setExpirations] = useState([]);
  const [expiration, setExpiration] = useState("");
  const [optSide, setOptSide] = useState("call"); // call | put
  const [strike, setStrike] = useState("");
  const [manualOpt, setManualOpt] = useState(false);

  useEffect(() => {
    if (!open || tab !== "ticket" || assetType !== "OPTION" || manualOpt) return;
    let alive = true;
    (async () => {
      const meta = await safeGet(URLS.optionsMeta);
      if (!alive) return;
      const list = Array.isArray(meta.data?.expirations) ? meta.data.expirations : [];
      setExpirations(list);
      if (!expiration && list.length) setExpiration(list[0]);
    })();
    return () => {
      alive = false;
    };
  }, [URLS.optionsMeta, open, tab, assetType, manualOpt, expiration]);

  /* --------------------------------- Risk --------------------------------- */
  const [risk, setRisk] = useState({ killSwitch: false, caps: null, last: null });

  useEffect(() => {
    if (!open || tab !== "risk") return;
    let alive = true;
    (async () => {
      const r = await safeGet(URLS.riskStatus);
      if (!alive) return;
      setRisk({
        killSwitch: !!r.data?.killSwitch,
        caps: r.data?.caps || null,
        last: new Date().toISOString(),
      });
    })();
    const id = setInterval(async () => {
      const r = await safeGet(URLS.riskStatus);
      if (!alive) return;
      setRisk({
        killSwitch: !!r.data?.killSwitch,
        caps: r.data?.caps || null,
        last: new Date().toISOString(),
      });
    }, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [URLS.riskStatus, tab, open]);

  async function handleKillSwitch() {
    const ok = window.confirm("Kill Switch: cancel all working orders and block new ones?");
    if (!ok) return;
    const res = await safePost(URLS.riskKill, {});
    if (res.ok) {
      alert("Kill Switch engaged.");
      const o = await safeGet(URLS.orders);
      setOrders(Array.isArray(o.data) ? o.data : []);
      const r = await safeGet(URLS.riskStatus);
      setRisk({
        killSwitch: !!r.data?.killSwitch,
        caps: r.data?.caps || null,
        last: new Date().toISOString(),
      });
    } else {
      alert("Kill Switch failed or endpoint not available.");
    }
  }

  /* ------------------------------ Ticket state ---------------------------- */
  const [sideIn, setSideIn] = useState("BUY");
  const [tif, setTif] = useState("DAY");
  const [type, setType] = useState("MKT"); // MKT|LMT|STOP|STOP-LMT
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");

  // equity
  const [equityQty, setEquityQty] = useState(100);

  // option
  const [contracts, setContracts] = useState(1);
  const right = optSide.toUpperCase() === "PUT" ? "PUT" : "CALL";

  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastNote, setLastNote] = useState(null);

  const liveBlocked = status.mode === "LIVE" && !status.liveEnabled;

  function validateTicket() {
    const errors = [];
    if (assetType === "EQUITY") {
      if (!symbol || !/^[A-Z0-9\.\-:]+$/i.test(symbol)) errors.push("Symbol looks invalid.");
      if (!(+equityQty >= 1)) errors.push("Share quantity must be ≥ 1.");
      if (type === "LMT" && numberOrNull(limitPrice) == null) errors.push("Limit required for LMT.");
      if ((type === "STOP" || type === "STOP-LMT") && numberOrNull(stopPrice) == null)
        errors.push("Stop required for STOP/STOP-LMT.");
    } else {
      if (!symbol || !/^[A-Z0-9\.\-:]+$/i.test(symbol)) errors.push("Underlying looks invalid.");
      if (!manualOpt && !expiration) errors.push("Choose expiration.");
      if (manualOpt && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) errors.push("Expiration must be YYYY-MM-DD.");
      if (!(+contracts >= 1)) errors.push("Contracts must be ≥ 1.");
      if (!Number.isFinite(+strike)) errors.push("Choose strike.");
      if (type === "LMT" && numberOrNull(limitPrice) == null) errors.push("Limit required for LMT.");
      if ((type === "STOP" || type === "STOP-LMT") && numberOrNull(stopPrice) == null)
        errors.push("Stop required for STOP/STOP-LMT.");
    }
    if (liveBlocked) errors.push("Live trading is read-only. Paper only.");
    return errors;
  }

  function submitTicket() {
    const errors = validateTicket();
    if (errors.length) return alert("Please fix:\n• " + errors.join("\n• "));
    setReview(true);
  }

  async function confirmSubmit() {
    setBusy(true);
    const idem = uuidv4();
    let payload;

    if (assetType === "EQUITY") {
      payload = {
        mode: "PAPER",
        assetType: "EQUITY",
        symbol: symbol.toUpperCase(),
        side: sideIn,
        qty: Number(equityQty),
        orderType: type,
        limitPrice: numberOrNull(limitPrice),
        stopPrice: numberOrNull(stopPrice),
        tif,
        source: "dashboard",
      };
    } else {
      payload = {
        mode: "PAPER",
        assetType: "OPTION",
        underlying: symbol.toUpperCase(),
        right,
        expiration,
        strike: Number(strike),
        multiplier: 100,
        qty: Number(contracts),
        orderType: type,
        limitPrice: numberOrNull(limitPrice),
        stopPrice: numberOrNull(stopPrice),
        tif,
        source: "dashboard",
      };
    }

    const res = await safePost(URLS.placeOrder, payload, { "X-Idempotency-Key": idem });
    setBusy(false);
    setReview(false);

    if (res.ok) {
      setLastNote(
        assetType === "EQUITY"
          ? `Submitted: ${payload.side} ${payload.qty} ${payload.symbol} (${payload.orderType})`
          : `Submitted: ${payload.qty}x ${payload.right} ${payload.underlying} ${payload.strike} ${payload.expiration} (${payload.orderType})`
      );
      setTab("orders");
      const o = await safeGet(URLS.orders);
      setOrders(Array.isArray(o.data) ? o.data : []);
    } else {
      alert(`Order submit failed (${res.status || "network"}). ${res.data?.message || ""}`);
    }
  }

  async function cancelOrder(id) {
    if (!id) return;
    const ok = window.confirm(`Cancel order ${id}?`);
    if (!ok) return;
    const res = await safeDelete(URLS.cancelOrder(id));
    if (res.ok) {
      const o = await safeGet(URLS.orders);
      setOrders(Array.isArray(o.data) ? o.data : []);
    } else {
      alert("Cancel failed or endpoint not available.");
    }
  }

  /* --------------------------------- UI ----------------------------------- */
  if (!open) return null;

  const drawer = (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, fontSize: FONT }}>
      {/* Backdrop (no document/body side-effects) */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />

      {/* Panel — fixed, out of flow, won’t affect grid/rows */}
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
        }}
      >
        {/* Header (minimal) */}
        <div
          style={{
            padding: "8px 10px",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#e5e7eb",
          }}
        >
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
          <Pill color={status.mode === "PAPER" ? "#065f46" : "#7c2d12"}>
            {status.mode} {status.mode === "LIVE" && !status.liveEnabled ? "(read-only)" : ""}
          </Pill>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "#111827",
              color: "#e5e7eb",
              border: "1px solid #374151",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {/* Tabs — simple, no centering tricks */}
        <div
          style={{
            padding: "6px 8px",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {[
            ["ticket", "Ticket"],
            ["positions", "Positions"],
            ["orders", "Orders"],
            ["executions", "Executions"],
            ["options", "Options"],
            ["risk", "Risk"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                background: tab === key ? "#1f2937" : "#0f172a",
                color: "#e5e7eb",
                border: "1px solid #374151",
                borderRadius: 999,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: FONT,
                fontWeight: tab === key ? 700 : 600,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 10, display: "grid", gap: 10 }}>
          {/* Ticket */}
          {tab === "ticket" && (
            <div style={{ display: "grid", gap: 8 }}>
              {lastNote && (
                <div style={{ color: "#a7f3d0", background: "#064e3b", borderRadius: 8, padding: "6px 8px" }}>
                  {lastNote}
                </div>
              )}

              {/* Asset toggle */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#9ca3af" }}>Asset:</span>
                <button
                  onClick={() => setAssetType("OPTION")}
                  style={{
                    background: assetType === "OPTION" ? "#1f2937" : "#0f172a",
                    color: "#e5e7eb",
                    border: "1px solid #374151",
                    borderRadius: 999,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  Option
                </button>
                <button
                  onClick={() => setAssetType("EQUITY")}
                  style={{
                    background: assetType === "EQUITY" ? "#1f2937" : "#0f172a",
                    color: "#e5e7eb",
                    border: "1px solid #374151",
                    borderRadius: 999,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  Equity
                </button>
              </div>

              {/* OPTION MODE */}
              {assetType === "OPTION" && (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      id="manualOpt"
                      type="checkbox"
                      checked={manualOpt}
                      onChange={(e) => setManualOpt(e.target.checked)}
                    />
                    <label htmlFor="manualOpt" style={{ color: "#9ca3af" }}>
                      Manual expiration/strike (use if endpoints aren’t live)
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>Expiration</div>
                      {manualOpt ? (
                        <input
                          placeholder="YYYY-MM-DD"
                          value={expiration}
                          onChange={(e) => setExpiration(e.target.value)}
                          style={inputStyle}
                        />
                      ) : (
                        <select value={expiration} onChange={(e) => setExpiration(e.target.value)} style={inputStyle}>
                          {expirations.length === 0 && <option value="">(not available yet)</option>}
                          {expirations.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>Right</div>
                      <select value={optSide} onChange={(e) => setOptSide(e.target.value)} style={inputStyle}>
                        <option value="call">CALL</option>
                        <option value="put">PUT</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>Strike</div>
                      <input
                        type="number"
                        value={strike}
                        onChange={(e) => setStrike(e.target.value)}
                        placeholder="e.g., 500"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>Contracts</div>
                      <input
                        type="number"
                        value={contracts}
                        min={1}
                        onChange={(e) => setContracts(Number(e.target.value))}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>Side</div>
                      <select value={sideIn} onChange={(e) => setSideIn(e.target.value)} style={inputStyle}>
                        <option>BUY</option>
                        <option>SELL</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>Type</div>
                      <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
                        <option>MKT</option>
                        <option>LMT</option>
                        <option>STOP</option>
                        <option>STOP-LMT</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>Limit</div>
                      <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>Stop</div>
                      <input value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ color: "#93c5fd", fontSize: FONT }}>TIF</div>
                      <select value={tif} onChange={(e) => setTif(e.target.value)} style={inputStyle}>
                        <option>DAY</option>
                        <option>GTC</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* EQUITY MODE */}
              {assetType === "EQUITY" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  <div>
                    <div style={{ color: "#93c5fd", fontSize: FONT }}>Side</div>
                    <select value={sideIn} onChange={(e) => setSideIn(e.target.value)} style={inputStyle}>
                      <option>BUY</option>
                      <option>SELL</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ color: "#93c5fd", fontSize: FONT }}>Shares</div>
                    <input
                      type="number"
                      value={equityQty}
                      min={1}
                      onChange={(e) => setEquityQty(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={{ color: "#93c5fd", fontSize: FONT }}>Type</div>
                    <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
                      <option>MKT</option>
                      <option>LMT</option>
                      <option>STOP</option>
                      <option>STOP-LMT</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ color: "#93c5fd", fontSize: FONT }}>Limit</div>
                    <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ color: "#93c5fd", fontSize: FONT }}>Stop</div>
                    <input value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={submitTicket}
                  disabled={busy || liveBlocked}
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Review (paper)
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: "#111827",
                    color: "#e5e7eb",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>

              {/* Review */}
              {review && (
                <div style={{ border: "1px solid #1f2937", borderRadius: 8, padding: 10, background: "#111827" }}>
                  <div style={{ color: "#e5e7eb", marginBottom: 6, fontWeight: 700 }}>Confirm Paper Order</div>
                  <div style={{ color: "#9ca3af", fontSize: FONT, marginBottom: 8 }}>
                    {assetType === "EQUITY" ? (
                      <>
                        {sideIn} {equityQty} {symbol.toUpperCase()} • {type}
                        {type === "LMT" && ` @ ${limitPrice}`} {type === "STOP" && ` stop ${stopPrice}`}
                        {type === "STOP-LMT" && ` stop ${stopPrice} / limit ${limitPrice}`} • {tif}
                      </>
                    ) : (
                      <>
                        {sideIn} {contracts}x {right} {symbol.toUpperCase()} {strike} {expiration} • {type}
                        {type === "LMT" && ` @ ${limitPrice}`} {type === "STOP" && ` stop ${stopPrice}`}
                        {type === "STOP-LMT" && ` stop ${stopPrice} / limit ${limitPrice}`} • {tif}
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={confirmSubmit}
                      disabled={busy}
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        border: "1px solid #1f2937",
                        borderRadius: 8,
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {busy ? "Submitting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setReview(false)}
                      style={{
                        background: "#111827",
                        color: "#e5e7eb",
                        border: "1px solid #1f2937",
                        borderRadius: 8,
                        padding: "8px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Positions */}
          {tab === "positions" && (
            <div>
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

          {/* Orders */}
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
                  {
                    key: "action",
                    label: "Action",
                    render: (_, row) =>
                      row.status && /NEW|WORKING|OPEN|PENDING/i.test(row.status) ? (
                        <button
                          onClick={() => cancelOrder(row.id)}
                          style={{
                            background: "#111827",
                            color: "#e5e7eb",
                            border: "1px solid #1f2937",
                            borderRadius: 8,
                            padding: "4px 8px",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      ) : (
                        "—"
                      ),
                  },
                  { key: "createdAt", label: "Created (AZ)", render: (v) => fmtAz(v) },
                ]}
                rows={orders.map((o) => ({ ...o, action: "" }))}
              />
            </div>
          )}

          {/* Executions */}
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

          {/* Options (read-only, optional) */}
          {tab === "options" && (
            <div style={{ color: "#9ca3af", fontSize: FONT }}>Use the Ticket tab to select & send options orders.</div>
          )}

          {/* Risk */}
          {tab === "risk" && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Pill color={risk.killSwitch ? "#7c2d12" : "#065f46"}>
                  Kill Switch: {risk.killSwitch ? "ON (trading blocked)" : "OFF"}
                </Pill>
                {risk.caps && (
                  <Pill color="#374151">
                    Caps: {Object.entries(risk.caps).map(([k, v]) => `${k}=${v}`).join(" • ")}
                  </Pill>
                )}
                <Pill color="#374151">Updated (AZ): {fmtAz(risk.last)}</Pill>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleKillSwitch}
                  style={{
                    background: "#b91c1c",
                    color: "#fff",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Engage Kill Switch
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render OUTSIDE the dashboard/grid so it can't affect chart height/layout
  return createPortal(drawer, document.body);
}

/* ------------------------------- styles ---------------------------------- */
const inputStyle = {
  width: "100%",
  background: "#0f172a",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 13,
};
