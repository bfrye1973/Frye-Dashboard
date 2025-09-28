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
const FONT_BASE = 14; // bumped up from 12/13 for readability

function Pill({ color = "#374151", children, title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        background: color,
        color: "#e5e7eb",
        fontSize: FONT_BASE,
        lineHeight: "20px",
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
                  padding: "10px 12px",
                  fontSize: FONT_BASE,
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
              <td colSpan={columns.length} style={{ padding: 14, color: "#6b7280", fontSize: FONT_BASE }}>
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
                      padding: "10px 12px",
                      textAlign: c.align || "left",
                      fontSize: FONT_BASE + 1,
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

  const [tab, setTab] = useState("ticket"); // ticket | positions | orders | executions | journal | options | risk
  const [symbol, setSymbol] = useState(defaultSymbol);

  // Asset type toggle
  const [assetType, setAssetType] = useState("OPTION"); // OPTION | EQUITY

  // live/paper status (LIVE read-only until backend enables)
  const [status, setStatus] = useState({ mode: "PAPER", liveEnabled: false, connected: false });
  const statusUrl = useMemo(() => `${apiBase.replace(/\/+$/, "")}/api/trading/status`, [apiBase]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const pull = async () => {
      const res = await safeGet(statusUrl);
      if (!alive) return;
      if (res.ok && res.data) {
        setStatus({
          mode: res.data.mode || "PAPER",
          liveEnabled: Boolean(res.data.liveEnabled),
          connected: Boolean(res.data.connected),
        });
      }
    };
    pull();
    const id = setInterval(pull, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [statusUrl, open]);

  /* -------------------------- read-only datasets -------------------------- */
  const URLS = useMemo(() => {
    const base = apiBase.replace(/\/+$/, "");
    return {
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
    const id = setInterval(tick, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [URLS.positions, URLS.orders, URLS.executions, open]);

  /* ------------------------------ Options data ---------------------------- */
  const [expirations, setExpirations] = useState([]);
  const [expiration, setExpiration] = useState("");
  const [optSide, setOptSide] = useState("call"); // call | put
  const [chainRows, setChainRows] = useState([]);
  const [chainAvail, setChainAvail] = useState(null);
  const [strike, setStrike] = useState("");

  const [manualOpt, setManualOpt] = useState(false); // manual fallback

  useEffect(() => {
    if (!open) return;
    if (tab !== "ticket" && tab !== "options") return;
    if (assetType !== "OPTION" || manualOpt) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [URLS.optionsMeta, open, tab, assetType, manualOpt]);

  useEffect(() => {
    if (!open) return;
    if (tab !== "ticket" && tab !== "options") return;
    if (assetType !== "OPTION" || manualOpt) return;
    let alive = true;
    (async () => {
      const res = await safeGet(URLS.chain({ expiration, side: optSide }));
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
  }, [URLS, expiration, optSide, open, tab, assetType, manualOpt]);

  /* ------------------------------- Risk tab ------------------------------- */
  const [risk, setRisk] = useState({ killSwitch: false, caps: null, last: null });
  useEffect(() => {
    if (!open || tab !== "risk") return;
    let alive = true;
    (async () => {
      const r = await safeGet(URLS.riskStatus);
      if (!alive) return;
      setRisk({
        killSwitch: Boolean(r.data?.killSwitch),
        caps: r.data?.caps || null,
        last: new Date().toISOString(),
      });
    })();
    const id = setInterval(async () => {
      const r = await safeGet(URLS.riskStatus);
      if (!alive) return;
      setRisk({
        killSwitch: Boolean(r.data?.killSwitch),
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
        killSwitch: Boolean(r.data?.killSwitch),
        caps: r.data?.caps || null,
        last: new Date().toISOString(),
      });
    } else {
      alert("Kill Switch failed or endpoint not available.");
    }
  }

  /* ------------------------------ Ticket state ---------------------------- */
  // Shared
  const [sideIn, setSideIn] = useState("BUY");
  const [tif, setTif] = useState("DAY");
  const [type, setType] = useState("MKT"); // MKT|LMT|STOP|STOP-LMT
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");

  // Equity
  const [equityQty, setEquityQty] = useState(100);

  // Option
  const [contracts, setContracts] = useState(1); // contracts
  const [right, setRight] = useState("CALL"); // CALL|PUT (sync with optSide)
  useEffect(() => setRight(optSide?.toUpperCase() === "PUT" ? "PUT" : "CALL"), [optSide]);

  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastNote, setLastNote] = useState(null);

  const liveBlocked = status.mode === "LIVE" && !status.liveEnabled;

  function validateTicket() {
    const errors = [];
    if (assetType === "EQUITY") {
      if (!symbol || !/^[A-Z0-9\.\-:]+$/i.test(symbol)) errors.push("Symbol looks invalid.");
      if (!Number.isFinite(Number(equityQty)) || Number(equityQty) < 1) errors.push("Share quantity must be ≥ 1.");
      if (type === "LMT" && numberOrNull(limitPrice) == null) errors.push("Limit price required for LMT.");
      if ((type === "STOP" || type === "STOP-LMT") && numberOrNull(stopPrice) == null)
        errors.push("Stop price required for STOP/STOP-LMT.");
    } else {
      if (!symbol || !/^[A-Z0-9\.\-:]+$/i.test(symbol)) errors.push("Underlying looks invalid.");
      if (!manualOpt && !expiration) errors.push("Choose an expiration.");
      if (manualOpt && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) errors.push("Expiration must be YYYY-MM-DD.");
      if (!Number.isFinite(Number(contracts)) || Number(contracts) < 1) errors.push("Contracts must be ≥ 1.");
      if (!Number.isFinite(Number(strike))) errors.push("Choose a strike.");
      if (type === "LMT" && numberOrNull(limitPrice) == null) errors.push("Limit price required for LMT.");
      if ((type === "STOP" || type === "STOP-LMT") && numberOrNull(stopPrice) == null)
        errors.push("Stop price required for STOP/STOP-LMT.");
    }
    if (liveBlocked) errors.push("Live trading is read-only. Paper only.");
    return errors;
  }

  async function submitTicket() {
    const errors = validateTicket();
    if (errors.length) {
      alert("Please fix:\n• " + errors.join("\n• "));
      return;
    }
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
        symbol: String(symbol).toUpperCase(),
        side: sideIn, // BUY|SELL
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
        underlying: String(symbol).toUpperCase(),
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
      alert(
        `Order submit failed (${res.status || "network"}). ` +
          (res.data?.message || "Endpoint not available yet.")
      );
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

  /* ------------ open full chart (new tab), keep current symbol ------------- */
  function openFullChart() {
    const to = `/chart?symbol=${encodeURIComponent(symbol)}`;
    const base = (typeof window !== "undefined" && window.location?.origin) || "";
    window.open(base + to, "_blank", "noopener,noreferrer");
  }

  /* --------------------------------- UI ----------------------------------- */
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, fontSize: FONT_BASE }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />

      {/* Panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: 560, // wider
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
            padding: "12px 14px",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#93c5fd", fontWeight: 800, fontSize: FONT_BASE + 2 }}>Trade</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol"
              style={{
                width: 110,
                background: "#0f172a",
                color: "#e5e7eb",
                border: "1px solid #1f2937",
                borderRadius: 10,
                padding: "8px 10px",
                textTransform: "uppercase",
                fontSize: FONT_BASE,
              }}
            />
            <Pill color={status.mode === "PAPER" ? "#065f46" : "#7c2d12"}>
              {status.mode} {status.mode === "LIVE" && !status.liveEnabled ? "(read-only)" : ""}
            </Pill>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={openFullChart}
              style={{
                background: "#1f2937",
                color: "#e5e7eb",
                border: "1px solid #374151",
                borderRadius: 10,
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: FONT_BASE,
              }}
              title="Open Full Chart in a new tab"
            >
              Open Full Chart ⤴
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#111827",
                color: "#e5e7eb",
                border: "1px solid #374151",
                borderRadius: 10,
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: FONT_BASE,
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Tabs — centered & larger */}
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {[
            ["ticket", "Ticket"],
            ["positions", "Positions"],
            ["orders", "Orders"],
            ["executions", "Executions"],
            ["journal", "Journal"],
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
                padding: "8px 14px",
                cursor: "pointer",
                fontSize: FONT_BASE + 1,
                fontWeight: tab === key ? 800 : 600,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 14, display: "grid", gap: 12 }}>
          {/* Ticket */}
          {tab === "ticket" && (
            <div style={{ display: "grid", gap: 12, fontSize: FONT_BASE }}>
              {lastNote && (
                <div style={{ color: "#a7f3d0", background: "#064e3b", borderRadius: 10, padding: "8px 10px" }}>
                  {lastNote}
                </div>
              )}

              {/* Asset Type Toggle */}
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{ color: "#93c5fd", fontSize: FONT_BASE, paddingTop: 2 }}>Asset:</label>
                <button
                  onClick={() => setAssetType("OPTION")}
                  style={assetType === "OPTION" ? chipOn : chipOff}
                >
                  Option
                </button>
                <button
                  onClick={() => setAssetType("EQUITY")}
                  style={assetType === "EQUITY" ? chipOn : chipOff}
                >
                  Equity
                </button>
              </div>

              {/* OPTION MODE */}
              {assetType === "OPTION" && (
                <>
                  {/* Manual toggle */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      id="manualOpt"
                      type="checkbox"
                      checked={manualOpt}
                      onChange={(e) => setManualOpt(e.target.checked)}
                    />
                    <label htmlFor="manualOpt" style={{ color: "#9ca3af", fontSize: FONT_BASE }}>
                      Manual expiration/strike (use if the options endpoints aren’t live)
                    </label>
                  </div>

                  {/* Filters / Inputs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Expiration</label>
                      {manualOpt ? (
                        <input
                          placeholder="YYYY-MM-DD"
                          value={expiration}
                          onChange={(e) => setExpiration(e.target.value)}
                          style={inputStyle}
                        />
                      ) : (
                        <select
                          value={expiration}
                          onChange={(e) => setExpiration(e.target.value)}
                          style={selStyle}
                        >
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
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Right</label>
                      <select value={optSide} onChange={(e) => setOptSide(e.target.value)} style={selStyle}>
                        <option value="call">CALL</option>
                        <option value="put">PUT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Strike</label>
                      <input
                        type="number"
                        value={strike}
                        onChange={(e) => setStrike(e.target.value)}
                        placeholder="e.g., 500"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Contracts</label>
                      <input
                        type="number"
                        value={contracts}
                        min={1}
                        onChange={(e) => setContracts(Number(e.target.value))}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Order controls */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Side</label>
                      <select value={sideIn} onChange={(e) => setSideIn(e.target.value)} style={selStyle}>
                        <option>BUY</option>
                        <option>SELL</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Type</label>
                      <select value={type} onChange={(e) => setType(e.target.value)} style={selStyle}>
                        <option>MKT</option>
                        <option>LMT</option>
                        <option>STOP</option>
                        <option>STOP-LMT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Limit</label>
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder="—"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Stop</label>
                      <input
                        type="number"
                        value={stopPrice}
                        onChange={(e) => setStopPrice(e.target.value)}
                        placeholder="—"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>TIF</label>
                      <select value={tif} onChange={(e) => setTif(e.target.value)} style={selStyle}>
                        <option>DAY</option>
                        <option>GTC</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* EQUITY MODE */}
              {assetType === "EQUITY" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Side</label>
                      <select value={sideIn} onChange={(e) => setSideIn(e.target.value)} style={selStyle}>
                        <option>BUY</option>
                        <option>SELL</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Shares</label>
                      <input
                        type="number"
                        value={equityQty}
                        min={1}
                        onChange={(e) => setEquityQty(Number(e.target.value))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Type</label>
                      <select value={type} onChange={(e) => setType(e.target.value)} style={selStyle}>
                        <option>MKT</option>
                        <option>LMT</option>
                        <option>STOP</option>
                        <option>STOP-LMT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Limit</label>
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder="—"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Stop</label>
                      <input
                        type="number"
                        value={stopPrice}
                        onChange={(e) => setStopPrice(e.target.value)}
                        placeholder="—"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>TIF</label>
                      <select value={tif} onChange={(e) => setTif(e.target.value)} style={selStyle}>
                        <option>DAY</option>
                        <option>GTC</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button style={primaryBtn} onClick={submitTicket} disabled={busy || liveBlocked}>
                  Review (paper)
                </button>
                <button style={ghostBtn} onClick={onClose}>Cancel</button>
              </div>

              {liveBlocked && (
                <div style={{ color: "#fca5a5", background: "#7f1d1d", borderRadius: 10, padding: "8px 10px" }}>
                  Live mode is read-only. Backend must enable live before submitting.
                </div>
              )}

              {/* Review panel */}
              {review && (
                <div style={{ border: "1px solid #1f2937", borderRadius: 12, padding: 12, background: "#111827" }}>
                  <div style={{ color: "#e5e7eb", marginBottom: 8, fontWeight: 700, fontSize: FONT_BASE + 1 }}>
                    Confirm Paper Order
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: FONT_BASE, marginBottom: 8 }}>
                    {assetType === "EQUITY" ? (
                      <>
                        {sideIn} {equityQty} {String(symbol).toUpperCase()} • {type}
                        {type === "LMT" && ` @ ${limitPrice}`} {type === "STOP" && ` stop ${stopPrice}`}
                        {type === "STOP-LMT" && ` stop ${stopPrice} / limit ${limitPrice}`} • {tif}
                      </>
                    ) : (
                      <>
                        {sideIn} {contracts}x {right} {String(symbol).toUpperCase()} {strike} {expiration} • {type}
                        {type === "LMT" && ` @ ${limitPrice}`} {type === "STOP" && ` stop ${stopPrice}`}
                        {type === "STOP-LMT" && ` stop ${stopPrice} / limit ${limitPrice}`} • {tif}
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={primaryBtn} onClick={confirmSubmit} disabled={busy}>
                      {busy ? "Submitting…" : "Confirm"}
                    </button>
                    <button style={ghostBtn} onClick={() => setReview(false)}>Back</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Positions */}
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
                        <button style={ghostBtn} onClick={() => cancelOrder(row.id)}>Cancel</button>
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

          {/* Journal (placeholder) */}
          {tab === "journal" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: "#9ca3af", fontSize: FONT_BASE }}>
                Quick Trading Journal (local text for now; backend wiring next).
              </div>
              <textarea
                rows={8}
                placeholder="Why this trade? Plan, risk, entry/exit, emotions…"
                style={{
                  width: "100%",
                  background: "#0f172a",
                  color: "#e5e7eb",
                  border: "1px solid #1f2937",
                  borderRadius: 12,
                  padding: 12,
                  fontSize: FONT_BASE,
                }}
              />
            </div>
          )}

          {/* Options (read-only chain viewer) */}
          {tab === "options" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "#9ca3af", fontSize: FONT_BASE }}>
                Options Chain (read-only). Backend should expose:
                <code> /api/options/meta?symbol=SPY </code> → {"{ expirations: [...] }"} and
                <code> /api/options/chain?symbol=SPY&expiration=YYYY-MM-DD&side=call|put </code>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Expiration</label>
                  <select value={expiration} onChange={(e) => setExpiration(e.target.value)} style={selStyle}>
                    {expirations.length === 0 && <option value="">(not available yet)</option>}
                    {expirations.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Side</label>
                  <select value={optSide} onChange={(e) => setOptSide(e.target.value)} style={selStyle}>
                    <option value="call">Calls</option>
                    <option value="put">Puts</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: FONT_BASE }}>Strikes (view)</label>
                  <input placeholder="e.g., 5 OTM each side" style={inputStyle} disabled />
                </div>
              </div>
              <SimpleTable
                emptyText={chainAvail === false ? "Options chain endpoint not available yet." : "No rows."}
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

          {/* Risk */}
          {tab === "risk" && (
            <div style={{ display: "grid", gap: 12 }}>
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
              <div style={{ display: "flex", gap: 10 }}>
                <button style={dangerBtn} onClick={handleKillSwitch}>Engage Kill Switch</button>
                <button style={ghostBtn} onClick={() => setTab("ticket")}>Back to Ticket</button>
              </div>
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
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: FONT_BASE,
};
const selStyle = { ...inputStyle, appearance: "auto" };
const primaryBtn = {
  background: "#2563eb",
  color: "#fff",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: FONT_BASE,
};
const ghostBtn = {
  background: "#111827",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontSize: FONT_BASE,
};
const dangerBtn = {
  background: "#b91c1c",
  color: "#fff",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: FONT_BASE,
};
const chipOn = {
  background: "#1f2937",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 999,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: FONT_BASE,
  fontWeight: 800,
};
const chipOff = {
  ...chipOn,
  background: "#0f172a",
  opacity: 0.95,
  fontWeight: 600,
};
