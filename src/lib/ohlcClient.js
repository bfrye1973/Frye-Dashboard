// src/lib/ohlcClient.js
// Resilient OHLC fetcher:
// 1) Try /api/v1/ohlc
// 2) Fallback to /live/intraday | /live/hourly | /live/eod based on timeframe
// 3) Normalize shapes and ms→s timestamps

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API = (BACKEND || "").replace(/\/+$/, "");

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

export async function fetchOHLCResilient({ symbol, timeframe, limit = 500 }) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = String(timeframe || "10m");

  // 1) primary route
  const url1 = `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(tf)}&limit=${limit}`;
  const r1 = await getJson(url1);
  if (r1.ok && r1.data) {
    const root = Array.isArray(r1.data) ? r1.data : Array.isArray(r1.data.bars) ? r1.data.bars : [];
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

  return { source: "none", bars: [] };
}
