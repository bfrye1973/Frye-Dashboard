import type { WsMsg } from '../types/market';

const WS_URL = process.env.REACT_APP_WS_BASE!;

type Handlers = {
  onMetrics?: (m:any)=>void;
  onBar?: (b:any)=>void;
  onOpen?: ()=>void;
  onClose?: ()=>void;
  onError?: (e:any)=>void;
};

export function openMarketSocket(h:Handlers) {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry = 500;

  const connect = () => {
    if (stopped) return;
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { retry = 500; h.onOpen?.(); };
    ws.onmessage = (ev) => {
      try {
        const msg: WsMsg | WsMsg[] = JSON.parse(ev.data);
        const list = Array.isArray(msg) ? msg : [msg];
        for (const m of list) {
          if (m.type === 'metrics') h.onMetrics?.(m.payload);
          else if (m.type === 'bar') {
            const p:any = (m as any).payload || {};
            const tRaw = p.time ?? p.t;
            const time = Math.round(tRaw / (tRaw > 2_000_000_000 ? 1000 : 1));
            h.onBar?.({
              ticker: p.ticker ?? p.sym,
              time,
              open: p.open ?? p.o, high: p.high ?? p.h, low: p.low ?? p.l, close: p.close ?? p.c, volume: p.volume ?? p.v
            });
          }
        }
      } catch(e) { /* ignore parse errors */ }
    };
    ws.onerror = (e) => { h.onError?.(e); };
    ws.onclose = () => {
      h.onClose?.();
      if (stopped) return;
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 4000);
    };
  };

  connect();
  return () => { stopped = true; try { ws?.close(); } catch {} };
}
