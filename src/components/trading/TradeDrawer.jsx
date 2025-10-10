// src/components/trading/TradeDrawer.jsx
// Safe Paper-Trading Drawer (Options on Core, Paper on Streamer)
// - Core (Backend-1):  /api/options/meta  |  /api/options/chain
// - Streamer (Backend-2):  /paper/status (SSE), /paper/execute, /paper/positions, /paper/orders
//
// Notes:
// * Adds a small "Exec Price" field used when sending MKT orders (paper API requires a price).
// * Positions/Orders tabs now display the live snapshot from /paper/status (read-only).
// * We leave your old REST polling in place for executions/risk, but paper positions/orders come from the stream.

import React, { useEffect, useMemo, useState } from "react";
import usePaperStatus from "../../hooks/usePaperStatus";

/* --------------------- Core & Streamer base resolvers --------------------- */
function getCoreBase() {
  // Backend-1 (Core)
  const DEFAULT = "https://frye-market-backend-1.onrender.com";
  return DEFAULT;
}
function getStreamBase() {
  // Backend-2 (Streamer)
  const env =
    (typeof process !== "undefined" &&
      process.env &&
      (process.env.REACT_APP_STREAM_BASE || process.env.VITE_STREAM_BASE)) ||
    (typeof window !== "undefined" && window.__STREAM_BASE__) ||
    "https://frye-market-backend-2.onrender.com";
  return env.replace(/\/+$/, "");
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
  const coreBase = getCoreBase();              // Backend-1 (Core)
  const streamBase = getStreamBase();          // Backend-2 (Streamer)

  const [tab, setTab] = useState("ticket");    // ticket | positions | orders | executions | journal | options | risk
  const [symbol, setSymbol] = useState(defaultSymbol);

  // Asset type toggle
  const [assetType, setAssetType] = useState("OPTION"); // OPTION | EQUITY

  // LIVE/PAPER status from Core (unchanged, read-only)
  const [status, setStatus] = useState({ mode: "PAPER", liveEnabled: false, connected: false });
  const statusUrl = useMemo(() => `${coreBase.replace(/\/+$/, "")}/api/trading/status`, [coreBase]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const res = await safeGet(statusUrl);
      if (!alive) return;
      if (res.ok && res.data) {
        setStatus({
          mode: res.data.mode || "PAPER",
          liveEnabled: Boolean(res.data.liveEnabled),
          connected: Boolean(res.data.connected),
        });
      }
    })();
    const id = setInterval(async () => {
      const res = await safeGet(statusUrl);
      if (!alive) return;
      if (res.ok && res.data) {
        setStatus({
          mode: res.data.mode || "PAPER",
          liveEnabled: Boolean(res.data.liveEnabled),
          connected: Boolean(res.data.connected),
        });
      }
    }, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [statusUrl, open]);

  /* -------------------------- URLs (Core + Streamer) ----------------------- */
  const URLS = useMemo(() => {
    const core = coreBase.replace(/\/+$/, "");
    const stream = streamBase.replace(/\/+$/, "");
    return {
      // Core (options)
      optionsMeta: `${core}/api/options/meta?symbol=${encodeURIComponent(symbol)}`,
      chain: ({ expiration, side }) =>
        `${core}/api/options/chain?symbol=${encodeURIComponent(symbol)}${
          expiration ? `&expiration=${encodeURIComponent(expiration)}` : ""
        }${side ? `&side=${encodeURIComponent(side)}` : ""}`,
      // Paper (Streamer)
      paperExecute: `${stream}/paper/execute`,
      paperPositions: `${stream}/paper/positions`,
      paperOrders: `${stream}/paper/orders`,
      // Risk/kill remains on Core (if you want to keep it)
      riskStatus: `${core}/api/risk/status`,
      riskKill: `${core}/api/risk/kill`,
      // (Old core trading endpoints kept for reference; no longer used for paper)
    };
  }, [coreBase, streamBase, symbol]);

  /* -------------------- Paper stream (live positions/orders) ---------------- */
  const {
    connected: paperConnected,
    error: paperError,
    snapshot: paperSnap,
  } = usePaperStatus();
  // paperSnap: { ts, positions: {SYM: {qty, avgPrice, last, realizedPnL, unrealizedPnL, updated}}, orders: [...] }

  /* ------------------------------ Options data ---------------------------- */
  const [expirations, setExpirations] = useState([]);
  const [expiration, setExpiration] = useState("");
  const [optSide, setOptSide] = useState("call"); // call | put
  const [chainRows, setChainRows] = useState([]);
  const [chainAvail, setChainAvail] = useState(null);
  const [strike, setStrike] = useState("");

  // manual fallback for options fields (when options endpoints not live)
  const [manualOpt, setManualOpt] = useState(false);

  // Load expirations (Core) when visible
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

  // Load chain (Core) when visible
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

  /* ----------------------------------- Risk -------------------------------- */
  const [risk, setRisk] = useState({ killSwitch: false, caps: null, last: null });
  useEffect(() => {
    if (!open || tab !== "risk") return;
    let alive = true;
    (async () => {
      const r = await safeGet(URLS.riskStatus);
      if (!alive) return;
      setRisk({ killSwitch: Boolean(r.data?.killSwitch), caps: r.data?.caps || null, last: new Date().toISOString() });
    })();
  }, [URLS.riskStatus, tab, open]);

  async function handleKillSwitch() {
    const ok = window.confirm("Kill Switch: cancel all working orders and block new ones?");
    if (!ok) return;
    const res = await safePost(URLS.riskKill, {});
    if (res.ok) {
      alert("Kill Switch engaged.");
      // No-op for paper stream; left here in case you keep Core risk.
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
  // NEW: Exec price (used when sending MKT orders to paper API)
  const [execPrice, setExecPrice] = useState("");

  // Equity
  const [equityQty, setEquityQty] = useState(100);

  // Option
  const [contracts, setContracts] = useState(1);
  const [right, setRight] = useState("CALL");
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
    } else {
      if (!symbol || !/^[A-Z0-9\.\-:]+$/i.test(symbol)) errors.push("Underlying looks invalid.");
      if (!manualOpt && !expiration) errors.push("Choose an expiration.");
      if (manualOpt && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) errors.push("Expiration must be YYYY-MM-DD.");
      if (!Number.isFinite(Number(contracts)) || Number(contracts) < 1) errors.push("Contracts must be ≥ 1.");
      if (!Number.isFinite(Number(strike))) errors.push("Choose a strike.");
    }
    // Price rules for paper:
    if (type === "LMT" && numberOrNull(limitPrice) == null) errors.push("Limit price required for LMT.");
    if ((type === "STOP" || type === "STOP-LMT") && numberOrNull(stopPrice) == null)
      errors.push("Stop price required for STOP/STOP-LMT.");
    if (type === "MKT") {
      const px = numberOrNull(execPrice);
      if (px == null || px <= 0) errors.push("Exec Price required for MKT (paper).");
    }
    if (liveBlocked) errors.push("Live trading is read-only. Paper only.");
    return errors;
  }

  function submitTicket() {
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

    // Determine price to send to paper API
    const price =
      type === "LMT" ? numberOrNull(limitPrice)
      : (type === "MKT" ? numberOrNull(execPrice)
      : (numberOrNull(limitPrice) ?? numberOrNull(stopPrice)));

    let payload;
    if (assetType === "EQUITY") {
      payload = {
        symbol: String(symbol).toUpperCase(),
        side: sideIn,              // BUY|SELL
        qty: Number(equityQty),    // shares
        price: Number(price || 0), // required by paper API
        ts: Math.floor(Date.now() / 1000),
      };
    } else {
      // Option — for MVP we still send a single price (premium) to paper
      payload = {
        symbol: String(symbol).toUpperCase(), // underlying symbol for paper
        side: sideIn,                         // BUY|SELL (of the option)
        qty: Number(contracts),               // contracts
        price: Number(price || 0),            // premium per contract
        ts: Math.floor(Date.now() / 1000),
        // NOTE: paper API currently ignores right/expiration/strike (we can extend later)
      };
    }

    const res = await safePost(URLS.paperExecute, payload, { "X-Idempotency-Key": idem });
    setBusy(false);
    setReview(false);

    if (res.ok && res.data?.ok) {
      setLastNote(`Submitted: ${payload.side} ${payload.qty} ${symbol.toUpperCase()} @ ${payload.price}`);
      setTab("orders");
      // positions/orders update automatically via /paper/status stream
    } else {
      alert(
        `Order submit failed (${res.status || "network"}). ` +
          (res.data?.error || res.data?.message || "Endpoint not available yet.")
      );
    }
  }

  /* --------------------------------- UI ----------------------------------- */
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />

      {/* Panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: 520,
          background: "#0b0f14",
          borderLeft: "1px solid #1f2937",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 25px rgba(0,0,0,0.6)",
          overflow: "hidden", // no scroll bleed
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
            <Pill color={status.mode === "PAPER" ? "#065f46" : "#7c2d12"}>
              {status.mode} {status.mode === "LIVE" && !status.liveEnabled ? "(read-only)" : ""}
            </Pill>
            <span
              title={paperError ? String(paperError) : (paperConnected ? "Paper stream connected" : "Paper stream reconnecting…")}
              style={{
                marginLeft: 8,
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 999,
                background: paperConnected ? "#065f46" : "#7c2d12",
                color: "#e5e7eb",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Paper: {paperConnected ? "Connected" : "Waiting…"}
            </span>
          </div>
          <button onClick={onClose} style={ghostBtn}>Close</button>
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
            ["risk", "Risk"],
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
          {/* Ticket */}
          {tab === "ticket" && (
            <div style={{ display: "grid", gap: 10 }}>
              {lastNote && (
                <div style={{ color: "#a7f3d0", background: "#064e3b", borderRadius: 8, padding: "6px 8px" }}>
                  {lastNote}
                </div>
              )}

              {/* Asset Type Toggle */}
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ color: "#93c5fd", fontSize: 12, paddingTop: 6 }}>Asset:</label>
                <button onClick={() => setAssetType("OPTION")} style={assetType === "OPTION" ? chipOn : chipOff}>Option</button>
                <button onClick={() => setAssetType("EQUITY")} style={assetType === "EQUITY" ? chipOn : chipOff}>Equity</button>
              </div>

              {/* OPTION MODE */}
              {assetType === "OPTION" && (
                <>
                  {/* Manual toggle */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input id="manualOpt" type="checkbox" checked={manualOpt} onChange={(e) => setManualOpt(e.target.checked)} />
                    <label htmlFor="manualOpt" style={{ color: "#9ca3af", fontSize: 13 }}>
                      Manual expiration/strike (use if the options endpoints aren’t live)
                    </label>
                  </div>

                  {/* Filters / Inputs */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Expiration</label>
                      {manualOpt ? (
                        <input
                          placeholder="YYYY-MM-DD"
                          value={expiration}
                          onChange={(e) => setExpiration(e.target.value)}
                          style={inputStyle}
                        />
                      ) : (
                        <select value={expiration} onChange={(e) => setExpiration(e.target.value)} style={selStyle}>
                          {expirations.length === 0 && <option value="">(not available yet)</option>}
                          {expirations.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Right</label>
                      <select value={optSide} onChange={(e) => setOptSide(e.target.value)} style={selStyle}>
                        <option value="call">CALL</option>
                        <option value="put">PUT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Strike</label>
                      <input
                        type="number"
                        value={strike}
                        onChange={(e) => setStrike(e.target.value)}
                        placeholder="e.g., 500"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Contracts</label>
                      <input type="number" value={contracts} min={1} onChange={(e) => setContracts(Number(e.target.value))} style={inputStyle} />
                    </div>
                    {/* Exec Price (used when sending MKT orders to paper) */}
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Exec Price (paper)</label>
                      <input
                        type="number"
                        value={execPrice}
                        onChange={(e) => setExecPrice(e.target.value)}
                        placeholder="e.g., 2.45"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Order controls */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Side</label>
                      <select value={sideIn} onChange={(e) => setSideIn(e.target.value)} style={selStyle}>
                        <option>BUY</option>
                        <option>SELL</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Type</label>
                      <select value={type} onChange={(e) => setType(e.target.value)} style={selStyle}>
                        <option>MKT</option>
                        <option>LMT</option>
                        <option>STOP</option>
                        <option>STOP-LMT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Limit</label>
                      <input type="number" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="—" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Stop</label>
                      <input type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder="—" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>TIF</label>
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Side</label>
                      <select value={sideIn} onChange={(e) => setSideIn(e.target.value)} style={selStyle}>
                        <option>BUY</option>
                        <option>SELL</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Shares</label>
                      <input type="number" value={equityQty} min={1} onChange={(e) => setEquityQty(Number(e.target.value))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Type</label>
                      <select value={type} onChange={(e) => setType(e.target.value)} style={selStyle}>
                        <option>MKT</option>
                        <option>LMT</option>
                        <option>STOP</option>
                        <option>STOP-LMT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Limit</label>
                      <input type="number" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="—" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Stop</label>
                      <input type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder="—" style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {/* Exec Price for MKT (paper) */}
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>Exec Price (paper)</label>
                      <input
                        type="number"
                        value={execPrice}
                        onChange={(e) => setExecPrice(e.target.value)}
                        placeholder="e.g., 500.00"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: 12 }}>TIF</label>
                      <select value={tif} onChange={(e) => setTif(e.target.value)} style={selStyle}>
                        <option>DAY</option>
                        <option>GTC</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={primaryBtn} onClick={submitTicket} disabled={busy || liveBlocked}>
                  Review (paper)
                </button>
                <button style={ghostBtn} onClick={onClose}>Cancel</button>
              </div>

              {/* Review panel */}
              {review && (
                <div style={{ border: "1px solid #1f2937", borderRadius: 10, padding: 12, background: "#111827" }}>
                  <div style={{ color: "#e5e7eb", marginBottom: 8, fontWeight: 600 }}>Confirm Paper Order</div>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>
                    {assetType === "EQUITY" ? (
                      <>
                        {sideIn} {equityQty} {String(symbol).toUpperCase()} • {type}
                        {type === "MKT"   && ` @ ${execPrice}`}
                        {type === "LMT"   && ` @ ${limitPrice}`}
                        {type === "STOP"  && ` stop ${stopPrice}`}
                        {type === "STOP-LMT" && ` stop ${stopPrice} / limit ${limitPrice}`}
                        • {tif}
                      </>
                    ) : (
                      <>
                        {sideIn} {contracts}x {optSide.toUpperCase()} {String(symbol).toUpperCase()} {strike} {expiration} • {type}
                        {type === "MKT"   && ` @ ${execPrice}`}
                        {type === "LMT"   && ` @ ${limitPrice}`}
                        {type === "STOP"  && ` stop ${stopPrice}`}
                        {type === "STOP-LMT" && ` stop ${stopPrice} / limit ${limitPrice}`}
                        • {tif}
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={primaryBtn} onClick={confirmSubmit} disabled={busy}>
                      {busy ? "Submitting…" : "Confirm"}
                    </button>
                    <button style={ghostBtn} onClick={() => setReview(false)}>Back</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Positions — LIVE via /paper/status */}
          {tab === "positions" && (
            <div>
              <div style={{ marginBottom: 8, color: "#9ca3af", fontSize: 12 }}>
                Stream ts: {paperSnap.ts ? new Date(paperSnap.ts * 1000).toLocaleString() : "—"}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Symbol","Qty","Avg","Last","Unrealized","Realized","Updated"].map((h)=>
                        <th key={h} style={{ textAlign:"right", padding:"6px 8px", borderBottom:"1px solid #1f2937", color:"#9ca3af", fontSize:12 }}>{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(paperSnap.positions||{}).length === 0 ? (
                      <tr><td colSpan={7} style={{ padding:10, color:"#6b7280", textAlign:"left" }}>No positions.</td></tr>
                    ) : (
                      Object.entries(paperSnap.positions).map(([sym,p])=>(
                        <tr key={sym} style={{ borderBottom:"1px solid #111827" }}>
                          <td style={{ padding:"6px 8px", textAlign:"right", color:"#e5e7eb" }}>{sym}</td>
                          <td style={{ padding:"6px 8px", textAlign:"right", color:"#e5e7eb" }}>{p.qty}</td>
                          <td style={{ padding:"6px 8px", textAlign:"right", color:"#e5e7eb" }}>{p.avgPrice?.toFixed?.(2) ?? p.avgPrice}</td>
                          <td style={{ padding:"6px 8px", textAlign:"right", color:"#e5e7eb" }}>{p.last?.toFixed?.(2) ?? p.last}</td>
                          <td style={{ padding:"6px 8px", textAlign:"right", color: (p.unrealizedPnL||0) >= 0 ? "#10b981" : "#ef4444" }}>
                            {(p.unrealizedPnL||0).toFixed?.(2) ?? p.unrealizedPnL}
                          </td>
                          <td style={{ padding:"6px 8px", textAlign:"right", color:"#e5e7eb" }}>{(p.realizedPnL||0).toFixed?.(2) ?? p.realizedPnL}</td>
                          <td style={{ padding:"6px 8px", textAlign:"right", color:"#9ca3af" }}>
                            {p.updated ? new Date(p.updated*1000).toLocaleTimeString() : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders — LIVE via /paper/status */}
          {tab === "orders" && (
            <div>
              <div style={{ marginBottom: 8, color: "#9ca3af", fontSize: 12 }}>
                Stream ts: {paperSnap.ts ? new Date(paperSnap.ts * 1000).toLocaleString() : "—"}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Time","Order ID","Symbol","Side","Qty","Price","Status"].map((h)=>
                        <th key={h} style={{ textAlign:"left", padding:"6px 8px", borderBottom:"1px solid #1f2937", color:"#9ca3af", fontSize:12 }}>{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(paperSnap.orders||[]).length === 0 ? (
                      <tr><td colSpan={7} style={{ padding:10, color:"#6b7280" }}>No orders.</td></tr>
                    ) : (
                      (paperSnap.orders||[]).map((o)=>(
                        <tr key={o.id} style={{ borderBottom:"1px solid #111827" }}>
                          <td style={{ padding:"6px 8px", color:"#9ca3af" }}>{o.ts ? new Date(o.ts*1000).toLocaleTimeString() : "—"}</td>
                          <td style={{ padding:"6px 8px", color:"#e5e7eb" }}>{o.id}</td>
                          <td style={{ padding:"6px 8px", color:"#e5e7eb" }}>{o.symbol}</td>
                          <td style={{ padding:"6px 8px", color:o.side==="BUY"?"#10b981":"#ef4444" }}>{o.side}</td>
                          <td style={{ padding:"6px 8px", color:"#e5e7eb" }}>{o.qty}</td>
                          <td style={{ padding:"6px 8px", color:"#e5e7eb" }}>{o.price?.toFixed?.(2) ?? o.price}</td>
                          <td style={{ padding:"6px 8px", color:"#e5e7eb" }}>{o.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Executions (placeholder; leave your old logic or wire later) */}
          {tab === "executions" && (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>
              Executions list (optional) — you can render these from /paper/orders if you track partial fills later.
            </div>
          )}

          {/* Journal */}
          {tab === "journal" && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
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
                  borderRadius: 10,
                  padding: 10,
                }}
              />
            </div>
          )}

          {/* Options (read-only chain viewer, stays on Core) */}
          {tab === "options" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Options Chain (read-only). Backend should expose:
                <code> /api/options/meta?symbol=SPY </code> → {"{ expirations: [...] }"} and
                <code> /api/options/chain?symbol=SPY&expiration=YYYY-MM-DD&side=call|put </code>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Expiration</label>
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
                  <label style={{ color: "#93c5fd", fontSize: 12 }}>Side</label>
                  <select value={optSide} onChange={(e) => setOptSide(e.target.value)} style={selStyle}>
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

          {/* Risk (Core) */}
          {tab === "risk" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <Pill color={risk.killSwitch ? "#7c2d12" : "#065f46"}>
                  Kill Switch: {risk.killSwitch ? "ON (trading blocked)" : "OFF"}
                </Pill>{" "}
                {risk.caps && (
                  <Pill color="#374151">
                    Caps: {Object.entries(risk.caps).map(([k, v]) => `${k}=${v}`).join(" • ")}
                  </Pill>
                )}{" "}
                <Pill color="#374151">Updated (AZ): {fmtAz(risk.last)}</Pill>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
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
  borderRadius: 8,
  padding: "6px 8px",
};
const selStyle = { ...inputStyle, appearance: "auto" };
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
const dangerBtn = {
  background: "#b91c1c",
  color: "#fff",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};
const chipOn = {
  background: "#1f2937",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 999,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};
const chipOff = { ...chipOn, background: "#0f172a", opacity: 0.9, fontWeight: 600 };
