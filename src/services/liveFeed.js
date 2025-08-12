// Minimal WS client that emits either normalized candles (onBar)
// or raw ticks (onTick) depending on what your provider sends.
export function createLiveFeed({ url, symbol, intervalSec }, { onBar, onTick, onError, onOpen } = {}) {
  let ws;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      onOpen?.();
      // TODO: send provider-specific subscribe message here if needed:
      // ws.send(JSON.stringify({ type: "subscribe", symbol, interval: intervalSec }));
    };

    ws.onerror = (e) => onError?.(e);

    ws.onmessage = (ev) => {
      const raw = JSON.parse(ev.data);

      // --- Try BAR shape ---
      let t = raw.time ?? raw.t ?? null;
      const o = raw.open ?? raw.o;
      const h = raw.high ?? raw.h;
      const l = raw.low  ?? raw.l;
      const c = raw.close?? raw.c;

      if (typeof t === "number") t = t > 2_000_000_000 ? Math.floor(t / 1000) : t;

      if (t != null && [o,h,l,c].every(v => v != null)) {
        onBar?.({ time: t, open: +o, high: +h, low: +l, close: +c });
        return;
      }

      // --- Try TICK/TRADE shape ---
      const p = raw.price ?? raw.p ?? raw.last ?? null;
      if (t != null && p != null) {
        onTick?.({ time: t, price: +p });
        return;
      }

      // Otherwise: ignore or log raw
      // console.debug("unhandled msg", raw);
    };

    ws.onclose = () => {
      // simple backoff reconnect
      setTimeout(connect, 1500);
    };
  }

  connect();

  return {
    close() {
      try { ws?.close(); } catch {}
    }
  };
}
