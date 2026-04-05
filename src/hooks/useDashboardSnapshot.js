// src/hooks/useDashboardSnapshot.js
// Shared snapshot polling hook (LOCKED)
// ✅ Same endpoint everywhere: /api/v1/dashboard-snapshot?symbol=...&includeContext=1
// ✅ cache-buster t=Date.now()
// ✅ timeout + retry
// ✅ never wipes last-good data on error
// ✅ anti-stall: schedules next poll even if inFlight
// ✅ visibilitychange: triggers pull when tab becomes visible
// ✅ NEW: exposes refreshing + hasData for stale-while-refresh UI

import { useEffect, useMemo, useState } from "react";

/* -------------------- env helpers -------------------- */
function env(name, fb = "") {
  try {
    if (typeof process !== "undefined" && process.env && name in process.env) {
      return String(process.env[name] || "").trim();
    }
  } catch {}
  return fb;
}

function normalizeApiBase(x) {
  const raw = String(x || "").trim();
  if (!raw) return "https://frye-market-backend-1.onrender.com";
  let out = raw.replace(/\/+$/, "");
  out = out.replace(/\/api\/v1$/i, "");
  out = out.replace(/\/api$/i, "");
  return out;
}

const API_BASE = normalizeApiBase(env("REACT_APP_API_BASE", ""));

// 🔒 Defaults match RowStrategies
const DEFAULT_POLL_MS = 20000;
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRY_DELAY_MS = 800;

const nowIso = () => new Date().toISOString();

/* -------------------- fetch helper (LOCKED retry + no-store) -------------------- */
async function safeFetchJson(url, opts = {}) {
  const attempt = async () => {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "Cache-Control": "no-store",
        ...(opts.headers || {}),
      },
      ...opts,
    });

    const text = await res.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        json?.error ||
        json?.detail ||
        (typeof json === "string" ? json : null) ||
        text?.slice(0, 200) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return json;
  };

  try {
    return await attempt();
  } catch (e1) {
    await new Promise((r) => setTimeout(r, DEFAULT_RETRY_DELAY_MS));
    return await attempt();
  }
}

/* -------------------- hook -------------------- */
export function useDashboardSnapshot(
  symbol = "SPY",
  {
    pollMs = DEFAULT_POLL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    includeContext = 1,
  } = {}
) {
  const sym = String(symbol || "SPY").toUpperCase();

  const baseUrl = useMemo(() => {
    return `${API_BASE}/api/v1/dashboard-snapshot?symbol=${encodeURIComponent(
      sym
    )}&includeContext=${encodeURIComponent(String(includeContext))}&t=`;
  }, [sym, includeContext]);

  const [state, setState] = useState({
    data: null,
    err: null,
    lastFetch: null,
    loading: true,
    refreshing: false,
  });

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let timer = null;

    const schedule = (ms) => {
      if (!alive) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(pull, ms);
    };

    async function pull() {
      if (!alive) return;

      if (inFlight) {
        schedule(pollMs);
        return;
      }

      inFlight = true;

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      if (alive) {
        setState((prev) => ({
          ...prev,
          loading: prev.data == null,
          refreshing: prev.data != null,
        }));
      }

      try {
        const url = `${baseUrl}${Date.now()}`;
        const data = await safeFetchJson(url, { signal: controller.signal });

        if (alive) {
          setState((prev) => ({
            ...prev,
            data,
            err: null,
            lastFetch: nowIso(),
            loading: false,
            refreshing: false,
          }));
        }
      } catch (e) {
        const msg = `${String(e?.name || "Error")}: ${String(e?.message || e)}`;
        if (alive) {
          setState((prev) => ({
            ...prev,
            err: msg,
            lastFetch: nowIso(),
            loading: prev.data == null ? false : prev.loading,
            refreshing: false,
          }));
        }
      } finally {
        clearTimeout(t);
        inFlight = false;
        schedule(pollMs);
      }
    }

    function onVis() {
      if (!alive) return;
      try {
        if (!document.hidden) pull();
      } catch {
        pull();
      }
    }

    pull();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [baseUrl, pollMs, timeoutMs]);

  async function refreshNow() {
    setState((prev) => ({
      ...prev,
      loading: prev.data == null,
      refreshing: prev.data != null,
    }));

    try {
      const url = `${baseUrl}${Date.now()}`;
      const data = await safeFetchJson(url);
      setState((prev) => ({
        ...prev,
        data,
        err: null,
        lastFetch: nowIso(),
        loading: false,
        refreshing: false,
      }));
    } catch (e) {
      const msg = `${String(e?.name || "Error")}: ${String(e?.message || e)}`;
      setState((prev) => ({
        ...prev,
        err: msg,
        lastFetch: nowIso(),
        loading: prev.data == null ? false : prev.loading,
        refreshing: false,
      }));
    }
  }

  return {
    data: state.data,
    err: state.err,
    lastFetch: state.lastFetch,
    loading: state.loading,
    refreshing: state.refreshing,
    hasData: !!state.data,
    refreshNow,
    apiBase: API_BASE,
    symbol: sym,
  };
}

export default useDashboardSnapshot;
