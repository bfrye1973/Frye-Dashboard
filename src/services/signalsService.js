// src/services/signalsService.js
// Direct backend fetch (no /dynamic), cache-busted & mock-safe.
// Returns shape: { status: "live"|"mock"|"error", signal: {...} | null, apiBase: string }

const ENV = (import.meta?.env ?? {});
const FRONT_MOCK =
  ENV.VITE_USE_MOCK === "1" ||
  ENV.REACT_APP_USE_MOCK === "1" ||
  false;

// Backend base: explicit env first, then CRA env, then same-origin (last resort).
const API_BASE =
  ENV.VITE_API_BASE ||
  process?.env?.REACT_APP_API_BASE ||
  window.location.origin;

export async function getAlignmentLatest() {
  // If frontend is explicitly in mock mode, return a mock payload immediately.
  if (FRONT_MOCK) return mockAlignment({ status: "mock(front)" });

  const url = `${API_BASE.replace(/\/$/, "")}/api/signals?strategy=alignment&limit=1&t=${Date.now()}`;

  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000); // 8s guard

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
      signal: ctl.signal,
    });
    clearTimeout(to);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Accept both shapes:
    // 1) { status, items: [ signal ] }
    // 2) { status, signal }
    const status = data?.status ?? "live";
    let sig = null;
    if (Array.isArray(data?.items) && data.items.length) sig = data.items[0];
    else if (data?.signal) sig = data.signal;

    // Normalize and guard
    if (!sig || typeof sig !== "object") {
      return { status: "error", signal: null, apiBase: API_BASE };
    }

    const direction = (sig.direction ?? "none");
    const streak_bars = Number(sig.streak_bars ?? 0);
    const confidence = Math.max(0, Math.min(100, Number(sig.confidence ?? 0)));
    const timestamp = sig.timestamp ?? null;
    const failing = Array.isArray(sig.failing) ? sig.failing : [];

    const normalized = { direction, streak_bars, confidence, timestamp, failing };

    return { status, signal: normalized, apiBase: API_BASE };
  } catch (err) {
    // On any error, return explicit error; do NOT silently fake a live value.
    return mockAlignment({ status: "mock(error-fallback)" });
  }
}

function mockAlignment(meta) {
  const now = Date.now();
  const bucket = Math.floor(now / (10 * 60 * 1000)) * 10 * 60 * 1000;
  const ts = new Date(bucket).toISOString();
  const confirm = 7;                 // emulate a 7/8 alignment
  const streak = 2;
  const confidence = Math.min(100, (confirm / 8) * 100 + (streak - 1) * 5);

  return {
    status: meta?.status || "mock",
    signal: {
      direction: "long",
      streak_bars: streak,
      confidence,
      timestamp: ts,
      failing: ["I:NDX"],           // sample laggard
    },
    apiBase: "mock",
  };
}
