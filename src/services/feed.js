// src/services/feed.js
// Minimal OHLC feed adapter for Lightweight Charts (history + poll).
// Calls backend /api/v1/ohlc with clean timeframe normalization.

const API_BASE = (window.__API_BASE__ || "").replace(/\/+$/, ""); // strip trailing slashes
const OHLC_PATH = "/api/v1/ohlc";

function normalizeTf(tf = "1d") {
  const t = String(tf).toLowerCase();
  // accept your supported set
  if (t === "1m" || t === "5m" || t === "10m" || t === "15m" || t === "30m" || t === "1h" || t === "1d") {
    return t;
  }
  // map common variants
  if (t === "1h" || t === "1hr" || t === "60m") return "1h";
  if (t === "1d" || t === "d" || t === "day") return "1d";
  // default
  return "1d";
}

function toNumber(n, d = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : d;
}

export function getFeed(symbol = "SPY", timeframe = "1d") {
  const tf = normalizeTf(timeframe);
  const base = `${API_BASE}${OHLC_PATH}?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(tf)}`;

  let stopped = false;
  let ctrl = null;

  return {
    async history() {
      const url = `${base}&t=${Date.now()}`;
      ctrl = new AbortController();
      const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!r.ok) throw new Error(`ohlc ${r.status}`);
      const j = await r.json();
      const arr = Array.isArray(j?.bars) ? j.bars : [];
      // Lightweight Charts expects seconds since epoch
      return arr
        .map(b => ({
          time: toNumber(b.time),         // backend returns seconds; if ms, divide by 1000
          open: toNumber(b.open),
          high: toNumber(b.high),
          low:  toNumber(b.low),
          close:toNumber(b.close),
          volume: toNumber(b.volume, 0),
        }))
        .sort((a, b) => a.time - b.time);
    },

    subscribe(onBar) {
      // simple 5s poll for last bar
      const id = setInterval(async () => {
        try {
          const url = `${base}&limit=2&t=${Date.now()}`;
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) return;
          const j = await r.json();
          const arr = Array.isArray(j?.bars) ? j.bars : [];
          const last = arr[arr.length - 1];
          if (!last) return;
          onBar({
            time: toNumber(last.time),
            open: toNumber(last.open),
            high: toNumber(last.high),
            low:  toNumber(last.low),
            close:toNumber(last.close),
            volume: toNumber(last.volume, 0),
          });
        } catch {
          // swallow; keep polling
        }
      }, 5000);
      return () => clearInterval(id);
    },

    close() {
      stopped = true;
      try { ctrl?.abort(); } catch {}
    },
  };
}
