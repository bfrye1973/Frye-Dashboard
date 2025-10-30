// src/lib/ohlcClient.js
// Canonical OHLC client (compat-safe)
//
// Exports:
//   - getOHLC(symbol, timeframe, limit) -> plain bars in UNIX SECONDS
//   - fetchOHLCResilient({ symbol, timeframe, limit }) -> { source, bars }
//   - subscribeStream(symbol, timeframe, onBar) -> live SSE bars (UNIX SECONDS)

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const STREAM_BASE =
  (typeof window !== "undefined" && (window.__STREAM_BASE__ || "")) ||
  process.env.REACT_APP_STREAM_BASE ||
  ""; // e.g. https://frye-market-backend-2.onrender.com

const API = (BACKEND || "").replace(/\/+$/, "");

// ---------------- utils ----------------
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
const toSec = (t) => (isMs(t) ? Math.floor(t / 1000) : t);

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
    );
}

// Aggregate ascending 1m bars to target timeframe (seconds)
function aggregateToTf(barsAsc, tfSec) {
  if (!Array.isArray(barsAsc) || !barsAsc.length || tfSec === 60) return barsAsc || [];
  const out = [];
  let bucketStart = null;
  let cur = null;

  for (const b of barsAsc) {
    const t = Number(b.time);
    if (!Number.isFinite(t)) continue;
    const start = Math.floor(t / tfSec) * tfSec;

    if (bucketStart === null || start > bucketStart) {
      if (cur) out.push(cur);
      bucketStart = start;
      cur = {
        time: start,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: Number(b.volume || 0),
      };
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume = Number(cur.volume || 0) + Number(b.volume || 0);
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------- API: getOHLC ----------------
// Always fetch 1m from Backend-1 and aggregate locally (robust against backend TF gaps).
export async function getOHLC(symbol = "SPY", timeframe = "1m", limit = 1500) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = String(timeframe || "1m");
  const tfSec = TF_SEC[tf] || 600; // default to 10m if unknown
  const needAgg = tfSec !== 60;

  // Ceiling for 1m fetch; overshoot to cover gaps
  const MAX_1M_FETCH = 50000;
  const overshoot = 3;
  const need1mCount = Math.min(
    MAX_1M_FETCH,
    Math.max(needAgg ? Math.ceil((limit * tfSec) / 60) * overshoot : limit, 50)
  );

  const url =
    `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}` +
    `&timeframe=1m&limit=${need1mCount}`;

  // DEBUG: exact URL used
  console.log("[getOHLC] →", url, { sym, tf, tfSec, need1mCount, limit });

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`OHLC ${r.status}`);

  const data = await r.json();
  const oneMin = normalizeBars(Array.isArray(data) ? data : data?.bars || []);
  oneMin.sort((a, b) => a.time - b.time); // ascending

  if (!needAgg) return oneMin.slice(-limit);

  const agg = aggregateToTf(oneMin, tfSec);
  return agg.slice(-limit);
}

// ---------------- API: compat shim ----------------
export async function fetchOHLCResilient({ symbol, timeframe, limit = 1500 }) {
  const bars = await getOHLC(symbol, timeframe, limit);
  return { source: "api/v1/ohlc (1m→tf client agg)", bars };
}

// ---------------- Live SSE subscribe ----------------
export function subscribeStream(symbol, timeframe, onBar) {
  if (!STREAM_BASE) {
    console.warn("[subscribeStream] STREAM_BASE missing");
    return () => {};
  }
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = String(timeframe || "1m");
  const url = `${STREAM_BASE.replace(/\/+$/, "")}/stream/agg?symbol=${encodeURIComponent(
    sym
  )}&tf=${encodeURIComponent(tf)}`;

  console.log("[subscribeStream] →", url, { sym, tf });

  const es = new EventSource(url);

  es.onmessage = (ev) => {
    if (!ev?.data || ev.data === ":ping" || ev.data.trim() === "") return;

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
      } else if (msg?.type === "diag") {
        console.debug("[stream diag]", msg);
      }
    } catch {
      if (process?.env?.NODE_ENV !== "production") {
        console.debug("[subscribeStream] non-JSON line:", ev.data);
      }
    }
  };

  es.onerror = (e) => {
    console.warn("[subscribeStream] error (closing)", e);
    try { es.close(); } catch {}
  };

  return () => {
    try { es.close(); } catch {}
  };
}

export default { getOHLC, fetchOHLCResilient, subscribeStream };
