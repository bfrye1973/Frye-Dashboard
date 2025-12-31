// src/lib/ohlcClient.js
// Canonical OHLC client (snapshot-seeded + live SSE updates)
//
// Guarantees:
// - Snapshot seeds chart FIRST (backend-2)
// - Live SSE bars ALWAYS update current candle
// - RTH mode enforced for intraday charts
// - UNIX SECONDS everywhere

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const STREAM_BASE =
  (typeof window !== "undefined" && (window.__STREAM_BASE__ || "")) ||
  process.env.REACT_APP_STREAM_BASE ||
  "https://frye-market-backend-2.onrender.com";

const API = BACKEND.replace(/\/+$/, "");

// ---------------- utils ----------------
const isMs = (t) => typeof t === "number" && t > 1e12;
const toSec = (t) => (isMs(t) ? Math.floor(t / 1000) : Number(t));

function normalizeBars(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((b) => ({
      time: toSec(b.time ?? b.t ?? b.ts ?? b.timestamp),
      open: Number(b.open ?? b.o),
      high: Number(b.high ?? b.h),
      low: Number(b.low ?? b.l),
      close: Number(b.close ?? b.c),
      volume: Number(b.volume ?? b.v ?? 0),
    }))
    .filter(
      (b) =>
        Number.isFinite(b.time) &&
        Number.isFinite(b.open) &&
        Number.isFinite(b.high) &&
        Number.isFinite(b.low) &&
        Number.isFinite(b.close)
    );
}

function normalizeTf(tf) {
  const t = String(tf || "10m").toLowerCase();
  if (t.endsWith("m") || t.endsWith("h") || t === "1d") return t;
  return `${t}m`; // enforce "10m" style
}

function isIntradayTf(tf) {
  return tf === "10m" || tf === "30m" || tf === "1h" || tf === "4h";
}

// ---------------- Snapshot seed ----------------
async function trySnapshot(symbol, timeframe, limit) {
  if (!STREAM_BASE) return null;

  const url =
    `${STREAM_BASE.replace(/\/+$/, "")}/stream/snapshot` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&tf=${encodeURIComponent(timeframe)}` +
    `&limit=${encodeURIComponent(limit)}` +
    `&mode=rth`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;

  const j = await r.json().catch(() => null);
  const bars = normalizeBars(j?.bars || []);
  if (!bars.length) return null;

  bars.sort((a, b) => a.time - b.time);
  return bars.slice(-limit);
}

// ---------------- API: getOHLC ----------------
export async function getOHLC(symbol = "SPY", timeframe = "10m", limit = 1500) {
  const sym = String(symbol).toUpperCase();
  const tf = normalizeTf(timeframe);
  const safeLimit = Math.max(1, Math.min(50000, Number(limit)));

  // 1️⃣ Snapshot-first for intraday
  if (isIntradayTf(tf)) {
    const snap = await trySnapshot(sym, tf, safeLimit);
    if (snap) return snap;
  }

  // 2️⃣ REST fallback
  const url =
    `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}` +
    `&timeframe=${encodeURIComponent(tf)}` +
    `&limit=${encodeURIComponent(safeLimit)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`OHLC ${r.status}`);

  const j = await r.json();
  const bars = normalizeBars(Array.isArray(j) ? j : j?.bars || []);
  bars.sort((a, b) => a.time - b.time);
  return bars.slice(-safeLimit);
}

// ---------------- Compat shim ----------------
export async function fetchOHLCResilient({ symbol, timeframe, limit = 1500 }) {
  const bars = await getOHLC(symbol, timeframe, limit);
  return { source: "snapshot→stream→fallback", bars };
}

// ---------------- Live SSE subscribe ----------------
export function subscribeStream(symbol, timeframe, onBar) {
  if (!STREAM_BASE) return () => {};

  const sym = String(symbol).toUpperCase();
  const tf = normalizeTf(timeframe);

  const url =
    `${STREAM_BASE.replace(/\/+$/, "")}/stream/agg` +
    `?symbol=${encodeURIComponent(sym)}` +
    `&tf=${encodeURIComponent(tf)}` +
    `&mode=rth`;

  const es = new EventSource(url);

  es.onmessage = (ev) => {
    if (!ev?.data || ev.data.startsWith(":")) return;

    try {
      const msg = JSON.parse(ev.data);

      if (msg?.type === "bar" && msg.bar) {
        const b = msg.bar;
        const bar = {
          time: toSec(b.time),
          open: Number(b.open),
          high: Number(b.high),
          low: Number(b.low),
          close: Number(b.close),
          volume: Number(b.volume ?? 0),
        };

        if (Number.isFinite(bar.time)) {
          // 🔑 THIS is what fixes “stuck on yesterday”
          onBar(bar);
        }
      }
    } catch {}
  };

  es.onerror = () => {
    try { es.close(); } catch {}
  };

  return () => {
    try { es.close(); } catch {}
  };
}

export default { getOHLC, fetchOHLCResilient, subscribeStream };
