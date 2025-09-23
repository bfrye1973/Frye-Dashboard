// src/services/signalsService.js
// Tiny fetcher for Alignment signals with mock fallback.
// Reads API base from Vite or CRA env, falls back to your Render backend.
// Honors REACT_APP_USE_MOCK=1 or VITE_USE_MOCK=1.

const ENV = (import.meta && import.meta.env) || {};
const USE_MOCK =
  ENV.VITE_USE_MOCK === "1" ||
  ENV.REACT_APP_USE_MOCK === "1" ||
  false;

const API_BASE =
  ENV.VITE_API_BASE ||
  ENV.REACT_APP_API_BASE ||
  "https://frye-market-backend-1.onrender.com";

export async function getAlignmentLatest({ forceMock = false } = {}) {
  if (USE_MOCK || forceMock) return mockAlignment();

  const url = `${API_BASE}/api/signals?strategy=alignment&limit=1`;

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000); // 8s guard

    const res = await fetch(url, { signal: ctl.signal, headers: { "Cache-Control": "no-cache" } });
    clearTimeout(t);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Accept either { ...signal } or { items:[signal] }
    const sig = Array.isArray(data?.items) ? data.items[0] : data;

    // Basic shape check; if missing keys, use mock to avoid UI break
    if (
      !sig ||
      typeof sig !== "object" ||
      !("direction" in sig) ||
      !("confirm_count" in sig) ||
      !("members" in sig)
    ) {
      return mockAlignment({ status: "mock", reason: "shape-mismatch" });
    }

    // Cap confidence at 100, handle none=0
    sig.confidence = Math.max(
      0,
      Math.min(100, Number(sig.confidence ?? 0))
    );

    return { status: "live", signal: sig, apiBase: API_BASE };
  } catch (err) {
    // Fallback to mock if any error
    return mockAlignment({ status: "mock", reason: String(err?.message || err) });
  }
}

// --- Mock factory (matches your confirmed contract) ---
function mockAlignment(meta = { status: "mock" }) {
  const now = new Date();
  const ts = new Date(Math.floor(now.getTime() / (10 * 60 * 1000)) * 10 * 60 * 1000).toISOString();

  const members = {
    SPY: { close: 444.2, ema10: 443.9, ok: true },
    "I:SPX": { close: 5150.1, ema10: 5148.5, ok: true },
    QQQ: { close: 378.75, ema10: 378.2, ok: true },
    IWM: { close: 196.3, ema10: 196.1, ok: true },
    MDY: { close: 524.4, ema10: 524.0, ok: true },
    "I:NDX": { close: 16300, ema10: 16350, ok: false }, // laggard
    "I:DJI": { close: 39550, ema10: 39520, ok: true },
    "I:VIX": { close: 14.2, ema10: 14.5, ok: true }, // inverse handled in backend ok
  };

  const failing = ["I:NDX"];
  const confirm_count = 7;
  const streak_bars = 2;
  const confidence = Math.min(100, (confirm_count / 8) * 100 + (streak_bars - 1) * 5);

  return {
    ...meta,
    signal: {
      timestamp: ts,
      strategy: "alignment",
      timeframe: "10m",
      direction: "long",
      confirm_count,
      streak_bars,
      confidence,
      members,
      failing,
      cooldown_active: false,
    },
    apiBase: "mock",
  };
}
