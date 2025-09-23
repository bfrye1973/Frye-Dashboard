// src/services/signalsService.js
// CRA-safe: uses process.env.REACT_APP_API_BASE (no import.meta).
// Fetches backend directly with cache-buster and returns a normalized shape:
// { status: "live"|"mock"|"error", signal: {direction, streak_bars, confidence, timestamp, failing} | null, apiBase: string }

const API_BASE = (
  (process && process.env && process.env.REACT_APP_API_BASE) ||
  (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/$/, "");

const FRONT_MOCK =
  (process && process.env && process.env.REACT_APP_USE_MOCK === "1") || false;

export async function getAlignmentLatest() {
  if (FRONT_MOCK) return mockAlignment({ status: "mock(front)" });

  const url = `${API_BASE}/api/signals?strategy=alignment&limit=1&t=${Date.now()}`;

  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000);

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
      signal: ctl.signal,
    });
    clearTimeout(to);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    const status = data && data.status ? String(data.status) : "live";
    let sig = null;
    if (Array.isArray(data?.items) && data.items.length) sig = data.items[0];
    else if (data && data.signal) sig = data.signal;

    if (!sig || typeof sig !== "object") {
      return { status: "error", signal: null, apiBase: API_BASE };
    }

    const normalized = {
      direction: String(sig.direction ?? "none"),
      streak_bars: Number(sig.streak_bars ?? 0),
      confidence: Math.max(0, Math.min(100, Number(sig.confidence ?? 0))),
      timestamp: sig.timestamp ?? null,
      failing: Array.isArray(sig.failing) ? sig.failing : [],
    };

    return { status, signal: normalized, apiBase: API_BASE };
  } catch (err) {
    // explicit, harmless fallback (never crash UI)
    return mockAlignment({ status: "mock(error-fallback)" });
  }
}

function mockAlignment(meta) {
  const now = Date.now();
  const bucket = Math.floor(now / (10 * 60 * 1000)) * 10 * 60 * 1000;
  return {
    status: meta?.status || "mock",
    signal: {
      direction: "long",
      streak_bars: 2,
      confidence: 93,
      timestamp: new Date(bucket).toISOString(),
      failing: ["I:NDX"],
    },
    apiBase: "mock",
  };
}
