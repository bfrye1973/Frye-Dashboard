// src/services/tos.js

/* ===================== CONFIG (from index.html) ===================== */
const TOS_BASE =
  (typeof window !== "undefined" && window.__TOS_BASE__) || "";
const TOS_WS_BASE =
  (typeof window !== "undefined" && window.__TOS_WS_BASE__) || "";
const TOS_TOKEN =
  (typeof window !== "undefined" && window.__TOS_TOKEN__) || "";

/* ===================== Utilities ===================== */
const LOG_PREFIX = "%c[TOS]";
const logOk  = (...a) => console.log(LOG_PREFIX, "color:#10b981;font-weight:700", ...a);
const logInf = (...a) => console.info(LOG_PREFIX, "color:#60a5fa;font-weight:700", ...a);
const logWarn= (...a) => console.warn(LOG_PREFIX, "color:#f59e0b;font-weight:700", ...a);
const logErr = (...a) => console.error(LOG_PREFIX, "color:#ef4444;font-weight:700", ...a);

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

/* Clamp / sanitize to keep the UI stable */
const SAN = {
  rpm   : (v) => clamp(v,   0, 9000, 0),
  speed : (v) => clamp(v,   0,  220, 0),
  water : (v) => clamp(v,   0,  100, 0),
  oil   : (v) => clamp(v,   0,  100, 0),
  fuel  : (v) => clamp(v,   0,  100, 0),
};
function sanitizeGaugePayload(obj, key) {
  return { value: SAN[key]?.(obj?.value) ?? 0, ts: Number(obj?.ts) || Date.now() };
}
function sanitizeSignalsPayload(obj = {}) {
  return {
    breakout: !!obj.breakout,
    buy     : !!obj.buy,
    sell    : !!obj.sell,
    emaCross: !!obj.emaCross,
    stop    : !!obj.stop,
    trail   : !!obj.trail,
    pad1    : !!obj.pad1,
    pad2    : !!obj.pad2,
    pad3    : !!obj.pad3,
    pad4    : !!obj.pad4,
    ts      : Number(obj.ts) || Date.now(),
  };
}

/* ===================== POLLING with backoff ===================== */
function pollLoop({ url, intervalMs = 1000, onUpdate, label }) {
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
        logWarn(`${label}: HTTP ${r.status} ${r.statusText} from ${url}`);
        delay = Math.min(delay * 1.5, 5000);
      }
    } catch (e) {
      logWarn(`${label}: HTTP error to ${url}`, e?.message || e);
      delay = Math.min(delay * 1.5, 5000);
    } finally {
      if (!stopped) t = setTimeout(tick, delay);
    }
  }

  t = setTimeout(tick, 10);
  return () => { stopped = true; clearTimeout(t); };
}

/* ===================== WebSocket stream ===================== */
function socketStream({ url, onMessage, onDown, label }) {
  let ws = null;
  let alive = true;
  let hbTimer = null;
  let reconnectTimer = null;

  function connect() {
    try {
      ws = new WebSocket(withAuthQS(url));
      logInf(`${label}: WS connecting → ${url}`);
    } catch (e) {
      logWarn(`${label}: WS construct failed`, e?.message || e);
      onDown?.();
      return;
    }

    ws.onopen = () => {
      logOk(`${label}: WS connected`);
      clearInterval(hbTimer);
      hbTimer = setInterval(() => {
        try { ws?.readyState === 1 && ws.send('{"type":"ping"}'); } catch {}
      }, 20000);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessage?.(data);
      } catch (err) {
        logWarn(`${label}: WS bad message`, err?.message || err);
      }
    };

    ws.onerror = () => {}; // will close
    ws.onclose = () => {
      clearInterval(hbTimer);
      if (!alive) return;
      logWarn(`${label}: WS closed, falling back / trying reconnect`);
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

/* ===================== DEMO / MOCK generator ===================== */
function demoLoop({ key, onUpdate }) {
  logInf(`${key}: MOCK demo started (no base URLs / both transports down)`);
  let stopped = false;
  let t = null;
  let val = 0;

  function rand(lo, hi) { return Math.floor(Math.random()*(hi-lo+1))+lo; }

  function tick() {
    if (stopped) return;
    switch (key) {
      case "rpm":   val = (val + rand(120, 240)) % 9000; break;
      case "speed": val = (val + rand(1, 3)) % 220;      break;
      case "water": val = clamp(val + rand(-2, 2), 30, 80, 60); break;
      case "oil":   val = clamp(val + rand(-2, 2), 40, 80, 55); break;
      case "fuel":  val = clamp(val + rand(-1, 1), 30, 90, 70); break;
      default: val = 0;
    }
    onUpdate?.({ value: val, ts: Date.now() });
    t = setTimeout(tick, key === "rpm" ? 400 : key === "speed" ? 600 : 1200);
  }

  t = setTimeout(tick, 50);
  return () => { stopped = true; clearTimeout(t); };
}

/* ===================== single gauge subscriber ===================== */
function buildGaugeSubscriber({ key, httpPath, wsPath, intervalMs = 1000 }) {
  const label = `gauge:${key.toUpperCase()}`;
  return function subscribe(onUpdate) {
    // If neither base is configured → demo mode
    if (!TOS_WS_BASE && !TOS_BASE) {
      return demoLoop({
        key,
        onUpdate: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
      });
    }

    let cleanup = () => {};
    const httpURL = TOS_BASE ? `${TOS_BASE.replace(/\/$/, "")}${httpPath}` : "";
    const wsURL   = TOS_WS_BASE ? `${TOS_WS_BASE.replace(/\/$/, "")}${wsPath}` : "";

    // Try WS when possible
    if (TOS_WS_BASE) {
      const stream = socketStream({
        url: wsURL,
        label,
        onMessage: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
        onDown: () => {
          // WS failed, fallback to HTTP if we have base, else mock
          if (TOS_BASE) {
            logInf(`${label}: fallback → HTTP ${httpURL}`);
            cleanup = pollLoop({
              url: httpURL,
              intervalMs,
              onUpdate: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
            });
          } else {
            cleanup = demoLoop({
              key,
              onUpdate: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
            });
          }
        },
      });
      cleanup = () => stream.stop();
    } else if (TOS_BASE) {
      logInf(`${label}: using HTTP polling → ${httpURL}`);
      cleanup = pollLoop({
        url: httpURL,
        intervalMs,
        onUpdate: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
      });
    } else {
      // Shouldn't hit here because of first guard, but keep safe
      cleanup = demoLoop({
        key,
        onUpdate: (obj) => onUpdate(sanitizeGaugePayload(obj, key)),
      });
    }

    return () => cleanup?.();
  };
}

/* ===================== export per‑gauge subscribers ===================== */
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

/* ===================== combined gauges (back‑compat) ===================== */
export function subscribeGauges(onUpdate) {
  let state = { rpm:0, speed:0, water:0, oil:0, fuel:0 };
  const stops = [
    subscribeRPM  ((p) => { state = { ...state, rpm:   p.value }; onUpdate(state); }),
    subscribeSpeed((p) => { state = { ...state, speed: p.value }; onUpdate(state); }),
    subscribeWater((p) => { state = { ...state, water: p.value }; onUpdate(state); }),
    subscribeOil  ((p) => { state = { ...state, oil:   p.value }; onUpdate(state); }),
    subscribeFuel ((p) => { state = { ...state, fuel:  p.value }; onUpdate(state); }),
  ];
  return () => stops.forEach((stop) => stop?.());
}

/* ===================== signals subscriber ===================== */
export function subscribeSignals(onSignals) {
  // If no bases → demo lights (random)
  if (!TOS_WS_BASE && !TOS_BASE) {
    logInf(`signals: MOCK demo started`);
    let t = null, stopped = false;
    function tick() {
      if (stopped) return;
      const r = Math.random();
      onSignals({
        breakout: r < 0.15,
        buy:      r > 0.6 && r < 0.68,
        sell:     r > 0.68 && r < 0.76,
        emaCross: r > 0.76 && r < 0.84,
        stop:     r > 0.84 && r < 0.92,
        trail:    r > 0.92,
        pad1:false,pad2:false,pad3:false,pad4:false,
        ts: Date.now(),
      });
      t = setTimeout(tick, 1800);
    }
    t = setTimeout(tick, 200);
    return () => { stopped = true; clearTimeout(t); };
  }

  let cleanup = () => {};
  const httpURL = TOS_BASE ? `${TOS_BASE.replace(/\/$/, "")}/signals` : "";
  const wsURL   = TOS_WS_BASE ? `${TOS_WS_BASE.replace(/\/$/, "")}/signals` : "";

  if (TOS_WS_BASE) {
    const stream = socketStream({
      url: wsURL,
      label: "signals",
      onMessage: (obj) => onSignals(sanitizeSignalsPayload(obj)),
      onDown: () => {
        if (TOS_BASE) {
          logInf(`signals: fallback → HTTP ${httpURL}`);
          cleanup = pollLoop({
            url: httpURL,
            intervalMs: 1500,
            onUpdate: (obj) => onSignals(sanitizeSignalsPayload(obj)),
          });
        } else {
          logInf(`signals: fallback → MOCK`);
          let t = null, stopped = false;
          function tick() {
            if (stopped) return;
            const r = Math.random();
            onSignals({
              breakout: r < 0.15,
              buy:      r > 0.6 && r < 0.68,
              sell:     r > 0.68 && r < 0.76,
              emaCross: r > 0.76 && r < 0.84,
              stop:     r > 0.84 && r < 0.92,
              trail:    r > 0.92,
              pad1:false,pad2:false,pad3:false,pad4:false,
              ts: Date.now(),
            });
            t = setTimeout(tick, 1800);
          }
          t = setTimeout(tick, 200);
          cleanup = () => { stopped = true; clearTimeout(t); };
        }
      },
    });
    cleanup = () => stream.stop();
  } else if (TOS_BASE) {
    logInf(`signals: using HTTP polling → ${httpURL}`);
    cleanup = pollLoop({
      url: httpURL,
      intervalMs: 1500,
      onUpdate: (obj) => onSignals(sanitizeSignalsPayload(obj)),
    });
  }
  return () => cleanup?.();
}
