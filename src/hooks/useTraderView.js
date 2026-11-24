// src/hooks/useTraderView.js
// Trader View v1 — the ONE data hook for /trader-view.
// - One endpoint: GET /api/v1/trader-view?symbol=ES (display-only contract traderView.v1)
// - Polls every 15s (same cadence as the Chart's engine-snapshot poll)
// - Keeps last-good data on a failed refresh; never wipes it
// - Refreshes when the tab becomes visible
// - Mock mode (?mock=1 or REACT_APP_TRADER_VIEW_MOCK=1) serves the live sample
//   fixture from backend PR #374 without any network call.
// Cards never fetch on their own; they only receive props from this hook.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import liveSample from "../pages/traderView/fixtures/live-2026-11-24T0018Z.traderView.v1.json";

const DEFAULT_POLL_MS = 15000;
const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 800;

function env(name) {
  try {
    return String((process.env && process.env[name]) || "").trim();
  } catch {
    return "";
  }
}

function normalizeApiBase(x) {
  const raw = String(x || "").trim();
  if (!raw) return "https://frye-market-backend-1.onrender.com";
  return raw.replace(/\/+$/, "").replace(/\/api\/v1$/i, "").replace(/\/api$/i, "");
}

export const TRADER_VIEW_API_BASE = normalizeApiBase(
  env("REACT_APP_TRADER_VIEW_API_BASE") || env("REACT_APP_API_BASE")
);

export function isTraderViewMock() {
  if (env("REACT_APP_TRADER_VIEW_MOCK") === "1") return true;
  try {
    return new URLSearchParams(window.location.search).get("mock") === "1";
  } catch {
    return false;
  }
}

async function fetchJson(url, signal) {
  const attempt = async () => {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json", "Cache-Control": "no-store" },
      signal,
    });
    const text = await res.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) throw new Error(json?.error || json?.detail || `HTTP ${res.status}`);
    if (!json || json.schema !== "traderView.v1") throw new Error("Unexpected response (not traderView.v1)");
    return json;
  };
  try {
    return await attempt();
  } catch (e) {
    if (signal?.aborted) throw e;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return attempt();
  }
}

export function useTraderView(
  symbol = "ES",
  { pollMs = DEFAULT_POLL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, mock } = {}
) {
  const sym = String(symbol || "ES").toUpperCase();
  const useMock = mock === undefined ? isTraderViewMock() : !!mock;

  const baseUrl = useMemo(
    () => `${TRADER_VIEW_API_BASE}/api/v1/trader-view?symbol=${encodeURIComponent(sym)}&t=`,
    [sym]
  );

  const [state, setState] = useState(() =>
    useMock
      ? { data: liveSample, err: null, lastFetch: new Date().toISOString(), loading: false, refreshing: false }
      : { data: null, err: null, lastFetch: null, loading: true, refreshing: false }
  );

  const pullRef = useRef(() => {});

  useEffect(() => {
    if (useMock) return undefined;

    let alive = true;
    let inFlight = false;
    let timer = null;

    const schedule = () => {
      if (!alive) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(pull, pollMs);
    };

    async function pull() {
      if (!alive) return;
      if (inFlight) return schedule();
      inFlight = true;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      setState((p) => ({ ...p, loading: p.data == null, refreshing: p.data != null }));
      try {
        const data = await fetchJson(`${baseUrl}${Date.now()}`, controller.signal);
        if (alive) {
          setState({ data, err: null, lastFetch: new Date().toISOString(), loading: false, refreshing: false });
        }
      } catch (e) {
        if (alive) {
          setState((p) => ({
            ...p,
            err: String(e?.message || e),
            lastFetch: new Date().toISOString(),
            loading: false,
            refreshing: false,
          }));
        }
      } finally {
        clearTimeout(t);
        inFlight = false;
        schedule();
      }
    }

    pullRef.current = pull;

    const onVis = () => {
      if (alive && !document.hidden) pull();
    };

    pull();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [baseUrl, pollMs, timeoutMs, useMock]);

  const refreshNow = useCallback(() => pullRef.current(), []);

  return {
    data: state.data,
    err: state.err,
    lastFetch: state.lastFetch,
    loading: state.loading,
    refreshing: state.refreshing,
    hasData: !!state.data,
    mock: useMock,
    refreshNow,
    symbol: sym,
  };
}

export default useTraderView;
