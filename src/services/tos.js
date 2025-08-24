// src/services/tos.js

// Optionally set a real base in public/index.html:
// <script>window.__TOS_BASE__ = "https://your-tos-backend.example.com";</script>
const TOS_BASE =
  (typeof window !== "undefined" && window.__TOS_BASE__) || "";

/**
 * subscribeGauges(onUpdate)
 * Sends { rpm, speed, water, oil, fuel } updates.
 * Returns stop() to unsubscribe.
 */
export function subscribeGauges(onUpdate) {
  // MOCK: random demo values (replace with your backend later)
  const id = setInterval(() => {
    onUpdate({
      rpm:   4500 + Math.round(Math.random() * 3500), // 4500..8000
      speed: 35 + Math.round(Math.random() * 85),      // 35..120
      water: 50 + Math.round(Math.random() * 30),      // %
      oil:   45 + Math.round(Math.random() * 35),      // %
      fuel:  30 + Math.round(Math.random() * 60),      // %
    });
  }, 1200);

  // Real backend example (polling):
  // const id = setInterval(async () => {
  //   const r = await fetch(`${TOS_BASE}/gauges`, { cache: "no-store" });
  //   if (r.ok) onUpdate(await r.json());
  // }, 1000);

  return () => clearInterval(id);
}

/**
 * subscribeSignals(onSignals)
 * Sends { breakout, buy, sell, emaCross, stop, trail } booleans.
 * Returns stop() to unsubscribe.
 */
export function subscribeSignals(onSignals) {
  // MOCK: flip random lights (replace later)
  const id = setInterval(() => {
    const p = Math.random();
    onSignals({
      breakout: p < 0.12,
      buy:      p > 0.60 && p < 0.68,
      sell:     p > 0.68 && p < 0.76,
      emaCross: p > 0.76 && p < 0.84,
      stop:     p > 0.84 && p < 0.92,
      trail:    p > 0.92,
    });
  }, 2000);

  // Real backend example:
  // const id = setInterval(async () => {
  //   const r = await fetch(`${TOS_BASE}/signals`, { cache: "no-store" });
  //   if (r.ok) onSignals(await r.json());
  // }, 1000);

  // Or WebSocket example:
  // const ws = new WebSocket(`${TOS_BASE_WS}/signals`);
  // ws.onmessage = (e) => onSignals(JSON.parse(e.data));
  // return () => ws.close();

  return () => clearInterval(id);
}
