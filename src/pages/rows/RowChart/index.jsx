// === SSE live stream: instant last-candle updates ===
useEffect(() => {
  // do not stream daily
  if (state?.timeframe === "1d") return;
  if (!seriesRef?.current) return;

  const API_BASE =
    (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
    "https://frye-market-backend-1.onrender.com";

  const url =
    `${API_BASE.replace(/\/+$/, "")}/stream/agg` +
    `?symbol=${encodeURIComponent(state.symbol)}` +
    `&tf=${encodeURIComponent(state.timeframe)}`;

  const es = new EventSource(url);

  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (!msg?.ok || !msg?.bar) return;

      const b = msg.bar;
      const live = {
        time: Number(b.time),             // seconds epoch (bucket start)
        open: Number(b.open),
        high: Number(b.high),
        low:  Number(b.low),
        close:Number(b.close),
        volume: Number(b.volume || 0),
      };

      // push into chart
      seriesRef.current?.update(live);
      volSeriesRef.current?.update?.({
        time: live.time,
        value: live.volume,
        color: live.close >= live.open
          ? "rgba(38,166,154,0.5)"
          : "rgba(239,83,80,0.5)",
      });

      // keep local bars if your file relies on it elsewhere
      setBars?.((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return [live];
        const last = prev[prev.length - 1];
        if (last?.time === live.time) {
          const next = prev.slice();
          next[next.length - 1] = live;
          return next;
        }
        if (!last || live.time > last.time) return [...prev, live];
        return prev;
      });
    } catch {}
  };

  // Let EventSource auto-reconnect; no manual close on errors
  es.onerror = () => { /* keep connection alive */ };

  return () => es.close();
}, [state.symbol, state.timeframe]);
