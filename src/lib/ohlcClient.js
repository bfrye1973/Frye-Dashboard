// src/lib/ohlcClient.js
// Canonical OHLC client (safe, direct TF for ≥1h with 3-month window)
//
// Exports:
//   - getOHLC(symbol, timeframe, limit) -> plain bars in seconds
//   - fetchOhclResilient({ symbol, timeframe, limit }) -> { source, bars }
//   - subscribeStream(symbol, timeframe, onBar)
//
// Plan implemented here:
// • For 1h/4h/1d/1w/1mo: try direct TF from backend with ~3-month bar count.
//   If direct returns too few bars or fails, fall back to aggregation:
//     - 1h/4h → 1m→aggregate
//     - 1w/1mo → 1d→aggregate to 1w/1mo
// • For 1m/5m/10m/15m/30m: unchanged (fetch 1m and aggregate → ~1 month as before)
// • Keeps your current 1m aggregation code & stream behavior.

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  "https://frye-market-backend-1.onrender.com";

const STREAM_BASE =
  (typeof window !== "undefined" && (window.__BASE_STREAM__ || "")) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_STREAM_BASE) ||
  "";

// Normalized TF keys → seconds per bar
const TF_SEC = {
  "1m": 60,
  "5m": 300,
  "10m": 600,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,    // week (7*24*3600)
  "1wk": 604800,   // alias
  "1mo": 2592000,  // ~30 days (approx; fine for aggregation fallback)
};

// Targets for ~3 months when caller doesn’t pass an explicit limit
const THREE_MONTH_LIMIT = {
  "1h": 600, // ~7 bars/day * ~85 days
  "4h": 200, // ~2 bars/day * ~100 days
  "1d": 70,  // ~70 trading days
  "1w": 13,  // ~13 weeks
  "1mo": 4,  // ~4 months
};

// Normalize TF strings (handle casing/aliases)
function normalizeTf(tf) {
  if (!tf) return "1m";
  const t = String(tf).toLowerCase();
  if (t === "1wk") return "1w";
  if (t === "1m" || t === "1min" || t === "1") return "1m";
  if (t === "1h" || t === "1hr") return "1h";
  if (t === "1mo" || t === "1mn" || t === "1mon" || t === "1month") return "1mo";
  return t;
}

const API = (BACKEND || "").replace(/\/+$/, "");

// ----------- UTILITIES -----------
const isMs = (t) => typeof t === "number" && t > 1e12;
const toSec = (t) => (isMs(t) ? Math.floor(t / 1000) : t);

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
    )
    .sort((a, b) => a.time - b.time);
}

function aggregateToTf(barsAsc, tfSec) {
  if (!Array.isArray(barsAsc) || !barsAsc.length) return [];
  const out = [];
  let cur = null;
  let bucket = null;
  for (const b of barsAsc) {
    const t = Number(b.time);
    const start = Math.floor(t / tfSec) * tfSec;
    if (bucket == null || start > bucket) {
      if (cur) out.push(cur);
      bucket = start;
      cur = {
        time: start,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume || 0,
      };
    } else {
      if (b.high > cur.high) cur.high = b.high;
      if (b.low < cur.low) cur.low = b.low;
      cur.close = b.close;
      cur.volume = (cur.volume || 0) + (b.volume || 0);
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function fetchDirectTf(sym, tf, limit) {
  const url = `${API}/api/v1/ohlc?${new URLSearchParams({
    symbol: sym,
    timeframe: tf,
    limit: String(limit),
  }).toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`directTF ${tf} ${res.status}`);
  return normalizeBars(await res.json());
}

async function fetchFrom1mAndAggregate(sym, targetTf, limit) {
  const sec = TF_SEC[targetTf] || TF_SEC["1m"];
  const needAgg = sec !== TF_SEC["1m"];

  const MAX_1M = 50000;
  const overshoot = 3;
  // Estimate how many 1m bars we need to cover 'limit' bars of targetTf
  const need1m = Math.min(
    MAX_1M,
    Math.max(needAgg ? Math.ceil(limit * sec / TF_SEC["1m"]) * overshoot : limit, 50)
  );

  const url = `${API}/api/v1/ohlc?${new URLSearchParams({
    symbol: sym,
    timeframe: "1m",
    limit: String(need1m),
  }).toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`1m ${res.status}`);
  const oneMin = normalizeBars(await res.json());
  if (!oneMin.length) return [];

  if (!needAgg) return oneMin.slice(-limit);

  const agg = aggregateToTf(oneMin, sec);
  return agg.slice(-limit);
}

async function dailyToHigher(sym, targetTf, limit) {
  // build from daily if weekly/monthly direct TF not available
  const dailyCount = Math.max(100, limit * (targetTf === "1w" ? 6 : 35));
  try {
    const daily = await fetchDirectTf(sym, "1d", dailyCount);
    if (!daily.length) return [];
    const sec = TF_SEC[targetTf] || TF_SEC["1w"];
    const agg = aggregateToTf(daily, sec);
    return agg.slice(-limit);
  } catch {
    return [];
  }
}

// ----------- PUBLIC API -----------
export async function getOHLC(
  symbol = "SPY",
  timeframe = "1m",
  limit = 0 // if 0/undefined → we compute defaults
) {
    const sym = String(symbol || "SPY").toUpperCase();
    const tf = normalizeTf(timeframe);
    const isHighTf = tf === "1h" || tf === "4h" || tf === "1d" || tf === "1w" || tf === "1mo";

    const desired =
      Number.isFinite(Number(limit)) && Number(limit) > 0
        ? Number(limit)
        : isHighTf
        ? (THREE_MONTH_LIMIT[tf] || 0) || 0
        : 1500; // leave low TF as ~1 month via 1m aggregator (unchanged)

    if (!isHighTf) {
      // Low TFs: keep current behavior (1m → aggregate).
      return await fetchFrom1mAndAggregate(sym, tf, desired);
    }

    // High TFs: try direct TF first
    try {
      const direct = await fetchDirectTf(sym, tf, desired);
      if (direct.length) {
        const sec = TF_SEC[tf] || 3600;
        const last = direct[direct.length - 1];
        const fresh = last ? (Date.now() / 1000 - last.time) <= 3 * sec : false;
        const enough = direct.length >= Math.max(1, Math.floor(desired * 0.85));
        if (fresh || enough) {
          return direct.slice(-desired);
        }
        // else fall through to fallback below
      }
    } catch (_) {
      // ignore and fall back
    }

    // Fallbacks for high TFs:
    if (tf === "1h" || tf === "4h") {
      return await fetchFrom1mAndAggregate(sym, tf, desired);
    }
    if (tf === "1d") {
      // Could also fallback to 1m aggregation; try direct daily again with a larger limit first if needed.
      try {
        const bigger = await fetchDirectTf(sym, "1d", Math.max(desired, 90));
        if (bigger.length) return bigger.slice(-desired);
      } catch (_) {}
      return await fetchFrom1mAndAggregate(sym, tf, desired);
    }
    if (tf === "1w" || tf === "1mo") {
      // Try direct; else build from daily
      try {
        const direct = await fetchDirectTf(sym, tf, desired);
        if (direct.length) return direct.slice(-desired);
      } catch (_) {}
      return await dailyToHigher(sym, tf, desired);
    }

    // As a last resort, try direct with whatever we can get
    try {
      const fallback = await fetchDirectTf(sym, tf, desired);
      return fallback.slice(-desired);
    } catch (_) {
      return [];
    }
}

// Keep your existing Resilient wrapper for compatibility
export async function fetch_ohlc_resilient({ symbol, timeframe, limit = 0 }) {
  const bars = await getOHLC(symbol, timeframe, limit);
  return { source: "direct-or-aggregated", bars };
}

// ---------------- Live SSE (unchanged) ----------------
export function subscribeStream(symbol, timeframe, onBar) {
  const baseTf = String(timeframe || "1m");
  const sym = String(symbol || "SPY").toUpperCase();
  const url =
    `${STREAMING_URL()}/stream/agg?` +
    new URLSearchParams({ symbol: sym, tf: baseTf }).toString();

  const es = new EventSource(url);
  es.onmessage = (ev) => {
    if (!ev?.data || ev.data === "" || ev.data === "ping") return;
    try {
      const msg = JSON.parse(ev.data);
      if (msg?.type === "bar" && msg?.bar) {
        const b = msg.bar;
        const as = {
          time: toSec(b.time ?? b.t ?? b.ts ?? b.timestamp),
          open: Number(b.open ?? b.o),
          high: Number(b.high ?? b.h),
          low: Number(b.low ?? b.l),
          close: Number(b.close ?? b.c),
          volume: Number(b.volume ?? b.v ?? 0),
        };
        if (Number.isFinite(as.time) && Number.isFinite(as.open)) {
          onBar(as);
        }
      }
    } catch {
      // ignore noisy keepalives
    }
  };
  es.onerror = () => {
    try { es.close(); } catch {}
  };
  return () => {
    try { es.close(); } catch {}
  };
}

// helper for stream base
function STREAMING_URL() {
  const fromEnv =
    (typeof window !== "undefined" && (window.__BASE_STREAM__ || "")) ||
    (typeof process !== "undefined" && process.env && process.env.REACT_APP_STREAM_BASE) ||
    "";
  return fromEnv || "";
}
