// src/lib/ohlcClient.js
// ------------------------------------------------------------
// Always fetch 1-minute history from backend and resample
// to requested timeframe. This guarantees deep history even
// if non-1m endpoints are capped server-side.
// ------------------------------------------------------------

const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  (typeof process !== "undefined" ? process.env?.REACT_APP_API_BASE : "") ||
  "";

// seconds per bar for each TF
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

const ONE_MIN = 60;
const MAX_MINUTE_BARS = 50000;

// fetch N most-recent 1-minute bars from backend
async function fetchMinuteBars(symbol, minuteCount) {
  const perRequest = Math.min(Math.max(1000, Math.ceil(minuteCount * 1.1)), MAX_MINUTE_BARS);
  const url = `${API}/api/v1/ohlc?symbol=${encodeURIComponent(
    symbol
  )}&timeframe=1m&limit=${perRequest}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`getOHLC 1m failed: ${res.status}`);
  const arr = await res.json();
  const rows = Array.isArray(arr) ? arr : [];
  return rows
    .map((r) => ({
      time: typeof r.time === "number" ? r.time : Number(r.time),
      open: +r.open,
      high: +r.high,
      low: +r.low,
      close: +r.close,
      volume: +r.volume || 0,
    }))
    .filter((b) => Number.isFinite(b.time));
}

// resample minute bars to target timeframe
function resampleToTF(minBars, targetSec) {
  if (!minBars?.length) return [];
  if (targetSec === ONE_MIN) return minBars.slice();

  const out = [];
  let bucket = null;

  for (const b of minBars) {
    const t = Math.floor(b.time / targetSec) * targetSec;
    if (!bucket || bucket.time !== t) {
      if (bucket) out.push(bucket);
      bucket = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0 };
    } else {
      if (b.high > bucket.high) bucket.high = b.high;
      if (b.low  < bucket.low ) bucket.low  = b.low;
      bucket.close = b.close;
      bucket.volume = (bucket.volume || 0) + (b.volume || 0);
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

// public API
export async function getOHLC(symbol, timeframe, desiredBars) {
  const tf = timeframe in TF<|vq_2915|>  return aggregated.slice(-desiredBars);
}

// live stream passthrough: keep your existing 10m stream choice
export function subscribeStream(symbol, baseTf = "10m", onPoint) {
  const url =
    `${API}/api/v1/ohlc?timeframe=${encodeURIComponent(baseTf)}&symbol=${encodeURIComponent(
      symbol
    )}&stream=1`;
  const es = new EventSource(url);
  es.onmessage = (evt) => {
    try {
      const row = JSON.parse(evt.data);
      onPoint({
        time: typeof row.time === "number" ? row.time : Number(row.time),
        open: +row.open, high: +row.high, low: +row.low, close: +row.close, volume: +row.volume || 0,
      });
    } catch {}
  };
  es.onerror = () => { try { es.close(); } catch {} };
  return () => { try { es.close(); } catch {} };
}

export default { getOHLC, subscribeStream };
