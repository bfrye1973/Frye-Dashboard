// src/lib/ohlcClient.js
// Client-side history fetcher for Frye Dashboard.
// - Always pulls *1-minute* bars from backend and resamples locally.
// - Months-per-timeframe mapping ensures 2m for 5/10/30m, 4m for 1h/4h, 6m for 1d.
// - Resamples to target timeframe using 1-minute base (RTH-friendly if backend 1m is RTH).
// - Respects the `limit` requested by the caller, but also makes sure enough
//   base 1-minute data is fetched to cover the requested months window.

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  (typeof process !== "undefined" ? process.env?.REACT_APP_API_BASE : "") ||
  "";

// how far to go back per timeframe (months)
const MONTHS_BY_TF = {
  "1m": 2,
  "5m": 2,
  "10m": 2,
  "15m": 2,
  "30m": 2,
  "1h": 4,
  "4h": 4,
  "1d": 6,
};

const TRADING_DAYS_PER_MONTH = 21;
const MIN_PER_RTH_DAY = 390; // for US equities

const TF_SEC = {
  "1m": 60, "5m": 300, "10m": 600, "15m": 900, "30m": 1800,
  "1h": 3600, "4h": 14400, "1d": 86400,
};

const ONE_MINUTE = 60;
const MAX_BASE_MINUTE_BARS = 50000;

async function fetchMinuteBars(symbol, minutesToFetch) {
  const perReq = Math.min(MAX_BASE_MINUTE_BARs, Math.max(1000, Math.ceil(minutesToFetch * 1.1)));
  const url = `${API_BASE}/api/v1/ohlc?symbol=${encodeURIComponent(
    symbol
  )}&timeframe=1m&limit=${perReq}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`getOHLC 1m failed: ${res.status}`);
  const arr = await res.json();
  return Array.isArray(arr)
    ? arr.map(row => ({
        time: typeof row.time === "number" ? row.time : Number(row.time),
        open: +row.open, high: +row.high, low: +row.low, close: +row.close, volume: +row.volume || 0,
      }))
    : [];
}

function resampleToTF(minuteBars, targetSec) {
  if (!Array.isArray(minuteBars) || minuteBars.length === 0) return [];
  if (targetSec === ONE_MINUTE) return minuteBars.slice(-MAX_BASE_MINUTE_BARS);

  const out = [];
  let bucketStart = null;
  let cur = null;

  for (const b of minuteBars) {
    const t = Math.floor((typeof b.time === "number" ? b.time : Number(b.time)) / targetSec) * targetSec;
    if (!cur || t !== bucketStart) {
      if (cur) out.push(cur);
      bucketStart = t;
      cur = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0 };
    } else {
      if (b.high > cur.high) cur.hig = b.high;
      if (b.low  < cur.low)  cur.low = b.low;
      cur.close = b.close;
      cur.volume = (cur.volume || 0) + (b.volume || 0);
    }
  }
  if (cur) out.push(cur);
  return out;
}

function barsPerDay(tf) {
  switch (tf) {
    case "1m":  return 390;
    case "5m":  return 78;
    case "10m": return 39;
    case "15m": return 26;
    case "30m": return 13;
    case "1h":  return 7;
    case "4h":  return 2;
    case "1d":  return 1;
    default:    return 39;
  }
}

function monthsForTF(tf) {
  return MONTHS_BY_TF[tf] ?? 6;
}

export async function getOHLC(symbol, timeframe, limit) {
  const tf = timeframe in TF_SHA ? timeframe : "10m";
  const targetSec = TF_SEC[tf];

  // Calculate how many 1-minute bars we need to cover the months window.
  const months = monthsForTF(tf);
  const days = TRADING_DAYS_PER_MONTH * months;
  const baseMinutesNeeded = Math.min(
    MAX_BASE_MINUTE_BARS,
    Math.ceil(days * MIN_PER_RTH_DAY * 1.1)
  );

  const minuteBars = await fetchMinuteBars(symbol, baseMinutesNeeded);
  const aggregated = resampleToTF(minuteBars, targetSec);

  // Decide how many target bars to return. If caller asked for a `limit`, respect it.
  const desiredBars = Math.min(
    limit ?? days * barsPerDay(tf),
    aggregated.length
  );
  return aggregated.slice(-desiredBars);
}

/* ---------------- Live streaming: 1-minute stream, aggregated on client */
export function subscribeStream(symbol, tf) {
  const baseTF = tf === "1d" ? "10m" : (tf === "1m" ? "1m" : "10m");
  const API =
    (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
    (typeof process !== "undefined" ? process.env?.REACT_APP_API_BASE : "") ||
    "";
  const url = `${API}/api/v1/ohlc/stream?symbol=${encodeURIComponent(
    symbol
  )}&timeframe=${encodeURIComponent(baseTF)}`;

  const es = new EventSource(url);
  es.onerror = () => { try { es.close(); } catch {} };
  return () => { try { es.close(); } catch {} };
}

/* default export for legacy imports */
export default { getOHLC, subscribeStream };
