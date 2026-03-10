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

// ---------------- Shared SSE registry ----------------
// Goal: only ONE EventSource per URL inside this page/session.
// Multiple callers can subscribe to the same URL and receive the same messages.

const streamRegistry = new Map();

function getStreamKey(url) {
  return url;
}

function createSharedStream(url) {
  const entry = {
    url,
    es: null,
    closed: false,
    reconnecting: false,
    lastMsgAt: Date.now(),
    lastBarAt: Date.now(),
    watchdog: null,
    refCount: 0,
    barListeners: new Set(),
    aliveListeners: new Set(),
  };

  const cleanupES = () => {
    try {
      if (entry.es) {
        entry.es.onopen = null;
        entry.es.onmessage = null;
        entry.es.onerror = null;
        entry.es.close();
      }
    } catch {}
    entry.es = null;
  };

  const fanoutAlive = (msg) => {
    entry.aliveListeners.forEach((fn) => {
      try {
        fn?.(msg);
      } catch {}
    });
  };

  const fanoutBar = (bar) => {
    entry.barListeners.forEach((fn) => {
      try {
        fn?.(bar);
      } catch {}
    });
  };

  const start = () => {
    if (entry.closed) return;
    if (entry.reconnecting) return;
    entry.reconnecting = true;

    cleanupES();

    const es = new EventSource(entry.url);
    entry.es = es;

    es.onopen = () => {
      entry.lastMsgAt = Date.now();
      entry.reconnecting = false;
    };

    es.onmessage = (ev) => {
      if (!ev?.data || ev.data.trim() === "") return;

      entry.lastMsgAt = Date.now();

      try {
        const msg = JSON.parse(ev.data);

        // any JSON message means stream transport is alive
        fanoutAlive(msg);

        if (msg?.type === "bar" && msg.bar) {
          entry.lastBarAt = Date.now();

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
            fanoutBar(bar);
          }
        }
      } catch {
        // ignore parse issues, do not kill stream
      }
    };

    es.onerror = () => {
      // let watchdog decide whether to rebuild
      entry.reconnecting = false;
    };

    if (!entry.watchdog) {
      entry.watchdog = setInterval(() => {
        if (entry.closed) return;

        const now = Date.now();
        const msgAge = now - entry.lastMsgAt;
        const barAge = now - entry.lastBarAt;

        // 1) Full transport stall: no JSON messages at all
        if (msgAge > 15_000) {
          start();
          return;
        }

        // 2) Chart/data stall: transport alive but no new bars
        // Only apply this to intraday live streams where bars should keep flowing.
        if (barAge > 20_000) {
          start();
        }
      }, 5_000);
    }
  };

  entry.start = start;
  entry.destroy = () => {
    entry.closed = true;
    try {
      if (entry.watchdog) clearInterval(entry.watchdog);
    } catch {}
    entry.watchdog = null;
    cleanupES();
  };

  start();
  return entry;
}

// ---------------- Live SSE subscribe ----------------
// subscribeStream(symbol, timeframe, onBar, onAlive)
// - onBar(bar): called only for type:"bar"
// - onAlive(msg): optional, called for ANY parsed JSON message (snapshot/diag/bar)
//
// IMPORTANT:
// - only one EventSource per URL per page
// - multiple callers share one stream
// - reconnect is serialized
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

  const key = getStreamKey(url);

  let entry = streamRegistry.get(key);
  if (!entry) {
    entry = createSharedStream(url);
    streamRegistry.set(key, entry);
  }

  entry.refCount += 1;

  if (typeof onBar === "function") {
    entry.barListeners.add(onBar);
  }
  if (typeof onAlive === "function") {
    entry.aliveListeners.add(onAlive);
  }

  if (!entry.es && !entry.closed) {
    entry.start?.();
  }

  return () => {
    try {
      if (typeof onBar === "function") {
        entry.barListeners.delete(onBar);
      }
      if (typeof onAlive === "function") {
        entry.aliveListeners.delete(onAlive);
      }
    } catch {}

    entry.refCount = Math.max(0, entry.refCount - 1);

    if (entry.refCount === 0) {
      try {
        entry.destroy?.();
      } catch {}
      streamRegistry.delete(key);
    }
  };
}

export default { getOHLC, fetchOHLCResilient, subscribeStream };
