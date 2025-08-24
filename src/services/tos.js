// src/services/tos.js
// Replace URLs with your live endpoints once ready.

let gaugesInterval = null;
let signalsInterval = null;

export function subscribeGauges(onUpdate) {
  // TODO: replace with your fetch/WebSocket
  // onUpdate({ rpm, speed, water, oil, fuel })
  clearInterval(gaugesInterval);
  gaugesInterval = setInterval(() => {
    onUpdate({
      rpm:   5000 + Math.round(Math.random() * 3000),
      speed: 40 + Math.round(Math.random() * 60),
      water: 50 + Math.round(Math.random() * 20),
      oil:   50 + Math.round(Math.random() * 20),
      fuel:  40 + Math.round(Math.random() * 40),
    });
  }, 1200);
  return () => clearInterval(gaugesInterval);
}

export function subscribeSignals(onSignals) {
  // TODO: wire to your strategy outputs
  // onSignals({ breakout, buy, sell, emaCross, stop, trail })
  clearInterval(signalsInterval);
  signalsInterval = setInterval(() => {
    const pick = Math.random();
    onSignals({
      breakout: pick < 0.15,
      buy:      pick > 0.65 && pick < 0.72,
      sell:     pick > 0.72 && pick < 0.80,
      emaCross: pick > 0.80 && pick < 0.88,
      stop:     pick > 0.88 && pick < 0.94,
      trail:    pick > 0.94,
    });
  }, 2000);
  return () => clearInterval(signalsInterval);
}
