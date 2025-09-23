// src/lib/useSectorsFeed.js
// Fetches sectors for 10m / 1h / EOD, exposes current + prior for delta pills.

import { useEffect, useMemo, useRef, useState } from "react";

const URLS = {
  "10m": process.env.REACT_APP_INTRADAY_URL,
  "1h":  process.env.REACT_APP_HOURLY_URL,
  "eod": process.env.REACT_APP_EOD_URL,
};

function pickSafe(v, fallback) {
  return v === undefined || v === null ? fallback : v;
}

export default function useSectorsFeed(initialTf = "10m", pollMs = 60_000) {
  const [timeframe, setTimeframe] = useState(initialTf); 
  const [data, setData] = useState(null);   
  const prevRef = useRef(null);             

  const url = URLS[timeframe];

  useEffect(() => {
    let alive = true;

    async function fetchOnce() {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!alive) return;
        prevRef.current = data;
        setData(json);
      } catch (e) {
        console.error("[sectorsFeed] fetch error:", e);
      }
    }

    fetchOnce();
    const interval =
      timeframe === "eod" ? null : setInterval(fetchOnce, pollMs);

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
    };
  }, [url, timeframe]);

  const updatedAtAZ = useMemo(() => {
    return pickSafe(data?.sectorsUpdatedAt, data?.updated_at) || "";
  }, [data]);

  const sectorCards = data?.sectorCards || [];

  const curSummary = data?.summary || {};
  const prevSummary = prevRef.current?.summary || null;

  const deltas = useMemo(() => {
    if (!prevSummary) return { momentum: null, breadth: null };
    const dMomentum =
      pickSafe(curSummary.momentum_pct, 0) - pickSafe(prevSummary.momentum_pct, 0);
    const dBreadth =
      pickSafe(curSummary.breadth_pct, 0) - pickSafe(prevSummary.breadth_pct, 0);
    return { momentum: dMomentum, breadth: dBreadth };
  }, [curSummary, prevSummary]);

  return {
    timeframe,
    setTimeframe,
    data,
    updatedAtAZ,
    sectorCards,
    global: {
      momentum_pct: curSummary.momentum_pct ?? null,
      breadth_pct: curSummary.breadth_pct ?? null,
      deltas, 
    },
  };
}
