// src/hooks/usePaperStatus.js
// Read-only subscriber to Backend-2 /paper/status (SSE).
// Does not change any UI by itself — we’ll wire it in the next step.

import { useEffect, useMemo, useRef, useState } from "react";

function getStreamBase() {
  // CRA env or Vite env → fallback to your known streamer origin
  return (
    (typeof process !== "undefined" && process.env && (process.env.REACT_APP_STREAM_BASE || process.env.VITE_STREAM_BASE)) ||
    (typeof window !== "undefined" && window.__STREAM_BASE__) ||
    "https://frye-market-backend-2.onrender.com"
  ).replace(/\/+$/, "");
}

export default function usePaperStatus() {
  const STREAM_BASE = useMemo(getStreamBase, []);
  const url = useMemo(() => `${STREAM_BASE}/paper/status`, [STREAM_BASE]);

  const esRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState({ ts: 0, positions: {}, orders: [] });

  useEffect(() => {
    let alive = true;

    try {
      const es = new EventSource(url, { withCredentials: false });
      esRef.current = es;

      es.onopen = () => {
        if (!alive) return;
        setConnected(true);
        setError(null);
        // console.log("[paper] status stream connected");
      };

      es.onerror = (e) => {
        if (!alive) return;
        setConnected(false);
        setError("Stream error");
        // Note: browser auto-reconnects EventSource
      };

      es.onmessage = (ev) => {
        if (!alive) return;
        if (!ev?.data) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === "paper/status" && msg?.snapshot) {
            setSnapshot(msg.snapshot);
            // For now, just a breadcrumb log. We’ll render in next step.
            // console.log("[paper] snapshot", msg.snapshot);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
    } catch (e) {
      setConnected(false);
      setError(e?.message || "Failed to open EventSource");
    }

    return () => {
      alive = false;
      try { esRef.current?.close?.(); } catch {}
      esRef.current = null;
    };
  }, [url]);

  return { connected, error, snapshot, streamBase: STREAM_BASE };
}
