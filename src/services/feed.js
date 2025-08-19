// src/services/feed.js
// Simple mock feed that generates synthetic OHLCV data and streams a new bar.

function tfToSeconds(tf) {
  const map = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400 };
  return map[tf?.toLowerCase?.()] ?? 3600; // default 1h
}

function genHistory({ bars = 200, base = 100, vol = 0.6, tfSec = 3600 }) {
  const now = Math.floor(Date.now() / 1000);
  let price = base;
  const out = [];
  for (let i = bars - 1; i >= 0; i--) {
    const t = now - i * tfSec;
    const drift = (Math.random() - 0.5) * vol;
    const open = price;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + Math.random() * (vol * 0.5);
    const low = Math.min(open, close) - Math.random() * (vol * 0.5);
    const volume = Math.floor(1000 + Math.random() * 5000);
    out.push({ time: t, open, high, low, close, volume });
    price = close;
  }
  return out;
}

export function getFeed(symbol = "SPY", timeframe = "1H") {
  const tfSec = tfToSeconds(timeframe);
  let timer = null;

  return {
    async history() {
      // generate 200 bars around a seeded base per symbol
      const seed = Math.abs(hashCode(symbol)) % 200 + 50;
      return genHistory({ bars: 200, base: seed, vol: 0.8, tfSec });
    },

    // Call the callback with a *new* bar every interval
    subscribe(onBar) {
      timer = setInterval(() => {
        const t = Math.floor(Date.now() / 1000);
        const last = this._last ?? { close: 100 };
        const open = last.close;
        const drift = (Math.random() - 0.5) * 0.8;
        const close = Math.max(1, open + drift);
        const high = Math.max(open, close) + Math.random() * 0.4;
        const low = Math.min(open, close) - Math.random() * 0.4;
        const volume = Math.floor(1000 + Math.random() * 5000);
        const bar = { time: t, open, high, low, close, volume };
        this._last = bar;
        onBar?.(bar);
      }, Math.min(tfSec * 1000, 3000)); // cap to 3s for demo
      return () => clearInterval(timer);
    },

    close() {
      if (timer) clearInterval(timer);
    },
  };
}

// simple stable hash to vary bases by symbol
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}
