// src/components/trading/TradeDrawer.jsx
// Paper Trading Drawer (wide, readable). Core (Backend-1) for Options; Streamer (Backend-2) for Paper.
//
// Requires: src/hooks/usePaperStatus.js

import React, { useEffect, useMemo, useState } from "react";
import usePaperStatus from "../../hooks/usePaperStatus";

/* --------------------- Core & Streamer base resolvers --------------------- */
function getCoreBase() {
  // Backend-1 (Core)
  return "https://frye-market-backend-1.onrender.com";
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

/* -------------------------------- helpers -------------------------------- */
const FONT = 14;
const FONT_SM = 13;

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

function numberOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function safeGet(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
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
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

/* -------------------------------- UI atoms -------------------------------- */
function Pill({ color = "#374151", children }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        background: color,
        color: "#e5e7eb",
        fontSize: FONT_SM,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

const inputStyle = {
  width: "100%",
  background: "#0f172a",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: FONT,
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
  fontSize: FONT,
};
const ghostBtn = {
  background: "#111827",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontSize: FONT,
};
const dangerBtn = {
  background: "#b91c1c",
  color: "#fff",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: FONT,
};
const chipOn = {
  background: "#1f2937",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 999,
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: FONT,
  fontWeight: 800,
};
const chipOff = { ...chipOn, background: "#0f172a", opacity: 0.95, fontWeight: 600 };

/* --------------------------------- Drawer -------------------------------- */
export default function TradeDrawer({ open, onClose, defaultSymbol = "SPY" }) {
  const coreBase = getCoreBase();
  const streamBase = getStreamBase();

  const [tab, setTab] = useState("ticket"); // ticket | positions | orders | executions | journal | options | risk
  const [symbol, setSymbol] = useState(defaultSymbol);

  // LIVE/PAPER status from Core (read-only)
  const [status, setStatus] = useState({ mode: "PAPER", liveEnabled: false, connected: false });
  const statusUrl = useMemo(() => `${coreBase}/api/trading/status`, [coreBase]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const res = await safeGet(statusUrl);
      if (!alive) return;
      if (res.ok && res.data) {
        setStatus({
          mode: res.data.mode || "PAPER",
          liveEnabled: !!res.data.liveEnabled,
          connected: !!res.data.connected,
        });
      }
    })();
    const id = setInterval(async () => {
      const res = await safeGet(statusUrl);
      if (!alive) return;
      if (res.ok && res.data) {
        setStatus({
          mode: res.data.mode || "PAPER",
          liveEnabled: !!res.data.liveEnabled,
          connected: !!res.data.connected,
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
    return {
      // Core (options)
      optionsMeta: `${coreBase}/api/options/meta?symbol=${encodeURIComponent(symbol)}`,
      chain: ({ expiration, side }) =>
        `${coreBase}/api/options/chain?symbol=${encodeURIComponent(symbol)}${
          expiration ? `&expiration=${encodeURIComponent(expiration)}` : ""
        }${side ? `&side=${encodeURIComponent(side)}` : ""}`,
      // Paper (Streamer)
      paperExecute: `${streamBase}/paper/execute`,
      // Risk (Core)
      riskStatus: `${coreBase}/api/risk/status`,
      riskKill: `${coreBase}/api/risk/kill`,
    };
  }, [coreBase, streamBase, symbol]);

  /* -------------------- Paper stream (live positions/orders) ---------------- */
  const {
    connected: paperConnected,
    error: paperError,
    snapshot: paperSnap,
  } = usePaperStatus(); // { ts, positions:{}, orders:[] }

  /* ------------------------------ Options data ----------------------------- */
  const [assetType, setAssetType] = useState("OPTION"); // OPTION | EQUITY
  const [expirations, setExpirations] = useState([]);
  const [expiration, setExpiration] = useState("");
  const [optSide, setOptSide] = useState("call");
  const [chainRows, setChainRows] = useState([]);
  const [chainAvail, setChainAvail] = useState(null);
  const [strike, setStrike] = useState("");
  const [manualOpt, setManualOpt] = useState(false);

  // Load expirations
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

  // Load chain and set default/ATM strike
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
        if (!strike && res.data.length) {
          const mid = Math.floor(res.data.length / 2);
          setStrike(res.data[mid].strike);
        }
      } else {
        setChainRows([]);
        setChainAvail(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [URLS, expiration, optSide, open, tab, assetType, manualOpt, strike]);

  // Auto-fill Exec Price (MKT) from mark for the selected option strike
  useEffect(() => {
    if (assetType !== "OPTION") return;
    if (!chainAvail || !Array.isArray(chainRows) || !chainRows.length) return;
    const row = chainRows.find((r) => Number(r.strike) === Number(strike));
    if (row && row.mark != null) setExecPrice(String(row.mark));
  }, [assetType, chainAvail, chainRows, strike]);

  /* ----------------------------------- Risk -------------------------------- */
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
    return () => {
      alive = false;
    };
  }, [URLS.riskStatus, tab, open]);

  async function handleKillSwitch() {
    const ok = window.confirm("Kill Switch: cancel all working orders and block new ones?");
    if (!ok) return;
    const r = await safePost(URLS.riskKill, {});
    if (r.ok) alert("Kill Switch engaged.");
    else alert("Kill Switch failed or endpoint not available.");
  }

  /* ------------------------------ Ticket state ----------------------------- */
  const [sideIn, setSideIn] = useState("BUY");
  const [tif, setTif] = useState("DAY");
  const [type, setType] = useState("MKT"); // MKT|LMT|STOP|STOP-LMT
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [execPrice, setExecPrice] = useState(""); // for MKT

  const [equityQty, setEquityQty] = useState(100);
  const [contracts, setContracts] = useState(1);

  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastNote, setLastNote] = useState(null);

  const liveBlocked = status.mode === "LIVE" && !status.liveEnabled;

  function validateTicket() {
    const errors = [];
    if (assetType === "EQUITY") {
      if (!symbol || !/^[A-Z0-9\.\-:]+$/i.test(symbol)) errors.push("Symbol looks invalid.");
      if (!(+equityQty >= 1)) errors.push("Share quantity must be ≥ 1.");
    } else {
      if (!symbol || !/^[A-Z0-9\.\-:]+$/i.test(symbol)) errors.push("Underlying looks invalid.");
      if (!manualOpt && !expiration) errors.push("Choose an expiration.");
      if (manualOpt && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) errors.push("Expiration must be YYYY-MM-DD.");
      if (!(+contracts >= 1)) errors.push("Contracts must be ≥ 1.");
      if (!Number.isFinite(+strike)) errors.push("Choose a strike.");
    }
    if (type === "LMT" && numberOrNull(limitPrice) == null) errors.push("Limit price required for LMT.");
    if ((type === "STOP" || type === "STOP-LMT") && numberOrNull(stopPrice) == null)
      errors.push("Stop price required.");
    if (type === "MKT" && (numberOrNull(execPrice) == null || +execPrice <= 0))
      errors.push("Exec Price required for MKT (paper).");
    if (liveBlocked) errors.push("Live trading is read-only. Paper only.");
    return errors;
  }

  function submitTicket() {
    const errs = validateTicket();
    if (errs.length) {
      alert("Please fix:\n• " + errs.join("\n• "));
      return;
    }
    setReview(true);
  }

  function cryptoRandom() {
    try {
      const a = new Uint8Array(16);
      (window.crypto || globalThis.crypto).getRandomValues(a);
      return Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("");
    } catch {
      return String(Date.now());
    }
  }

  async function confirmSubmit() {
    setReview(false);
    setBusy(true);

    const isMkt = type === "MKT";
    const price =
      isMkt ? numberOrNull(execPrice) : numberOrNull(limitPrice) ?? numberOrNull(stopPrice);

    let payload;
    if (assetType === "EQUITY") {
      payload = {
        symbol: symbol.toUpperCase(),
        side: sideIn,
        qty: Number(equityQty),
        price: Number(price || 0),
        ts: Math.floor(Date.now() / 1000),
      };
    } else {
      payload = {
        symbol: symbol.toUpperCase(), // underlying for MVP
        side: sideIn,
        qty: Number(contracts),
        price: Number(price || 0), // option premium per contract
        ts: Math.floor(Date.now() / 1000),
      };
    }

    const res = await safePost(URLS.paperExecute, payload, {
      "X-Idempotency-Key": cryptoRandom(),
    });

    setBusy(false);

    if (res.ok && res.data?.ok) {
      setLastNote(`Submitted: ${payload.side} ${payload.qty} ${symbol.toUpperCase()} @ ${payload.price}`);
      setTab("orders"); // lists update via /paper/status stream
    } else {
      alert(`Order submit failed (${res.status || "network"}). ${res.data?.error || res.data?.message || ""}`);
    }
  }

  /* ----------------------------------- UI --------------------------------- */
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, fontSize: FONT }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />

      {/* Panel (wide, offset from top/bottom) */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          bottom: 12,
          width: "clamp(680px, 52vw, 980px)",
          background: "#0b0f14",
          border: "1px solid #1f2937",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-10px 0 30px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <strong style={{ color: "#93c5fd", fontSize: FONT + 1 }}>Trade</strong>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol"
              style={{ ...inputStyle, width: 120 }}
            />
            <Pill color={status.mode === "PAPER" ? "#065f46" : "#7c2d12"}>
              {status.mode} {status.mode === "LIVE" && !status.liveEnabled ? "(read-only)" : ""}
            </Pill>
            <Pill color={paperConnected ? "#065f46" : "#7c2d12"}>
              Paper: {paperConnected ? "Connected" : "Waiting…"}
            </Pill>
          </div>
          <button onClick={onClose} style={ghostBtn}>
            Close
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #1f2937" }}>
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
                padding: "8px 12px",
                marginRight: 6,
                cursor: "pointer",
                fontSize: FONT_SM,
                fontWeight: tab === key ? 800 : 600,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "14px 16px 20px", display: "grid", gap: 14 }}>
          {/* Ticket */}
          {tab === "ticket" && (
            <div style={{ display: "grid", gap: 12 }}>
              {/* Asset Type */}
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Asset:</label>
                <button onClick={() => setAssetType("OPTION")} style={assetType === "OPTION" ? chipOn : chipOff}>
                  Option
                </button>
                <button onClick={() => setAssetType("EQUITY")} style={assetType === "EQUITY" ? chipOn : chipOff}>
                  Equity
                </button>
              </div>

              {/* OPTION MODE */}
              {assetType === "OPTION" && (
                <>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input id="manualOpt" type="checkbox" checked={manualOpt} onChange={(e) => setManualOpt(e.target.checked)} />
                    <label htmlFor="manualOpt" style={{ color: "#9ca3af" }}>
                      Manual expiration/strike (use if endpoints aren’t live)
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Expiration</label>
                      {manualOpt ? (
                        <input style={inputStyle} placeholder="YYYY-MM-DD" value={expiration} onChange={(e) => setExpiration(e.target.value)} />
                      ) : (
                        <select style={selStyle} value={expiration} onChange={(e) => setExpiration(e.target.value)}>
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
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Right</label>
                      <select style={selStyle} value={optSide} onChange={(e) => setOptSide(e.target.value)}>
                        <option value="call">CALL</option>
                        <option value="put">PUT</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Strike</label>
                      {chainAvail && (chainRows || []).length ? (
                        <select
                          style={selStyle}
                          value={String(strike ?? "")}
                          onChange={(e) => setStrike(Number(e.target.value))}
                          title="Strikes from Core /api/options/chain"
                        >
                          {(chainRows || []).map((r) => (
                            <option key={r.strike} value={r.strike}>
                              {r.strike} • mark {r.mark ?? "-"} • bid {r.bid ?? "-"} / ask {r.ask ?? "-"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input style={inputStyle} type="number" placeholder="e.g., 500" value={strike} onChange={(e) => setStrike(e.target.value)} />
                      )}
                    </div>

                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Contracts</label>
                      <input style={inputStyle} type="number" value={contracts} min={1} onChange={(e) => setContracts(Number(e.target.value))} />
                    </div>

                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Exec Price (paper)</label>
                      <input style={inputStyle} type="number" placeholder="e.g., 2.45" value={execPrice} onChange={(e) => setExecPrice(e.target.value)} />
                    </div>
                  </div>

                  {/* Order controls */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Side</label>
                      <select style={selStyle} value={sideIn} onChange={(e) => setSideIn(e.target.value)}>
                        <option>BUY</option>
                        <option>SELL</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Type</label>
                      <select style={selStyle} value={type} onChange={(e) => setType(e.target.value)}>
                        <option>MKT</option>
                        <option>LMT</option>
                        <option>STOP</option>
                        <option>STOP-LMT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Limit</label>
                      <input style={inputStyle} type="number" placeholder="—" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Stop</label>
                      <input style={inputStyle} type="number" placeholder="—" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>TIF</label>
                      <select style={selStyle} value={tif} onChange={(e) => setTif(e.target.value)}>
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Side</label>
                      <select style={selStyle} value={sideIn} onChange={(e) => setSideIn(e.target.value)}>
                        <option>BUY</option>
                        <option>SELL</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Shares</label>
                      <input style={inputStyle} type="number" value={equityQty} min={1} onChange={(e) => setEquityQty(Number(e.target.value))} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Type</label>
                      <select style={selStyle} value={type} onChange={(e) => setType(e.target.value)}>
                        <option>MKT</option>
                        <option>LMT</option>
                        <option>STOP</option>
                        <option>STOP-LMT</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Limit</label>
                      <input style={inputStyle} type="number" placeholder="—" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Stop</label>
                      <input style={inputStyle} type="number" placeholder="—" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>Exec Price (paper)</label>
                      <input style={inputStyle} type="number" placeholder="e.g., 500.00" value={execPrice} onChange={(e) => setExecPrice(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ color: "#93c5fd", fontSize: FONT_SM }}>TIF</label>
                      <select style={selStyle} value={tif} onChange={(e) => setTif(e.target.value)}>
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
                <button style={ghostBtn} onClick={onClose}>
                  Cancel
                </button>
              </div>

              {/* Review */}
              {review && (
                <div style={{ border: "1px solid #1f2937", borderRadius: 10, padding: 12, background: "#111827" }}>
                  <div style={{ color: "#e5e7eb", marginBottom: 8, fontWeight: 700, fontSize: FONT + 1 }}>
                    Confirm Paper Order
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: FONT, marginBottom: 8 }}>
                    {assetType === "EQUITY" ? (
                      <>
                        {sideIn} {equityQty} {symbol.toUpperCase()} • {type}
                        {type === "MKT" && ` @ ${execPrice}`} {type === "LMT" && ` @ ${limitPrice}`}
                        {type === "STOP" && ` stop ${stopPrice}`} {type === "STOP-LMT" && ` stop ${stopPrice} / limit ${limitPrice}`} • {tif}
                      </>
                    ) : (
                      <>
                        {sideIn} {contracts}x {optSide.toUpperCase()} {symbol.toUpperCase()} {strike} {expiration} • {type}
                        {type === "MKT" && ` @ ${execPrice}`} {type === "LMT" && ` @ ${limitPrice}`}
                        {type === "STOP" && ` stop ${stopPrice}`} {type === "STOP-LMT" && ` stop ${stopPrice} / limit ${limitPrice}`} • {tif}
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={primaryBtn} onClick={confirmSubmit} disabled={busy}>
                      {busy ? "Submitting…" : "Confirm"}
                    </button>
                    <button style={ghostBtn} onClick={() => setReview(false)}>
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Positions — Live from stream */}
          {tab === "positions" && (
            <div>
              <div style={{ marginBottom: 8, color: "#9ca3af", fontSize: FONT_SM }}>
                Stream ts: {paperSnap.ts ? new Date(paperSnap.ts * 1000).toLocaleString() : "—"}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Symbol", "Qty", "Avg", "Last", "Unrealized", "Realized", "Updated"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "right",
                            padding: "8px 10px",
                            borderBottom: "1px solid #1f2937",
                            color: "#9ca3af",
                            fontSize: FONT_SM,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(paperSnap.positions || {}).length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 12, color: "#6b7280", textAlign: "left" }}>
                          No positions.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(paperSnap.positions).map(([sym, p]) => (
                        <tr key={sym} style={{ borderBottom: "1px solid #111827" }}>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e7eb" }}>{sym}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e7eb" }}>{p.qty}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e7eb" }}>
                            {p.avgPrice?.toFixed?.(2) ?? p.avgPrice}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e7eb" }}>
                            {p.last?.toFixed?.(2) ?? p.last}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              color: (p.unrealizedPnL || 0) >= 0 ? "#10b981" : "#ef4444",
                            }}
                          >
                            {(p.unrealizedPnL || 0).toFixed?.(2) ?? p.unrealizedPnL}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e7eb" }}>
                            {(p.realizedPnL || 0).toFixed?.(2) ?? p.realizedPnL}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>
                            {p.updated ? new Date(p.updated * 1000).toLocaleTimeString() : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders — Live from stream */}
          {tab === "orders" && (
            <div>
              <div style={{ marginBottom: 8, color: "#9ca3af", fontSize: FONT_SM }}>
                Stream ts: {paperSnap.ts ? new Date(paperSnap.ts * 1000).toLocaleString() : "—"}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Time", "Order ID", "Symbol", "Side", "Qty", "Price", "Status"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #1f2937",
                            color: "#9ca3af",
                            fontSize: FONT_SM,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(paperSnap.orders || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 12, color: "#6b7280" }}>
                          No orders.
                        </td>
                      </tr>
                    ) : (
                      (paperSnap.orders || []).map((o) => (
                        <tr key={o.id} style={{ borderBottom: "1px solid #111827" }}>
                          <td style={{ padding: "8px 10px", color: "#9ca3af" }}>
                            {o.ts ? new Date(o.ts * 1000).toLocaleTimeString() : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>{o.id}</td>
                          <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>{o.symbol}</td>
                          <td style={{ padding: "8px 10px", color: o.side === "BUY" ? "#10b981" : "#ef4444" }}>{o.side}</td>
                          <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>{o.qty}</td>
                          <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>{o.price?.toFixed?.(2) ?? o.price}</td>
                          <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>{o.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Journal / Options / Risk */}
          {tab === "journal" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ color: "#9ca3af", fontSize: FONT }}>Quick Trading Journal (local).</div>
              <textarea rows={8} style={{ ...inputStyle, height: 160 }} placeholder="Notes…" />
            </div>
          )}

          {tab === "options" && (
            <div style={{ color: "#9ca3af", fontSize: FONT }}>
              Options Chain uses Core endpoints:
              <br />
              <code>/api/options/meta?symbol=SPY</code>
              <br />
              <code>/api/options/chain?symbol=SPY&expiration=YYYY-MM-DD&side=call|put</code>
            </div>
          )}

          {tab === "risk" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <Pill color={risk.killSwitch ? "#7c2d12" : "#065f46"}>
                  Kill Switch: {risk.killSwitch ? "ON (trading blocked)" : "OFF"}
                </Pill>{" "}
                {risk.caps && (
                  <Pill color="#374151">{Object.entries(risk.caps).map(([k, v]) => `${k}=${v}`).join(" • ")}</Pill>
                )}{" "}
                <Pill color="#374151">Updated (AZ): {fmtAz(risk.last)}</Pill>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={dangerBtn} onClick={handleKillSwitch}>
                  Engage Kill Switch
                </button>
                <button style={ghostBtn} onClick={() => setTab("ticket")}>
                  Back to Ticket
                </button>
              </div>
            </div>
          )}

          {/* bottom spacer */}
          <div style={{ height: 14 }} />
        </div>
      </div>
    </div>
  );
}
