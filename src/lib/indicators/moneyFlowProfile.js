// src/lib/indicators/moneyFlowProfile.js
// Money Flow Profile (fixed range) – JS port (no TypeScript types)

function computeMoneyFlowProfile(candles, opts = {}) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      bins: [],
      pocIndex: -1,
      pocPrice: NaN,
      totals: { total: 0, buy: 0, sell: 0 },
      percentile: { highThreshold: 0, lowThreshold: 0 },
    };
  }

  const L  = Math.max(10, Math.min(1500, opts.lookback ?? 200));
  const N  = Math.max(10, Math.min(100,  opts.rows ?? 25));
  const src = opts.source ?? "Volume";            // "Volume" | "Money Flow"
  const sent = opts.sentiment ?? "Bar Polarity";  // "Bar Polarity" | "Bar Pressure" | "None"
  const highNodePct = Math.min(0.99, Math.max(0.5,  opts.highNodePct ?? 0.53));
  const lowNodePct  = Math.min(0.40, Math.max(0.10, opts.lowNodePct  ?? 0.37));

  const end = candles.length - 1;
  const start = Math.max(0, end - L);
  const slice = candles.slice(start, end + 1);

  // bounds
  let pLow  = +Infinity;
  let pHigh = -Infinity;
  for (const c of slice) {
    if (c.low  < pLow)  pLow  = c.low;
    if (c.high > pHigh) pHigh = c.high;
  }
  const height = Math.max(1e-9, pHigh - pLow);
  const step = height / N;

  const bins = Array.from({ length: N }, (_, i) => {
    const low  = pLow + i * step;
    const high = low + step;
    return { low, high, center: (low + high) / 2, total: 0, buy: 0, sell: 0 };
  });

  function overlapFraction(c, low, high) {
    const lo = Math.max(low, c.low);
    const hi = Math.min(high, c.high);
    const range = c.high - c.low;
    if (range <= 0) return 0;
    const o = Math.max(0, hi - lo);
    return o / range;
  }

  for (const c of slice) {
    for (let i = 0; i < N; i++) {
      const b = bins[i];
      const frac = overlapFraction(c, b.low, b.high);
      if (frac <= 0) continue;

      const base = src === "Money Flow"
        ? (c.volume * b.center) * frac
        : (c.volume * frac);

      if (sent === "None") {
        b.total += base;
        continue;
      }

      let isBull;
      if (sent === "Bar Polarity") {
        isBull = c.close > c.open;
      } else { // "Bar Pressure"
        const up = (c.close - c.low);
        const down = (c.high - c.close);
        isBull = up > down;
      }

      if (isBull) b.buy += base; else b.sell += base;
      b.total += base;
    }
  }

  let pocIndex = -1;
  let maxVal = -Infinity;
  for (let i = 0; i < N; i++) {
    if (bins[i].total > maxVal) {
      maxVal = bins[i].total;
      pocIndex = i;
    }
  }

  const total = bins.reduce((a, b) => a + b.total, 0);
  const buy   = bins.reduce((a, b) => a + b.buy, 0);
  const sell  = bins.reduce((a, b) => a + b.sell, 0);

  return {
    bins,
    pocIndex,
    pocPrice: pocIndex >= 0 ? bins[pocIndex].center : NaN,
    totals: { total, buy, sell },
    percentile: {
      highThreshold: maxVal * highNodePct,
      lowThreshold:  maxVal * lowNodePct,
    },
  };
}

module.exports = { computeMoneyFlowProfile };
