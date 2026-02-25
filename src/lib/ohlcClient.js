// src/lib/ohlcClient.js
// Canonical OHLC client (direct TF fetch from backend-1 + SSE stream from backend-2)

const BACKEND =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const STREAM_BASE =
  (typeof window !== "undefined" && (window.__STREAM_BASE__ || "")) ||
  process.env.REACT_APP_STREAM_BASE ||
  ""; // e.g. https://frye-market-backend-2.onrender.com

const API = (BACKEND || "").replace(/\/+$/, "");

// ---------------- utils ----------------
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

const isMs = (t) => typeof t === "number" && t > 1e12;
const toSec = (t) => (isMs(t) ? Math.floor(t / 1000) : Number(t));

function normalizeTf(tf) {
  const t = String(tf || "10m").toLowerCase().trim();
  return TF_SEC[t] ? t : "10m";
}

function clampLimit(n, fallback = 1500) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return fallback;
  return Math.max(1, Math.min(50000, Math.floor(x)));
}

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
    )
    .sort((a, b) => a.time - b.time);
}

// ---------------- API: getOHLC ----------------
// OPTION B: Fetch requested timeframe directly from backend-1.
export async function getOHLC(symbol = "SPY", timeframe = "10m", limit = 1500) {
  const sym = String(symbol || "SPY").toUpperCase();
  const tf = normalizeTf(timeframe);
  const safeLimit = clampLimit(limit, 1500);

  const url =
    `${API}/api/v1/ohlc?symbol=${encodeURIComponent(sym)}` +
    `&timeframe=${encodeURIComponent(tf)}` +
    `&limit=${encodeURIComponent(safeLimit)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`OHLC ${r.status}`);

  const data = await r.json().catch(() => null);
  const raw = Array.isArray(data) ? data : Array.isArray(data?.bars) ? data.bars : [];
  const bars = normalizeBars(raw);

  return bars.length > safeLimit ? bars.slice(-safeLimit) : bars;
}

// ---------------- API: compat shim ----------------
export async function fetchOHLCResilient({ symbol, timeframe, limit = 1500 }) {
  const bars = await getOHLC(symbol, timeframe, limit);
  return { source: "api/v1/ohlc (direct tf)", bars };
}

// ---------------- Live SSE subscribe ----------------
// FIX: Auto-heal if EventSource goes "stale" (Render/proxy stall) without requiring page refresh.
// Backend sends diag every 5s and ping every 15s. If we receive nothing for 35s, rebuild connection.
//
// ✅ NEW (for LIVE indicator):
// subscribeStream(symbol, timeframe, onBar, onAlive)
// - onBar(bar): called only for type:"bar"
// - onAlive(msg): optional, called for ANY parsed JSON message (snapshot/diag/bar)
export function subscribeStream(symbol, timeframe, onBar, onAlive) {
  if (!STREAM_BASE) {
    console.warn("[subscribeStream] STREAM_BASE missing");
    return () => {};
  }

  const sym = String(symbol || "SPY").toUpperCase();
  const tf = normalizeTf(timeframe);

  const url =
    `${STREAM_BASE.replace(/\/+$/, "")}/stream/agg` +
    `?symbol=${encodeURIComponent(sym)}` +
    `&tf=${encodeURIComponent(tf)}` +
    `&mode=rth`;

  let es = null;
  let closed = false;

  let lastMsgAt = Date.now();
  let watchdog = null;

  const cleanupES = () => {
    try {
      es?.close();
    } catch {}
    es = null;
  };

  const start = () => {
    cleanupES();
    if (closed) return;

    es = new EventSource(url);

    es.onopen = () => {
      lastMsgAt = Date.now();
      // console.log("[subscribeStream] open", sym, tf);
    };

    es.onmessage = (ev) => {
      if (!ev?.data || ev.data.trim() === "") return;

      // Any message (snapshot/diag/bar) counts as alive
      lastMsgAt = Date.now();

      try {
        const msg = JSON.parse(ev.data);

        // ✅ NEW: notify "alive" listener for LIVE indicator
        if (typeof onAlive === "function") {
          try {
            onAlive(msg);
          } catch {
            // never let UI callback break stream
          }
        }

        // Forward only bars to the chart
        if (msg?.type === "bar" && msg.bar) {
          const b = msg.bar;
          const bar = {
            time: toSec(b.time ?? b.t ?? b.ts ?? b.timestamp),
            open: Number(b.open ?? b.o),
            high: Number(b.high ?? b.h),
            low: Number(b.low ?? b.l),
            close: Number(b.close ?? b.c),
            volume: Number(b.volume ?? b.v ?? 0),
          };
          if (Number.isFinite(bar.time) && Number.isFinite(bar.open)) {
            onBar(bar);
          }
        }
      } catch {
        // do not kill stream on parse errors
      }
    };

    // IMPORTANT: do not close on error; allow native auto-reconnect.
    // But ALSO keep watchdog to force rebuild if the connection stalls silently.
    es.onerror = () => {
      // intentionally empty
    };

    if (!watchdog) {
      watchdog = setInterval(() => {
        if (closed) return;
        const age = Date.now() - lastMsgAt;

        // If no diag/snapshot/bar for too long, the stream is stale -> rebuild.
        if (age > 35_000) {
          // console.warn("[subscribeStream] stale -> reconnect", { sym, tf, age });
          start();
        }
      }, 5_000);
    }
  };

  start();

  return () => {
    closed = true;
    try {
      if (watchdog) clearInterval(watchdog);
    } catch {}
    watchdog = null;
    cleanupES();
  };
}

export default { getOHLC, fetchOHLCResilient, subscribeStream };
