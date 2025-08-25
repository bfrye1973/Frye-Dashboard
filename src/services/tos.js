// src/services/tos.js

// ---- Read config injected in public/index.html ----
const TOS_BASE =
  (typeof window !== "undefined" && window.__TOS_BASE__) || "";
const TOS_WS_BASE =
  (typeof window !== "undefined" && window.__TOS_WS_BASE__) || "";
const TOS_TOKEN =
  (typeof window !== "undefined" && window.__TOS_TOKEN__) || "";

/* ================================= utils ================================= */
function authHeaders() {
  return TOS_TOKEN ? { Authorization: `Bearer ${TOS_TOKEN}` } : {};
}
function withAuthQS(url) {
  if (!TOS_TOKEN) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("token", TOS_TOKEN);
    return u.toString();
  } catch {
    return url;
  }
}
function clamp(n, lo, hi, d = 0) {
  const x = Number(n);
  if (Number.isFinite(x)) return Math.max(lo, Math.min(hi, x));
  return d;
}
const sanitize = {
  rpm:   (v) => clamp(v,   0, 9000, 0),
  speed: (v) => clamp(v,   0,  220, 0),
  water: (v) => clamp(v,   0,  100, 0),
  oil:   (v) => clamp(v,   0,  100, 0),
  fuel:  (v) => clamp(v,   0,  100, 0),
};
function sanitizeGaugePayload(obj, key) {
  return { value: sanitize[key]?.(obj?.value) ?? 0, ts: Number(obj?.ts) || Date.now() };
}
function sanitizeSignalsPayload(obj = {}) {
  return {
    breakout: !!obj.breakout,
    buy:      !!obj.buy,
    sell:     !!obj.sell,
    emaCross: !!obj.emaCross,
    stop:     !!obj.stop,
    trail:    !!obj.trail,
    pad1:     !!obj.pad1,
    pad2:     !!obj.pad2,
    pad3:     !!obj.pad3,
    pad4:     !!obj.pad4,
    ts:       Number(obj.ts) || Date.now(),
  };
}

/* =============================== polling ================================= */
function pollLoop({ url, intervalMs = 1000, onUpdate }) {
  let stopped = false;
  let t = null;
  let delay = intervalMs;

  async function tick() {
    if (stopped) return;
    try {
      const r = await fetch(url, { headers: { ...authHeaders() }, cache: "no-store" });
      if (r.ok) {
        const json = await r.json();
        onUpdate?.(json);
        delay = intervalMs;
      } else {
        delay = Math.min(delay * 1.5, 5000);
      }
    } catch {
      delay = Math.min(delay * 1.5, 5000);
    } finally {
      if (!stopped) t = setTimeout(tick, delay);
    }
  }
  t = setTimeout(tick, 10);
  return () => { stopped = true; clearTimeout(t); };
}

/* =============================== WebSocket =============================== */
function socketStream({ url, onMessage, onDown }) {
  let ws = null;
  let alive = true;
  let hbTimer = null;
  let reconnectTimer = null;

  function connect() {
    try {
      ws = new WebSocket(withAuthQS(url));
    } catch {
      onDown?.();
      return;
    }
    ws.onopen = () => {
      clearInterval(hbTimer);
      hbTimer = setInterval(() => {
        try { ws?.readyState === 1 && ws.send('{"type":"ping"}'); } catch {}
      }, 20000);
    };
    ws.onmessage = (e) => {
      try { onMessage?.(JSON.parse(e.data)); } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      clearInterval(hbTimer);
      if (!alive) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 1000);
      onDown?.();
    };
  }
  connect();

  return {
    stop() {
      alive = false;
      try { ws?.close(); } catch {}
      clearInterval(hbTimer);
      clearTimeout(reconnectTimer);
    },
  };
}

/* ====================== per‑gauge subscriber builder ====================== */
function buildGaugeSubscriber({ key, httpPath, wsPath, intervalMs = 1000 }) {
  return function subscribe(onUpdate) {
    let cleanup = () => {};
    const httpURL = `${TOS_BASE.replace(/\/$/, "")}${httpPath}`;
    const wsURL   = `${TOS_WS_BASE.replace(/\/$/, "")}${wsPath}`;

    if (TOS_WS_BASE) {
      const stream = socketStream({
        url: wsURL,
        onMessage: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
        onDown: () => {
          cleanup = pollLoop({
            url: httpURL,
            intervalMs,
            onUpdate: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
          });
        },
      });
      cleanup = () => stream.stop();
    } else {
      cleanup = pollLoop({
        url: httpURL,
        intervalMs,
        onUpdate: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
      });
    }
    return () => cleanup?.();
  };
}

/* ============================== per‑gauge ============================== */
export const subscribeRPM   = buildGaugeSubscriber({
  key: "rpm",   httpPath: "/gauges/rpm",   wsPath: "/gauges/rpm",   intervalMs: 400,
});
export const subscribeSpeed = buildGaugeSubscriber({
  key: "speed", httpPath: "/gauges/speed", wsPath: "/gauges/speed", intervalMs: 600,
});
export const subscribeWater = buildGaugeSubscriber({
  key: "water", httpPath: "/gauges/water", wsPath: "/gauges/water", intervalMs: 1200,
});
export const subscribeOil   = buildGaugeSubscriber({
  key: "oil",   httpPath: "/gauges/oil",   wsPath: "/gauges/oil",   intervalMs: 1200,
});
export const subscribeFuel  = buildGaugeSubscriber({
  key: "fuel",  httpPath: "/gauges/fuel",  wsPath: "/gauges/fuel",  intervalMs: 1200,
});

/* ============================ combined gauges ============================ */
/**
 * subscribeGauges(cb)
 *  → cb({ rpm, speed, water, oil, fuel })
 *  Backward‑compatible shim so existing pages that import subscribeGauges keep working.
 */
export function subscribeGauges(onUpdate) {
  let state = { rpm:0, speed:0, water:0, oil:0, fuel:0 };
  const subs = [
    subscribeRPM  ((p) => { state = { ...state, rpm:   p.value }; onUpdate(state); }),
    subscribeSpeed((p) => { state = { ...state, speed: p.value }; onUpdate(state); }),
    subscribeWater((p) => { state = { ...state, water: p.value }; onUpdate(state); }),
    subscribeOil  ((p) => { state = { ...state, oil:   p.value }; onUpdate(state); }),
    subscribeFuel ((p) => { state = { ...state, fuel:  p.value }; onUpdate(state); }),
  ];
  return () => subs.forEach((stop) => stop?.());
}

/* ================================ signals ================================ */
export function subscribeSignals(onSignals) {
  let cleanup = () => {};
  const httpURL = `${TOS_BASE.replace(/\/$/, "")}/signals`;
  const wsURL   = `${TOS_WS_BASE.replace(/\/$/, "")}/signals`;

  if (TOS_WS_BASE) {
    const stream = socketStream({
      url: wsURL,
      onMessage: (obj) => onSignals(sanitizeSignalsPayload(obj)),
      onDown: () => {
        cleanup = pollLoop({
          url: httpURL,
          intervalMs: 1500,
          onUpdate: (obj) => onSignals(sanitizeSignalsPayload(obj)),
        });
      },
    });
    cleanup = () => stream.stop();
  } else {
    cleanup = pollLoop({
      url: httpURL,
      intervalMs: 1500,
      onUpdate: (obj) => onSignals(sanitizeSignalsPayload(obj)),
    });
  }
  return () => cleanup?.();
}
