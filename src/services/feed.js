// src/services/feed.js
// Robust backend OHLC with mock fallback + on-screen debug
// Auto-detects shapes: array of objects, {data|results|bars|candles: []},
// column arrays {t,o,h,l,c,v}, or array-of-arrays [t,o,h,l,c,(v)].

function normalizeTf(tf = "1D") {
  const t = String(tf).toLowerCase();
  // ✅ now recognizes 10m
  return (t === "1m" || t === "10m" || t === "1h" || t === "1d") ? t : "1d";
}
function tfToSeconds(tf = "1d") {
  // ✅ map 10m to 600 seconds
  return { "1m": 60, "10m": 600, "1h": 3600, "1d": 86400 }[normalizeTf(tf)];
}
function toSec(x) {
  if (x == null) return null;
  if (typeof x === "number") return x > 1e12 ? Math.floor(x / 1000) : x;
  const d = Date.parse(x);
  return Number.isNaN(d) ? null : Math.floor(d / 1000);
}
function num(x) {
  const n = +x;
  return Number.isFinite(n) ? n : NaN;
}

// ---- shape normalizers ----
function fromArrayOfObjects(arr) {
  const out = [];
  for (const b of arr) {
    const time =
      toSec(b.time ?? b.t ?? b.timestamp ?? b.ts) ??
      (typeof b.date === "string" ? toSec(b.date) : null);
    const o = num(b.open ?? b.o);
    const h = num(b.high ?? b.h);
    const l = num(b.low ?? b.l);
    const c = num(b.close ?? b.c);
    const v = num(b.volume ?? b.v ?? 0);
    if (!time || [o, h, l, c].some(Number.isNaN)) continue;
    out.push({ time, open: o, high: h, low: l, close: c, volume: v });
  }
  return { bars: out.sort((a, b) => a.time - b.time), shape: "array<obj>" };
}

function fromArrayOfArrays(arr) {
  // Supports [t,o,h,l,c] or [t,o,h,l,c,v]
  const out = [];
  for (const row of arr) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [t, o, h, l, c, v = 0] = row;
    const time = toSec(t);
    const no = num(o), nh = num(h), nl = num(l), nc = num(c), nv = num(v ?? 0);
    if (!time || [no, nh, nl, nc].some(Number.isNaN)) continue;
    out.push({ time, open: no, high: nh, low: nl, close: nc, volume: nv });
  }
  return { bars: out.sort((a, b) => a.time - b.time), shape: "array<array>" };
}

function fromColumnArrays(obj) {
  // e.g. { t:[], o:[], h:[], l:[], c:[], v:[] } or long names
  const T = obj.t ?? obj.time ?? obj.timestamp ?? obj.ts;
  const O = obj.o ?? obj.open;
  const H = obj.h ?? obj.high;
  const L = obj.l ?? obj.low;
  const C = obj.c ?? obj.close;
  const V = obj.v ?? obj.volume ?? [];
  if (!Array.isArray(T) || !Array.isArray(O) || !Array.isArray(H) || !Array.isArray(L) || !Array.isArray(C)) {
    return { bars: [], shape: "unknown" };
  }
  const n = Math.min(T.length, O.length, H.length, L.length, C.length, Array.isArray(V) ? V.length : Infinity);
  const out = [];
  for (let i = 0; i < n; i++) {
    const time = toSec(T[i]);
    const o = num(O[i]), h = num(H[i]), l = num(L[i]), c = num(C[i]);
    const v = Array.isArray(V) ? num(V[i]) : 0;
    if (!time || [o, h, l, c].some(Number.isNaN)) continue;
    out.push({ time, open: o, high: h, low: l, close: c, volume: v });
  }
  return { bars: out.sort((a, b) => a.time - b.time), shape: "columns" };
}

function pickArrayProp(obj) {
  for (const k of ["data", "results", "bars", "candles", "items"]) {
    if (Array.isArray(obj?.[k])) return { arr: obj[k], key: k };
  }
  return { arr: null, key: null };
}

function normalizeAny(json) {
  if (Array.isArray(json)) {
    // array<obj> or array<array>?
    const looksObj = json.length && typeof json[0] === "object" && !Array.isArray(json[0]);
    return looksObj ? fromArrayOfObjects(json) : fromArrayOfArrays(json);
  }
  if (json && typeof json === "object") {
    const { arr, key } = pickArrayProp(json);
    if (arr) {
      const res = Array.isArray(arr[0]) ? fromArrayOfArrays(arr) : fromArrayOfObjects(arr);
      return { ...res, shape: `${res.shape} via ${key}` };
    }
    // column arrays
    const res = fromColumnArrays(json);
    if (res.bars.length) return res;
  }
  return { bars: [], shape: "unrecognized" };
}

// ---- mock fallback ----
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

// ---- main feed ----
export function getFeed(symbol = "MSFT", timeframe = "1D") {
  const tf = normalizeTf(timeframe);
  const tfSec = tfToSeconds(tf);
  const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "";
  const baseUrl = `${API_BASE}/api/v1/ohlc`;
  const urlBase = `${baseUrl}?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(tf)}`;
  let timer = null;

  const setDebug = (patch) => {
    if (typeof window === "undefined") return;
    window.__FEED_DEBUG__ = { ...(window.__FEED_DEBUG__ || {}), ...patch };
  };

  return {
    async history() {
      try {
        const cb = Date.now().toString(36);
        const url = `${urlBase}&cb=${cb}`;
        console.info("[feed] GET", url);
        setDebug({ source: "fetching", url, shape: "-", bars: 0 });

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const { bars, shape } = normalizeAny(json);
        if (!bars.length) throw new Error(`empty (${shape})`);

        console.info("[feed] backend bars:", bars.length, "shape:", shape);
        setDebug({ source: "backend", url, shape, bars: bars.length });
        return bars;
      } catch (e) {
        const base = (Math.abs(hashCode(`${symbol}:${tf}`)) % 200) + 50;
        const mock = genHistory({ bars: 200, base, tfSec });
        console.warn("[feed] fallback to mock, reason:", e?.message);
        setDebug({ source: `mock: ${e?.message || "error"}`, shape: "mock", bars: mock.length });
        return mock;
      }
    },

    subscribe(onBar) {
      const pollMs = Math.min(tfSec * 1000, 5000);
      timer = setInterval(async () => {
        try {
          const cb2 = Date.now().toString(36);
          const res = await fetch(`${urlBase}&limit=2&cb=${cb2}`, { cache: "no-store" });
          if (!res.ok) return;
          const json = await res.json();
          const { bars } = normalizeAny(json);
          const last = bars[bars.length - 1];
          if (last) onBar({ ...last });
        } catch {}
      }, pollMs);
      return () => clearInterval(timer);
    },

    close() { if (timer) clearInterval(timer); },
  };
}
