// src/services/feed.js
// Mock feed: generates OHLCV history and streams ticks that UPDATE the current bar
// until the timeframe bucket rolls, then starts a new bar.

function tfToSeconds(tf = "1h") {
  const t = String(tf).toLowerCase();
  const map = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400 };
  return map[t] ?? 3600;
}

function bucketStart(tsSec, tfSec) {
  return Math.floor(tsSec / tfSec) * tfSec;
}

function randn(scale = 1) {
  // Box–Muller for nicer “market-ish” noise
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale;
}

function genHistory({ bars = 200, base = 100, tfSec = 3600, vol = 0.8 }) {
  const now = Math.floor(Date.now() / 1000);
  const lastBucket = bucketStart(now, tfSec);
  let px = base;
  const out = [];

  // backfill complete bars (most recent bar is also complete)
  for (let i = bars; i > 0; i--) {
    const start = lastBucket - i * tfSec;
    const open = px;
    const drift = randn(vol * 0.4);
    const close = Math.max(0.01, open + drift);
    const w = Math.abs(randn(vol * 0.3));
    const high = Math.max(open, close) + w * 0.5;
    const low = Math.min(open, close) - w * 0.5;
    const volume = Math.floor(1000 + Math.random() * 5000);
    out.push({ time: start, open, high, low, close, volume });
    px = close;
  }

  return out;
}

export function getFeed(symbol = "SPY", timeframe = "1h") {
  const tfSec = tfToSeconds(timeframe);
  let timer = null;

  // deterministic-ish base per symbol/timeframe
  const seed = Math.abs(hashCode(`${symbol}:${timeframe}`)) % 200 + 50;

  // mutable “current bar” we’ll update until the bucket changes
  let currentBar = null;

  return {
    async history() {
      const hist = genHistory({ bars: 200, base: seed, tfSec, vol: 0.9 });
      // start the current bar from last close
      const last = hist[hist.length - 1];
      const now = Math.floor(Date.now() / 1000);
      const bStart = bucketStart(now, tfSec);
      currentBar = {
        time: bStart,
        open: last.close,
        high: last.close,
        low: last.close,
        close: last.close,
        volume: 0,
      };
      return hist;
    },

    subscribe(onBar) {
      // tick every 1.5s (faster for demo). For 1d TF it’ll still update same bucket until midnight UTC.
      const tickMs = Math.min(tfSec * 1000, 1500);
      timer = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const bStart = bucketStart(now, tfSec);

        // If the bucket rolled, emit the finished bar and start a new one
        if (!currentBar || currentBar.time !== bStart) {
          // start fresh bar from last close
          const prevClose = currentBar ? currentBar.close : seed;
          currentBar = {
            time: bStart,
            open: prevClose,
            high: prevClose,
            low: prevClose,
            close: prevClose,
            volume: 0,
          };
        }

        // simulate price movement within the bucket
        const step = randn(0.35);
        const nextClose = Math.max(0.01, currentBar.close + step);
        currentBar.close = nextClose;
        currentBar.high = Math.max(currentBar.high, nextClose);
        currentBar.low = Math.min(currentBar.low, nextClose);
        currentBar.volume += Math.floor(50 + Math.random() * 200);

        // push an update for the SAME bar time (Lightweight Charts will update/replace)
        onBar?.({ ...currentBar });
      }, tickMs);

      return () => clearInterval(timer);
    },

    close() {
      if (timer) clearInterval(timer);
    },
  };
}

// stable hash for symbol/timeframe base
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}
