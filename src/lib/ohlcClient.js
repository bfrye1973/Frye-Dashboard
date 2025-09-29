// src/lib/ohlcClient.js
// Canonical OHLC client:
// 1) Primary: /api/v1/ohlc  (deep history; time in EPOCH SECONDS)
// 2) Fallbacks: /live/intraday | /live/hourly | /live/eod  (normalize + seconds)

// ------------------------- Backend base -------------------------
const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API = String(BACKEND || "").replace(/\/+$/, "");

// ------------------------- Helpers ------------------------------
const toNum = (v) => (typeof v === "number" ? v : Number(v));
const isMs = (t) => {
  const n = toNum(t);
  return Number.isFinite(n) && n > 1e12;
};
const toSec = (t) => {
  const n = toNum(t);
  if (!Number.isFinite(n)) return NaN;
  return isMs(n) ? Math.floor(n / 1000) : n;
};

function normalizeBars(arr) {
  if (!Array.isArray(arr)) return [];
  const out = arr
    .filter(Boolean)
    .map((b) => ({
      time: toSec(b.time ?? b.t ?? b.ts ?? b.timestamp),
      open: toNum(b.open ?? b.o),
      high: toNum(b.high ?? b.h),
      low: toNum(b.low ?? b.l),
      close: toNum(b.close ?? b.c),
      volume: toNum(b.volume ?? b.v ?? 0),
    }))
    .filter(
      (b) =>
        Number.isFinite(b.time) &&
        Number.isFinite(b.open) &&
        Number.isFinite(b.high) &&
        Number.isFinite(b.low) &&
        Number.isFinite(b.close)
    );

  // Ensure ascending order by time (some feeds are not sorted).
  out.sort((a, b) => a.time - b.time);
  return out;
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
  return "eod"; // 1d/d/day/w
}

// ------------------------- Public API ---------------------------
/**
 * Resilient OHLC fetcher with normalization.
 * @param {{symbol: string, timeframe: string, limit?: number}} params
 * @returns {Promise<{source: string, bars: Array}>}
 */
export async function fetchOHLCResilient({ symbol, timeframe, limit = 1500 }) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = String(timeframe || "10m");

  // Sanitize limit (client side). Server will also clamp.
  let lim = Number.parseInt(limit, 10);
  if (!Number.isFinite(lim) || lim <= 0) lim = 1500;
  lim = Math.min(lim, 5000);

  // 1) Primary: /api/v1/ohlc
  const url1 = `${API}/api/v1/ohlc?symbol=${encodeURIComponent(
    sym
  )}&timeframe=${encodeURIComponent(tf)}&limit=${lim}`;
  const r1 = await getJson(url1);
  if (r1.ok && r1.data) {
    const root = Array.isArray(r1.data)
      ? r1.data
      : Array.isArray(r1.data?.bars)
      ? r1.data.bars
      : [];
    const bars = normalizeBars(root);
    if (bars.length) return { source: "api/v1/ohlc", bars };
  }

  // 2) Fallback: /live/* for this timeframe bucket
  const feed = mapTf(tf);
  const liveUrl =
    feed === "intraday"
      ? `${API}/live/intraday`
      : feed === "hourly"
      ? `${API}/live/hourly`
      : `${API}/live/eod`;

  const r2 = await getJson(liveUrl);
  if (r2.ok && r2.data) {
    const raw = Array.isArray(r2.data)
      ? r2.data
      : Array.isArray(r2.data?.series)
      ? r2.data.series
      : Array.isArray(r2.data?.ohlc)
      ? r2.data.ohlc
      : [];
    const bars = normalizeBars(raw);
    if (bars.length) return { source: `/live/${feed}`, bars };
  }

  // 3) Try the remaining live feeds as a last resort (bugfix: use rx, not r2)
  for (const f of ["intraday", "hourly", "eod"].filter((x) => x !== feed)) {
    const rx = await getJson(`${API}/live/${f}`);
    if (rx.ok && rx.data) {
      const raw = Array.isArray(rx.data)
        ? rx.data
        : Array.isArray(rx.data?.series)
        ? rx.data.series
        : Array.isArray(rx.data?.ohlc)
        ? rx.data.ohlc
        : [];
      const bars = normalizeBars(raw);
      if (bars.length) return { source: `/live/${f}`, bars };
    }
  }

  // Nothing usable
  return { source: "none", bars: [] };
}
