// src/lib/dashboardApi.js
import { useEffect, useRef, useState } from "react";

const BASE_URL = "https://frye-market-backend-1.onrender.com";

/** Fetch the dashboard JSON once */
export async function fetchDashboard() {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 8000);

  const res = await fetch(`${BASE_URL}/api/dashboard`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: ctrl.signal
  });
  clearTimeout(id);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`dashboard ${res.status}: ${text || "request failed"}`);
  }
  return res.json();
}

/** Poller hook: returns {data, loading, error, refresh} */
export function useDashboardPoll(intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timer = useRef(null);

  async function loadOnce() {
    try {
      setError("");
      const json = await fetchDashboard();
      setData(json);
    } catch (e) {
      setError(e?.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOnce(); // initial
    timer.current = setInterval(loadOnce, intervalMs);
    return () => timer.current && clearInterval(timer.current);
  }, [intervalMs]);

  return { data, loading, error, refresh: loadOnce };
}
