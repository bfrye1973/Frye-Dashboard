import { useCallback, useRef, useState } from "react";
import { resolveApiBase } from "./constants";

export default function useOhlc({ apiBase, symbol, timeframe }) {
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const cacheRef = useRef(new Map());
  const key = `${symbol}|${timeframe}`;

  const fetchBars = useCallback(async (force=false) => {
    setError(null); setLoading(true);
    if (abortRef.current) try { abortRef.current.abort(); } catch {}
    const ctl = new AbortController(); abortRef.current = ctl;

    if (!force && cacheRef.current.has(key)) {
      setBars(cacheRef.current.get(key)); setLoading(false); return { ok:true, cached:true };
    }

    const base = resolveApiBase(apiBase);
    const url = `${base}/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&_=${Date.now()}`;

    try {
      const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const data = Array.isArray(j?.bars) ? j.bars : [];
      cacheRef.current.set(key, data);
      setBars(data);
      return { ok:true, count:data.length };
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "Failed to fetch");
      return { ok:false, error:e.message || "Failed to fetch" };
    } finally {
      setLoading(false);
    }
  }, [apiBase, key, symbol, timeframe]);

  return { bars, loading, error, refetch: fetchBars };
}
