// src/pages/rows/RowStrategies/index.jsx
// Strategies — Engine 5 Confluence + Engine 6 Permission
// FINAL: Adds ALWAYS-VISIBLE Engine Stack (E1–E6) WITHOUT increasing row height

import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import LiveDot from "../../../components/LiveDot";

/* -------------------- env helpers -------------------- */
function env(name, fb = "") {
  try {
    if (typeof process !== "undefined" && process.env && name in process.env) {
      return String(process.env[name] || "").trim();
    }
  } catch {}
  return fb;
}

function normalizeApiBase(x) {
  const raw = String(x || "").trim();
  if (!raw) return "https://frye-market-backend-1.onrender.com";
  let out = raw.replace(/\/+$/, "");
  out = out.replace(/\/api\/v1$/i, "");
  out = out.replace(/\/api$/i, "");
  return out;
}

const API_BASE = normalizeApiBase(env("REACT_APP_API_BASE", ""));
const AZ_TZ = "America/Phoenix";

/* -------------------- endpoints -------------------- */
const E5_URL = ({ symbol = "SPY", tf, degree, wave = "W1" }) =>
  `${API_BASE}/api/v1/confluence-score?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(
    tf
  )}&degree=${encodeURIComponent(degree)}&wave=${encodeURIComponent(wave)}`;

const E6_URL = `${API_BASE}/api/v1/trade-permission`;

/* -------------------- utils -------------------- */
const nowIso = () => new Date().toISOString();

function toAZ(iso, withSeconds = false) {
  try {
    return (
      new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: withSeconds ? "2-digit" : undefined,
        timeZone: AZ_TZ,
      }) + " AZ"
    );
  } catch {
    return "—";
  }
}

function minutesAgo(iso) {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 60000;
}

function clamp100(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function fmt2(x) {
  return Number.isFinite(x) ? Number(x).toFixed(2) : "—";
}

function top3(arr) {
  const a = Array.isArray(arr) ? arr : [];
  return a.slice(0, 3);
}

function grade(score) {
  const s = clamp100(score);
  if (s >= 90) return "A+";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  return "IGNORE";
}

/* -------------------- Golden Coil badge rule -------------------- */
function showGoldenCoil(confluence) {
  return (
    confluence?.invalid !== true &&
    confluence?.flags?.goldenIgnition === true &&
    confluence?.compression?.active === true &&
    confluence?.compression?.state === "COILING"
  );
}

/* -------------------- fetch helpers -------------------- */
async function safeFetchJson(url, opts = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      json?.error ||
      json?.detail ||
      (typeof json === "string" ? json : null) ||
      text?.slice(0, 200) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

/* -------------------- Engine 6 POST -------------------- */
async function fetchEngine6({ symbol, tf, confluence }) {
  const engine5 = {
    invalid: confluence?.invalid === true,
    total: clamp100(confluence?.scores?.total ?? 0),
    reasonCodes: Array.isArray(confluence?.reasonCodes) ? confluence.reasonCodes : [],
  };

  const z = confluence?.context?.activeZone || null;

  const payload = {
    symbol,
    tf,
    engine5,
    marketMeter: null,
    zoneContext: {
      zoneType: z?.zoneType || "UNKNOWN",
      zoneId: z?.id || null,
      withinZone: !!z,
      flags: {
        liquidityFail: confluence?.flags?.liquidityTrap === true,
      },
    },
    intent: { action: "NEW_ENTRY" },
  };

  return safeFetchJson(E6_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* -------------------- NEW: Open Full Strategies -------------------- */
function openFullStrategies(symbol = "SPY") {
  const url = `/strategies/full?symbol=${encodeURIComponent(symbol)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ===================== MAIN ===================== */
export default function RowStrategies() {
  const { setSelection } = useSelection();

  const STRATS = useMemo(
    () => [
      { id: "SCALP", name: "Scalp — Minor Intraday", tf: "10m", degree: "minute", wave: "W1" },
      { id: "MINOR", name: "Minor — Swing", tf: "1h", degree: "minor", wave: "W1" },
      { id: "INTERMEDIATE", name: "Intermediate — Long", tf: "4h", degree: "intermediate", wave: "W1" },
    ],
    []
  );

  const [state, setState] = useState({
    SCALP: { data: null, e6: null, err: null, lastFetch: null },
    MINOR: { data: null, e6: null, err: null, lastFetch: null },
    INTERMEDIATE: { data: null, e6: null, err: null, lastFetch: null },
  });

  /* -------- polling -------- */
  useEffect(() => {
    let alive = true;
    let inFlight = false;

    async function pullOnce() {
      if (!alive || inFlight) return;
      if (typeof document !== "undefined" && document.hidden) return;

      inFlight = true;
      const updates = {};

      for (const s of STRATS) {
        try {
          const confluence = await safeFetchJson(
            `${E5_URL({ symbol: "SPY", tf: s.tf, degree: s.degree, wave: s.wave })}&t=${Date.now()}`
          );
          let e6 = null;
          try {
            e6 = await fetchEngine6({ symbol: "SPY", tf: s.tf, confluence });
          } catch {
            e6 = { permission: "—" };
          }
          updates[s.id] = { data: confluence, e6, err: null, lastFetch: nowIso() };
        } catch (e) {
          updates[s.id] = { data: null, e6: null, err: String(e), lastFetch: nowIso() };
        }
      }

      if (alive) setState((p) => ({ ...p, ...updates }));
      inFlight = false;
    }

    pullOnce();
    const id = setInterval(pullOnce, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [STRATS]);

  function load(sym, tf) {
    setSelection({ symbol: sym, timeframe: tf, strategy: "smz" });
  }

  return (
    <section className="panel" style={{ padding: 10 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 10,
        }}
      >
        {STRATS.map((s) => {
          const st = state[s.id] || {};
          const confluence = st.data;
          const e6 = st.e6;

          const score = clamp100(confluence?.scores?.total ?? 0);
          const label = confluence?.scores?.label || grade(score);
          const golden = showGoldenCoil(confluence);

          const live = minutesAgo(st.lastFetch) <= 1.5 ? "green" : "yellow";

          const loc = confluence?.location || {};
          const fib = confluence?.context?.fib || {};
          const reaction = confluence?.context?.reaction || {};
          const volume = confluence?.context?.volume || {};

          return (
            <div
              key={s.id}
              style={{
                background: "#101010",
                border: "1px solid #262626",
                borderRadius: 12,
                padding: 10,
                minHeight: 320,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* HEADER */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 900 }}>{s.name}</div>
                <LiveDot status={live} />
              </div>

              {/* PERMISSION + SCORE (MOVED UP) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Score</div>
                  <div style={{ background: "#1f2937", height: 8, borderRadius: 6 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${score}%`,
                        background: "#22c55e",
                        borderRadius: 6,
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontWeight: 900 }}>{Math.round(score)} ({label})</div>
              </div>

              {/* ENGINE STACK (FIXED HEIGHT) */}
              <div
                style={{
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  padding: 6,
                  fontSize: 11,
                  lineHeight: "14px",
                  height: 110,
                  display: "grid",
                  gridTemplateRows: "repeat(6, 1fr)",
                  gap: 2,
                }}
              >
                <div><b>E1</b> {loc?.state || "—"}</div>
                <div><b>E2</b> {fib?.signals?.invalidated ? "INVALID" : fib?.signals ? "VALID" : "NO_ANCHORS"}</div>
                <div><b>E3</b> {reaction?.reactionScore ?? 0} {reaction?.structureState || "HOLD"}</div>
                <div><b>E4</b> {confluence?.volumeState || "NO_SIGNAL"}</div>
                <div><b>E5</b> {Math.round(score)} {label} • {confluence?.compression?.state || "NONE"}</div>
                <div><b>E6</b> {e6?.permission || "—"}</div>
              </div>

              {/* ACTIONS */}
              <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => load("SPY", s.tf)}>Load SPY</button>
                <button onClick={() => load("QQQ", s.tf)}>Load QQQ</button>
                <button onClick={() => openFullStrategies("SPY")}>Open Full Strategies</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
