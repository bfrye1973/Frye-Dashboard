const WS_URL = (process && process.env && (
  process.env.REACT_APP_WS_BASE ||
  process.env.API_WS_BASE ||
  process.env.VITE_WS_BASE_URL
)) || "wss://frye-market-backend-1.onrender.com";

export function openMarketSocket(handlers = {}) {
  let ws = null;
  let stopped = false;
  let retry = 500;

  const connect = () => {
    if (stopped) return;
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { retry = 500; handlers.onOpen && handlers.onOpen(); };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const list = Array.isArray(msg) ? msg : [msg];
        for (const m of list) {
          if (m.type === "metrics" && handlers.onMetrics) {
            handlers.onMetrics(m.payload);
          } else if (m.type === "bar" && handlers.onBar) {
            const p = m.payload || {};
            const raw = p.time ?? p.t;
            const time = Math.round(raw / (raw > 2_000_000_000 ? 1000 : 1));
            handlers.onBar({
              ticker: p.ticker ?? p.sym,
              time,
              open: p.open ?? p.o,
              high: p.high ?? p.h,
              low: p.low ?? p.l,
              close: p.close ?? p.c,
              volume: p.volume ?? p.v,
            });
          }
        }
      } catch {}
    };
    ws.onerror = (e) => { handlers.onError && handlers.onError(e); };
    ws.onclose = () => {
      handlers.onClose && handlers.onClose();
      if (stopped) return;
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 4000);
    };
  };

  connect();
  return () => { stopped = true; try { ws && ws.close(); } catch {} };
}
