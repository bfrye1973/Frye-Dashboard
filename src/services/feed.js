// /src/services/feed.js — history+poll + SSE subscribe + 10m sectorCards helper

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  "https://frye-market-backend-1.onrender.com";

const API = String(BACKEND || "").replace(/\/+$/, "");

// -----------------------
// Numeric helpers
// -----------------------
const toNum = (v, d = NaN) => (typeof v === "number" ? v : Number(v ?? d));
const toSec = (t) => {
  const n = toNum(t, NaN);
  if (!Number.isFinite(n)) return NaN;
  return n > 1e12 ? Math.floor(n / 1000) : n; // ms->s
};

// -----------------------
// Safe JSON fetch helper
// -----------------------
async function safeFetchJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch (err) {
    console.warn("[feed] fetch failed", url, err);
    return null;
  }
}

// ----------------------------------------------------------
// NEW: Enhanced 10m Sector Cards (Option B1)
// Always prefer /api/sectorcards-10m; fallback to /live/intraday
// ----------------------------------------------------------
export async function fetch10mSectorCards() {
  // 1) try enhanced API
  const enhanced = await safeFetchJson(`${API}/api/sectorcards-10m`);
  if (enhanced && enhanced.ok && Array.isArray(enhanced.sectorCards)) {
    return enhanced.sectorCards;
  }

  // 2) fallback to /live/intraday
  const live = await safeFetchJson(`${API}/live/intraday`);
  if (live && Array.isArray(live.sectorCards)) {
    return live.sectorCards;
  }

  // 3) last resort: neutral 11 sectors
  console.warn("[feed] using neutral fallback for 10m sectorCards");
  const ORDER = [
    "Information Technology",
    "Materials",
    "Health Care",
    "Communication Services",
    "Real Estate",
    "Energy",
    "Consumer Staples",
    "Consumer Discretionary",
    "Financials",
    "Utilities",
    "Industrials",
  ];
  return ORDER.map((name) => ({
    sector: name,
    breadth_pct: 0,
    momentum_pct: 0,
    nh: 0,
    nl: 0,
    up: 0,
    down: 0,
    tilt: 0,
    outlook: "neutral",
    grade: "danger",
  }));
}

// ----------------------------------------------------------
// Existing OHLC history + polling feed (unchanged)
// ----------------------------------------------------------
export function getFeed(symbol = "SPY", timeframe = "10m") {
  const ohlcUrl = (limit) =>
    `${API}/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(
      timeframe
    )}${limit ? `&limit=${limit}` : ""}`;
  let pollId = null,
    ctrl = null;

  return {
    async history() {
      const r = await fetch(`${ohlcUrl(5000)}&t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`OHLC ${r.status}`);
      const j = await r.json();
      const root = Array.isArray(j) ? j : Array.isArray(j?.bars) ? j.bars : [];
      const out = root
        .map((b) => ({
          time: toSec(b.time ?? b.t ?? b.ts ?? b.timestamp),
          open: toNum(b.open ?? b.o),
          high: toNum(b.high ?? b.h),
          low: toNum(b.low ?? b.l),
          close: toNum(b.close ?? b.c),
          volume: toNum(b.volume ?? b.v ?? 0),
        }))
        .filter((b) => Object.values(b).every(Number.isFinite))
        .sort((a, b) => a.time - b.time);
      return out;
    },
    subscribe(onBar) {
      pollId = setInterval(async () => {
        try {
          const r = await fetch(`${ohlcUrl(2)}&t=${Date.now()}`, { cache: "no-store" });
          if (!r.ok) return;
          const j = await r.json();
          const arr = Array.isArray(j) ? j : Array.isArray(j?.bars) ? j.bars : [];
          const last = arr[arr.length - 1];
          if (!last) return;
          const bar = {
            time: toSec(last.time ?? last.t ?? last.ts ?? last.timestamp),
            open: toNum(last.open ?? last.o),
            high: toNum(last.high ?? last.h),
            low: toNum(last.low ?? last.l),
            close: toNum(last.close ?? last.c),
            volume: toNum(last.volume ?? last.v ?? 0),
          };
          if (Object.values(bar).every(Number.isFinite)) onBar(bar);
        } catch {
          // ignore polling errors
        }
      }, 5000);
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

// ----------------------------------------------------------
// Existing SSE instant stream (/stream/agg) — unchanged
// ----------------------------------------------------------
export function subscribeStream(symbol = "SPY", timeframe = "10m", onBar) {
  const base = (API || "").replace(/\/+$/, "");
  const url = `${base}/stream/agg?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(
    timeframe
  )}`;
  let es = null;
  try {
    es = new EventSource(url);
  } catch {
    es = null;
  }
  if (es) {
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const b = msg?.bar;
        const t = toSec(b?.time);
        if (!msg?.ok || !b || !Number.isFinite(t) || t < 1_000_000_000) return;
        onBar?.({
          time: t,
          open: toNum(b.open),
          high: toNum(b.high),
          low: toNum(b.low),
          close: toNum(b.close),
          volume: toNum(b.volume || 0),
        });
      } catch {
        // ignore
      }
    };
  }
  return () => {
    try {
      es?.close?.();
    } catch {}
  };
}
