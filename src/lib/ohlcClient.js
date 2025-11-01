// src/lib/ohlcClient.js
// Canonical OHLC client
//
// Strategy:
// 1) Try to fetch the requested timeframe directly with the full limit.
// 2) If the server returns too few bars or errors, fall back to fetching
//    1-minute history and aggregate locally to the target TF.
//
// This avoids the "1m cap ~1 month" problem while keeping the 1m path as a
// safe fallback so charts still work if a TF isn't supported upstream.

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  "https://frye-market-backend-1.onrender.com";

const STREAM_BASE =
  (typeof window !== "undefined" && (window.__STREAM_BASE__ || "")) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_STREAM_BASE) ||
  "";

const API = (BACKEND || "").replace(/\/+$/, "");

// ---- TF seconds
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

// ---- utils
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
      if (b.high > cur.high) cur.high = b.high;
      if (b.low  < cur.low ) cur.low  = b.low;
      cur.close = b.close;
      cur.volume = Number(cur.volume || 0) + Number(b.volume || 0);
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---- direct TF fetch
async function fetchDirectTF(sym, tf, limit) {
  const url = `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(tf)}&limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`directTF ${tf} ${r.status}`);
  const data = await r.json();
  const bars = normalizeBars(Array.isArray(data) ? data : data?.bars || []);
  bars.sort((a, b) => a.time - b.time);
  return bars;
}

// ---- 1m aggregate fallback
async function fetchFrom1mAgg(sym, tf, limit) {
  const tfSec = TF_SEC[tf] || 600;
  const needAgg = tfSec !== 60;

  // Server-side ceiling for 1m; overshoot to cover gaps
  const MAX_1M_FETCH = 50000;
  const overshoot = 3;
  const need1mCount = Math.min(
    MAX_1M_FETCH,
    Math.max(needAgg ? Math.ceil((limit * tfSec) / 60) * overshoot : limit, 50)
  );

  const url = `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=1m&limit=${need1mCount}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`1m ${r.status}`);

  const data = await r.json();
  const oneMin = normalizeBars(Array.isArray(data) ? data : data?.bars || []);
  oneMin.sort((a, b) => a.time - b.time);

  if (!needAgg) return oneMin.slice(-limit);

  const agg = aggregateToTf(oneMin, tfSec);
  return agg.slice(-limit);
}

// ---------------- API: getOHLC ----------------
export async function getOHLC(symbol = "SPY", timeframe = "1m", limit = 1500) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = String(timeframe || "1m");
  const tfSec = TF_SEC[tf] || 600;

  // 1) Prefer direct timeframe (avoids 1m cap)
  if (tf !== "1m") {
    try {
      const direct = await fetchDirectTF(sym, tf, limit);
      // basic freshness & sufficiency checks
      const last = direct[direct.length - 1];
      const freshEnough = last ? (Date.now() / 1000 - last.time) <= 3 * tfSec : false;
      const enoughBars = direct.length >= Math.min(limit * 0.9, limit - 10);
      if (freshEnough || enoughBars) {
        return direct.slice(-limit);
      }
      // else fall through to 1m
    } catch {
      // ignore and fallback
    }
  }

  // 2) Fallback: 1m → aggregate locally
  return await fetchFrom1mAgg(sym, tf, limit);
}

// ---------------- API: compat shim ----------------
export async function fetchOHLCResilient({ symbol, timeframe, limit = 1500 }) {
  const bars = await getOHLC(symbol, timeframe, limit);
  return { source: "api/v1/ohlc (direct or 1m→tf client agg)", bars };
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
      }
    } catch {
      // ignore non-JSON lines
    }
  };

  es.onerror = () => {
    try { es.close(); } catch {}
  };

  return () => {
    try { es.close(); } catch {}
  };
}

export default { getOHLC, fetchOHLCResilient, subscribeStream };
