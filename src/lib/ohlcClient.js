// src/lib/ohlcClient.js
// Live-only OHLC client (Option A):
// - 10m  -> /live/intraday
// - 1h   -> /live/hourly
// - 1d   -> /live/eod
// Normalizes shapes and ms→s if needed.

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

function mapTfToLive(tf) {
  const t = String(tf || "").toLowerCase();
  if (/^\d+m$/.test(t)) return "intraday";      // 1m, 3m, 5m, 10m, 15m, 30m
  if (t === "1h" || t === "4h") return "hourly";
  return "eod";                                  // 1d / d / day / w
}

/**
 * fetchOHLCResilient — live-only edition
 * Always pulls from the old JSON feeds; no /api/v1/ohlc call.
 */
export async function fetchOHLCResilient({ symbol, timeframe, limit = 1500 }) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf  = String(timeframe || "10m");
  const feed = mapTfToLive(tf);

  const byFeed = {
    intraday: `${API}/live/intraday`,
    hourly:   `${API}/live/hourly`,
    eod:      `${API}/live/eod`,
  };

  // primary
  const r = await getJson(byFeed[feed]);
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
    if (bars.length) return { source: `/live/${feed}`, bars };
  }

  // final fallback: try remaining live feeds (just in case)
  for (const f of ["intraday", "hourly", "eod"].filter((x) => x !== feed)) {
    const rx = await getJson(byFeed[f]);
    if (rx.ok && rx.data) {
      const raw =
        Array.isArray(rx.data)
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
