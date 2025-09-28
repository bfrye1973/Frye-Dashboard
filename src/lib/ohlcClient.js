// src/lib/ohlcClient.js
// Resilient OHLC fetcher:
// 1) Try /api/v1/ohlc
// 2) Fallback to /live/intraday | /live/hourly | /live/eod (normalize)
// 3) Final fallback to Polygon (client-side) using REACT_APP_POLYGON_KEY
//    NOTE: This exposes the key to the browser (temporary stopgap only).

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API = (BACKEND || "").replace(/\/+$/, "");
const POLY = (process.env.REACT_APP_POLYGON_KEY || "").trim();

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

function mapTf(tf) {
  const t = String(tf || "").toLowerCase();
  if (/^\d+m$/.test(t)) return "intraday";
  if (t === "1h" || t === "4h") return "hourly";
  if (["d", "1d", "day", "w", "1w", "week"].includes(t)) return "eod";
  return "intraday";
}

/* ------------------------ Polygon fallback helpers ----------------------- */
function polyMap(tf) {
  const t = String(tf || "").toLowerCase();
  const m = {
    "1m": { mult: 1, span: "minute" },
    "3m": { mult: 3, span: "minute" },
    "5m": { mult: 5, span: "minute" },
    "10m": { mult: 10, span: "minute" },
    "15m": { mult: 15, span: "minute" },
    "30m": { mult: 30, span: "minute" },
    "1h": { mult: 1, span: "hour" },
    "4h": { mult: 4, span: "hour" },
    "1d": { mult: 1, span: "day" },
    d: { mult: 1, span: "day" },
    day: { mult: 1, span: "day" },
  };
  return m[t] || m["10m"];
}

function polyWindow(span) {
  const now = new Date();
  const toISO = now.toISOString().slice(0, 10);
  const from = new Date(now);
  if (span === "minute" || span === "hour") from.setDate(from.getDate() - 45);
  else from.setFullYear(from.getFullYear() - 1);
  const fromISO = from.toISOString().slice(0, 10);
  return { fromISO, toISO };
}

async function fetchFromPolygon({ symbol, timeframe, limit = 500 }) {
  if (!POLY) return { ok: false, data: null, reason: "no-key" };
  const sym = String(symbol || "SPY").toUpperCase();
  const map = polyMap(timeframe);
  const { fromISO, toISO } = polyWindow(map.span);

  const url =
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(sym)}` +
    `/range/${map.mult}/${map.span}/${fromISO}/${toISO}?adjusted=true&sort=asc&limit=${limit}&apiKey=${encodeURIComponent(
      POLY
    )}`;

  const r = await getJson(url);
  if (!r.ok || !r.data) return { ok: false, data: null, status: r.status || 0 };

  const raw = Array.isArray(r.data?.results) ? r.data.results : [];
  const bars = normalizeBars(
    raw.map((b) => ({
      t: Number(b.t), // ms
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v ?? 0,
    }))
  );
  return { ok: bars.length > 0, data: bars };
}

/* ------------------------------ main export ------------------------------ */
export async function fetchOHLCResilient({ symbol, timeframe, limit = 500 }) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = String(timeframe || "10m");

  // 1) primary route
  const url1 = `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(
    tf
  )}&limit=${limit}`;
  const r1 = await getJson(url1);
  if (r1.ok && r1.data) {
    const root = Array.isArray(r1.data)
      ? r1.data
      : Array.isArray(r1.data.bars)
      ? r1.data.bars
      : [];
    const bars = normalizeBars(root);
    if (bars.length) return { source: "api/v1/ohlc", bars };
  }

  // 2) cadence fallback
  const feed = mapTf(tf);
  const feedUrl = {
    intraday: `${API}/live/intraday`,
    hourly: `${API}/live/hourly`,
    eod: `${API}/live/eod`,
  }[feed];

  const r2 = await getJson(feedUrl);
  if (r2.ok && r2.data) {
    const raw = Array.isArray(r2.data)
      ? r2.data
      : Array.isArray(r2.data.series)
      ? r2.data.series
      : Array.isArray(r2.data.ohlc)
      ? r2.data.ohlc
      : [];
    const bars = normalizeBars(raw);
    if (bars.length) return { source: `/live/${feed}`, bars };
  }

  // 3) try remaining feeds
  for (const f of ["intraday", "hourly", "eod"].filter((x) => x !== feed)) {
    const rx = await getJson(`${API}/live/${f}`);
    if (rx.ok && rx.data) {
      const raw = Array.isArray(rx.data)
        ? rx.data
        : Array.isArray(rx.data.series)
        ? rx.data.series
        : Array.isArray(rx.data.ohlc)
        ? rx.data.ohlc
        : [];
      const bars = normalizeBars(raw);
      if (bars.length) return { source: `/live/${f}`, bars };
    }
  }

  // 4) FINAL fallback: Polygon (client-side)
  const pr = await fetchFromPolygon({ symbol: sym, timeframe: tf, limit });
  if (pr.ok && Array.isArray(pr.data) && pr.data.length) {
    return { source: "polygon", bars: pr.data };
  }

  return { source: "none", bars: [] };
}
