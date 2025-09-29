// src/services/feed.js
// Minimal OHLC feed adapter for Lightweight Charts (history + 5s poll).
// Uses backend /api/v1/ohlc and normalizes time to EPOCH SECONDS.
// IMPORTANT: Backend returns a TOP-LEVEL ARRAY (not { bars: [...] }).

/* ----------------------------- Backend base ----------------------------- */
const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  "https://frye-market-backend-1.onrender.com";

const API = String(BACKEND || "").replace(/\/+$/, "");

/* ------------------------------ Utilities ------------------------------- */
function normalizeTf(tf = "1d") {
  const t = String(tf).toLowerCase();
  if (["1m", "5m", "10m", "15m", "30m", "1h", "1d"].includes(t)) return t;
  if (t === "1hr" || t === "60m") return "1h";
  if (t === "d" || t === "day") return "1d";
  return "1d";
}

const toNum = (v, d = NaN) => (typeof v === "number" ? v : Number(v ?? d));
const isMs = (t) => Number.isFinite(t) && t > 1e12;
const toSec = (t) => {
  const n = toNum(t, NaN);
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
  out.sort((a, b) => a.time - b.time); // Lightweight-Charts wants ascending time
  return out;
}

/* -------------------------------- Feed ---------------------------------- */
export function getFeed(symbol = "SPY", timeframe = "1d") {
  const tf = normalizeTf(timeframe);

  // Build URL function
  const ohlcUrl = (limit) =>
    `${API}/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(
      tf
    )}${limit ? `&limit=${limit}` : ""}`;

  let pollId = null;
  let ctrl = null;

  return {
    // Deep history for seeding (1500 bars); ALWAYS parse top-level array
    async history() {
      const url = `${ohlcUrl(1500)}&t=${Date.now()}`;
      ctrl = new AbortController();
      const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!r.ok) throw new Error(`OHLC ${r.status}`);
      const j = await r.json();

      const root = Array.isArray(j)
        ? j
        : Array.isArray(j?.bars)
        ? j.bars // tolerate { bars: [...] } just in case
        : [];

      return normalizeBars(root);
    },

    // Simple 5s poll for the most recent bar (limit=2, use last)
    subscribe(onBar) {
      pollId = setInterval(async () => {
        try {
          const r = await fetch(`${ohlcUrl(2)}&t=${Date.now()}`, { cache: "no-store" });
          if (!r.ok) return;
          const j = await r.json();

          const root = Array.isArray(j)
            ? j
            : Array.isArray(j?.bars)
            ? j.bars
            : [];

          const last = root[root.length - 1];
          if (!last) return;

          const normalized = {
            time: toSec(last.time ?? last.t ?? last.ts ?? last.timestamp),
            open: toNum(last.open ?? last.o),
            high: toNum(last.high ?? last.h),
            low: toNum(last.low ?? last.l),
            close: toNum(last.close ?? last.c),
            volume: toNum(last.volume ?? last.v ?? 0),
          };

          if (
            Number.isFinite(normalized.time) &&
            Number.isFinite(normalized.open) &&
            Number.isFinite(normalized.high) &&
            Number.isFinite(normalized.low) &&
            Number.isFinite(normalized.close)
          ) {
            onBar(normalized);
          }
        } catch {
          // swallow and keep polling
        }
      }, 5000);

      // unsubscribe function
      return () => {
        if (pollId) clearInterval(pollId);
        pollId = null;
      };
    },

    close() {
      try {
        if (pollId) clearInterval(pollId);
        pollId = null;
        ctrl?.abort?.();
      } catch {}
    },
  };
}
