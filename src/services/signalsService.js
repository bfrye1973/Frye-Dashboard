// src/services/signalsService.js
// CRA-safe signals fetcher (no import.meta; guards around `process` and `window`).
// Returns { status: "live"|"mock"|"error", signal: {...}|null, apiBase: string }

function getEnv(name, fallback = "") {
  try {
    // CRA inlines process.env.NAME at build, but `process` may not exist at runtime.
    if (typeof process !== "undefined" && process.env && name in process.env) {
      return (process.env[name] || "").trim();
    }
  } catch {}
  return fallback;
}

function getOrigin() {
  try {
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch {}
  return "";
}

const ENV_API = getEnv("REACT_APP_API_BASE", "");
const API_BASE = (ENV_API || getOrigin()).replace(/\/$/, ""); // strip trailing slash

const FRONT_MOCK = getEnv("REACT_APP_USE_MOCK", "") === "1";

/**
 * Normalize backend payload to a stable shape.
 */
function normalizePayload(data) {
  const status = (data && data.status) ? String(data.status) : "live";
  let sig = null;

  if (Array.isArray(data?.items) && data.items.length) {
    sig = data.items[0];
  } else if (data && data.signal) {
    sig = data.signal;
  }

  if (!sig || typeof sig !== "object") {
    return { status, signal: null };
  }

  const direction   = String(sig.direction ?? "none");
  const streak_bars = Number(sig.streak_bars ?? 0);
  const confidence  = Math.max(0, Math.min(100, Number(sig.confidence ?? 0)));
  const timestamp   = sig.timestamp ?? null;
  const failing     = Array.isArray(sig.failing) ? sig.failing : [];

  return { status, signal: { direction, streak_bars, confidence, timestamp, failing } };
}

/**
 * Public: fetch latest Alignment signal (backend only).
 */
export async function getAlignmentLatest() {
  if (FRONT_MOCK) return mockAlignment({ status: "mock(front)" });

  // If we somehow don't have a base, fail safely to mock (don't crash UI).
  if (!API_BASE) return mockAlignment({ status: "mock(no-base)" });

  // Cache-buster param to bypass CDN/browser caches.
  const url = `${API_BASE}/api/signals?strategy=alignment&limit=1&t=${Date.now()}`;

  try {
    const supportsAbort = typeof AbortController !== "undefined";
    const ctl = supportsAbort ? new AbortController() : null;
    const toId = supportsAbort ? setTimeout(() => ctl.abort(), 8000) : null;

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
      signal: ctl ? ctl.signal : undefined,
    });

    if (toId) clearTimeout(toId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const { status, signal } = normalizePayload(data);

    if (!signal) {
      // Explicit empty → harmless fallback (no crash, shows MOCK/Flat)
      return mockAlignment({ status: status === "live" ? "mock(empty)" : status });
    }

    return { status, signal, apiBase: API_BASE };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[signalsService] alignment fetch error:", err?.message || err);
    return mockAlignment({ status: "mock(error)" });
  }
}

/**
 * Mock payload — safe fallback so the UI never hard-crashes.
 */
function mockAlignment(meta) {
  const now = Date.now();
  const bucket = Math.floor(now / (10 * 60 * 1000)) * 10 * 60 * 1000; // nearest 10m close
  return {
    status: meta?.status || "mock",
    signal: {
      direction: "long",
      streak_bars: 2,
      confidence: 93,
      timestamp: new Date(bucket).toISOString(),
      failing: ["I:NDX"], // sample laggard for visibility
    },
    apiBase: "mock",
  };
}

export default getAlignmentLatest;
