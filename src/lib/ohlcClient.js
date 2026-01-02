// src/lib/ohlcClient.js
// Canonical OHLC client (direct TF fetch from backend-1)
// - getOHLC(symbol, timeframe, limit) -> bars in UNIX SECONDS
// - subscribeStream(symbol, timeframe, onBar) -> SSE bars (UNIX SECONDS)

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const STREAM_BASE =
  (typeof window !== "undefined" && (window.__STREAM_BASE__ || "")) ||
  process.env.REACT_APP_STREAM_BASE ||
  ""; // https://frye-market-backend-2.onrender.com

const API = (BACKEND || "").replace(/\/+$/, "");

const TF_SEC = {
  "1m": 60,
  "5m": 300,
  "10m": 600,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

const isMs = (t) => typeof t === "number" && t > 1e12;
const toSec = (t) => (isMs(t) ? Math.floor(t / 1000) : Number(t));

function normalizeTf(tf) {
  const t = String(tf || "10m").toLowerCase().trim();
  return TF_SEC[t] ? t : "10m";
}

function clampLimit(n, fallback = 1500) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return fallback;
  return Math.max(1, Math.min(50000, Math.floor(x)));
}

function normalizeBars(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(Boolean)
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
    )
    .sort((a, b) => a.time - b.time);
}

// ---------------- API: getOHLC ----------------
// OPTION B: Fetch requested timeframe directly from backend-1.
export async function getOHLC(symbol = "SPY", timeframe = "10m", limit = 1500) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = normalizeTf(timeframe);
  const safeLimit = clampLimit(limit, 1500);

  const url =
    `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}` +
    `&timeframe=${encodeURIComponent(tf)}` +
    `&limit=${encodeURIComponent(safeLimit)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`OHLC ${r.status}`);

  const data = await r.json().catch(() => null);

  // backend-1 returns array; but support {bars:[]} too
  const raw = Array.isArray(data) ? data : Array.isArray(data?.bars) ? data.bars : [];
  const bars = normalizeBars(raw);

  // return last N bars
  return bars.length > safeLimit ? bars.slice(-safeLimit) : bars;
}

// ---------------- API: compat shim ----------------
export async function fetchOHLCResilient({ symbol, timeframe, limit = 1500 }) {
  const bars = await getOHLC(symbol, timeframe, limit);
  return { source: "api/v1/ohlc (direct tf)", bars };
}

// ---------------- Live SSE subscribe ----------------
export function subscribeStream(symbol, timeframe, onBar) {
  if (!STREAM_BASE) {
    console.warn("[subscribeStream] STREAM_BASE missing");
    return () => {};
  }

  const sym = String(symbol || "SPY").toUpperCase();
  const tf = normalizeTf(timeframe);

  // NOTE: streamer supports mode=rth|eth; keep rth for strategy consistency
  const url =
    `${STREAM_BASE.replace(/\/+$/, "")}/stream/agg` +
    `?symbol=${encodeURIComponent(sym)}` +
    `&tf=${encodeURIComponent(tf)}` +
    `&mode=rth`;

  const es = new EventSource(url);

  es.onmessage = (ev) => {
    if (!ev?.data || ev.data.startsWith(":") || ev.data.trim() === "") return;

    try {
      const msg = JSON.parse(ev.data);

      if (msg?.type === "bar" && msg.bar) {
        const b = msg.bar;
        const bar = {
          time: toSec(b.time ?? b.t ?? b.ts ?? b.timestamp),
          open: Number(b.open ?? b.o),
          high: Number(b.high ?? b.h),
          low: Number(b.low ?? b.l),
          close: Number(b.close ?? b.c),
          volume: Number(b.volume ?? b.v ?? 0),
        };
        if (Number.isFinite(bar.time) && Number.isFinite(bar.open)) onBar(bar);
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
