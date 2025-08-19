// src/services/feed.js
// Backend OHLC with safe mock fallback + debug markers.

function normalizeTf(tf = "1D") {
  const t = String(tf).toLowerCase();
  if (t === "1h" || t === "1m" || t === "1d") return t;
  // map variants like "1H" -> "1h"
  return t.replace("h", "h").replace("m", "m").replace("d", "d");
}
function tfToSeconds(tf = "1d") {
  const t = normalizeTf(tf);
  return { "1m": 60, "1h": 3600, "1d": 86400 }[t] ?? 86400;
}
function toSec(x) {
  if (x == null) return null;
  if (typeof x === "number") return x > 1e12 ? Math.floor(x / 1000) : x;
  const d = Date.parse(x);
  return Number.isNaN(d) ? null : Math.floor(d / 1000);
}
function normalizeBars(raw = []) {
  return raw
    .map((b) => {
      const time =
        toSec(b.time ?? b.t ?? b.timestamp ?? b.ts) ??
        (typeof b.date === "string" ? toSec(b.date) : null);
      if (!time) return null;
      const o = +b.open ?? +b.o ?? NaN;
      const h = +b.high ?? +b.h ?? NaN;
      const l = +b.low ?? +b.l ?? NaN;
      const c = +b.close ?? +b.c ?? NaN;
      const v = +b.volume ?? +b.v ?? 0;
      if ([o, h, l, c].some(Number.isNaN)) return null;
      return { time, open: o, high: h, low: l, close: c, volume: v };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

// --------- mock fallback ----------
function genHistory({ bars = 200, base = 100, tfSec = 3600 }) {
  const now = Math.floor(Date.now() / 1000);
  let px = base;
  const out = [];
  for (let i = bars - 1; i >= 0; i--) {
    const t = now - i * tfSec;
    const drift = (Math.random() - 0.5) * 0.8;
    const o = px;
    const c = Math.max(0.01, o + drift);
    const h = Math.max(o, c) + Math.random() * 0.4;
    const l = Math.min(o, c) - Math.random() * 0.4;
    const v = Math.floor(1000 + Math.random() * 5000);
    out.push({ time: t, open: o, high: h, low: l, close: c, volume: v });
    px = c;
  }
  return out;
}
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}

// --------- main API ----------
export function getFeed(symbol = "MSFT", timeframe = "1D") {
  const tf = normalizeTf(timeframe);
  const tfSec = tfToSeconds(tf);

  const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "";
  // cache-buster to defeat intermediate caches
  const cb = Date.now().toString(36);
  const url = `${API_BASE}/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(tf)}&cb=${cb}`;

  let timer = null;

  return {
    async history() {
      try {
        console.info("[feed] GET", url);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const bars = normalizeBars(json);
        console.info("[feed] backend bars:", bars.length);
        if (!bars.length) throw new Error("empty");
        if (typeof window !== "undefined") window.__FEED_SOURCE = "backend";
        return bars;
      } catch (e) {
        const base = (Math.abs(hashCode(`${symbol}:${tf}`)) % 200) + 50;
        const mock = genHistory({ bars: 200, base, tfSec });
        console.warn("[feed] fallback to mock, reason:", e?.message);
        if (typeof window !== "undefined") window.__FEED_SOURCE = "mock";
        return mock;
      }
    },

    subscribe(onBar) {
      const pollMs = Math.min(tfSec * 1000, 5000);
      timer = setInterval(async () => {
        try {
          const cb2 = Date.now().toString(36);
          const res = await fetch(`${url}&limit=2&cb2=${cb2}`, { cache: "no-store" });
          if (!res.ok) return;
          const bars = normalizeBars(await res.json());
          const last = bars[bars.length - 1];
          if (last) onBar({ ...last });
        } catch {}
      }, pollMs);
      return () => clearInterval(timer);
    },

    close() {
      if (timer) clearInterval(timer);
    },
  };
}
