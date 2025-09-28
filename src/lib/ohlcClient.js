// src/lib/ohlcClient.js
// One place to fetch OHLC with resilience:
// 1) Try /api/v1/ohlc
// 2) Fallback to /live/intraday | /live/hourly | /live/eod based on timeframe
// Also normalizes ms→s timestamps and ensures array-of-candles shape.

const BACKEND = (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API = (BACKEND || "").replace(/\/+$/, "");

const isMs = (t) => typeof t === "number" && t > 1e12;   // 13-digit ms
const toSeconds = (t) => (isMs(t) ? Math.floor(t / 1000) : t);

function normalizeBars(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(Boolean)
    .map((b) => ({
      time: toSeconds(b.time ?? b.t ?? b.timestamp),
      open: Number(b.open ?? b.o),
      high: Number(b.high ?? b.h),
      low: Number(b.low ?? b.l),
      close: Number(b.close ?? b.c),
      volume: Number(b.volume ?? b.v ?? 0),
    }))
    .filter((b) =>
      Number.isFinite(b.time) &&
      Number.isFinite(b.open) &&
      Number.isFinite(b.high) &&
      Number.isFinite(b.low) &&
      Number.isFinite(b.close)
    );
}

async function getJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return { ok: false, status: r.status, data: null };
    const data = await r.json().catch(() => null);
    return { ok: true, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e?.message || "network" };
  }
}

function mapTfToFeed(tf) {
  // Basic routing of timeframe -> feed
  const t = String(tf || "").toLowerCase();
  if (/^\d+m$/.test(t)) return "intraday";
  if (t === "1h" || t === "4h") return "hourly";
  if (t === "d" || t === "1d" || t === "w" || t === "1w" || t === "day" || t === "week") return "eod";
  // default to intraday
  return "intraday";
}

export async function fetchOHLCResilient({ symbol, timeframe, limit }) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = String(timeframe || "10m");
  const lim = Number(limit || 500);

  // 1) Primary: /api/v1/ohlc
  const url1 = `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(tf)}&limit=${lim}`;
  let r1 = await getJson(url1);
  if (r1.ok && Array.isArray(r1.data) && r1.data.length) {
    const bars = normalizeBars(r1.data);
    if (bars.length) return { source: "api/v1/ohlc", bars };
  }

  // 2) Fallback by cadence
  const feed = mapTfToFeed(tf);
  const byFeed = {
    intraday: `${API}/live/intraday`,
    hourly: `${API}/live/hourly`,
    eod: `${API}/live/eod`,
  };
  const url2 = byFeed[feed];

  let r2 = await getJson(url2);
  if (r2.ok && r2.data) {
    // Accept common shapes: { series:[...] } OR { ohlc:[...] } OR [...]
    const raw =
      Array.isArray(r2.data)
        ? r2.data
        : Array.isArray(r2.data.series)
          ? r2.data.series
          : Array.isArray(r2.data.ohlc)
            ? r2.data.ohlc
            : [];
    const bars = normalizeBars(raw);
    if (bars.length) return { source: `/live/${feed}`, bars };
  }

  // 3) Final fallback chain: try the rest
  const tryAll = ["intraday", "hourly", "eod"].filter((f) => f !== feed);
  for (const f of tryAll) {
    const u = byFeed[f];
    const r = await getJson(u);
    if (r.ok && r.data) {
      const raw =
        Array.isArray(r.data)
          ? r.data
          : Array.isArray(r.data.series)
            ? r.data.series
            : Array.isArray(r.data.ohlc)
              ? r.data.ohlc
              : [];
      const bars = normalizeBars(raw);
      if (bars.length) return { source: `/live/${f}`, bars };
    }
  }

  return { source: "none", bars: [] };
}
