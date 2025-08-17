// Money Flow Profile (fixed range) – JS port of the core math
// Works with Lightweight Charts data shape.
//
// Candle shape we use everywhere:
export type Candle = {
  time: number;   // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MFPBin = {
  low: number;        // bin low price
  high: number;       // bin high price
  total: number;      // accumulated volume or money flow
  buy: number;        // bullish portion (if enabled)
  sell: number;       // bearish portion (if enabled)
  center: number;     // mid price for convenience
};

export type MFPResult = {
  bins: MFPBin[];
  pocIndex: number;     // index of max node
  pocPrice: number;     // price at PoC (bin center)
  totals: {
    total: number;
    buy: number;
    sell: number;
  };
  // optional value area helpers (based on percentages if you want to shade later)
  percentile?: {
    highThreshold: number;   // absolute value at “high node” threshold (e.g., 53%)
    lowThreshold: number;    // absolute value at “low node” threshold (e.g., 37%)
  };
};

export type MFPOptions = {
  lookback?: number;           // bars (default 200)
  rows?: number;               // number of price bins (default 25)
  source?: 'Volume' | 'Money Flow'; // default 'Volume'
  sentiment?: 'Bar Polarity' | 'Bar Pressure' | 'None'; // default 'Bar Polarity'
  highNodePct?: number;        // 0..1 threshold for “high” nodes (default 0.53)
  lowNodePct?: number;         // 0..1 threshold for “low” nodes  (default 0.37)
};

export function computeMoneyFlowProfile(
  candles: Candle[],
  opts: MFPOptions = {}
): MFPResult {
  const L  = Math.max(10, Math.min(1500, opts.lookback ?? 200));
  const N  = Math.max(10, Math.min(100,  opts.rows ?? 25));
  const src = opts.source ?? 'Volume';
  const sent = opts.sentiment ?? 'Bar Polarity';
  const highNodePct = Math.min(0.99, Math.max(0.5,  opts.highNodePct ?? 0.53));
  const lowNodePct  = Math.min(0.40, Math.max(0.10, opts.lowNodePct  ?? 0.37));

  if (!candles.length) {
    return {
      bins: [],
      pocIndex: -1,
      pocPrice: NaN,
      totals: { total: 0, buy: 0, sell: 0 },
    };
  }

  const end = candles.length - 1;
  const start = Math.max(0, end - L);
  const slice = candles.slice(start, end + 1);

  // price boundaries over the range
  let pLow  = +Infinity;
  let pHigh = -Infinity;
  for (const c of slice) {
    if (c.low  < pLow)  pLow  = c.low;
    if (c.high > pHigh) pHigh = c.high;
  }
  const height = Math.max(1e-9, pHigh - pLow);
  const step = height / N;

  const bins: MFPBin[] = Array.from({ length: N }, (_, i) => {
    const low  = pLow + i * step;
    const high = low + step;
    return { low, high, total: 0, buy: 0, sell: 0, center: (low + high) / 2 };
  });

  // helper: how much of a candle belongs to a bin (linear overlap)
  function overlapFraction(c: Candle, low: number, high: number) {
    const lo = Math.max(low, c.low);
    const hi = Math.min(high, c.high);
    const range = c.high - c.low;
    if (range <= 0) return 0;
    const o = Math.max(0, hi - lo);
    return o / range;
  }

  for (const c of slice) {
    // base magnitude (volume or money flow)
    // Pine’s “Money Flow” version multiplies by price; we use bin center
    for (let i = 0; i < N; i++) {
      const b = bins[i];
      const frac = overlapFraction(c, b.low, b.high);
      if (frac <= 0) continue;

      const base = (src === 'Money Flow')
        ? (c.volume * b.center) * frac
        : c.volume * frac;

      // sentiment decision
      let isBull = false;
      if (sent === 'None') {
        b.total += base;
        continue;
      } else if (sent === 'Bar Polarity') {
        isBull = c.close > c.open;  // same as Pine
      } else { // 'Bar Pressure'
        const up  = (c.close - c.low);
        const down = (c.high - c.close);
        isBull = up > down;
      }

      if (isBull) b.buy += base; else b.sell += base;
      b.total += base;
    }
  }

  // compute PoC
  let pocIdx = -1;
  let maxVal = -Infinity;
  for (let i = 0; i < N; i++) {
    if (bins[i].total > maxVal) {
      maxVal = bins[i].total;
      pocIdx = i;
    }
  }

  const total = bins.reduce((a, b) => a + b.total, 0);
  const buy   = bins.reduce((a, b) => a + b.buy, 0);
  const sell  = bins.reduce((a, b) => a + b.sell, 0);

  return {
    bins,
    pocIndex: pocIdx,
    pocPrice: pocIdx >= 0 ? bins[pocIdx].center : NaN,
    totals: { total, buy, sell },
    percentile: {
      highThreshold: maxVal * highNodePct,
      lowThreshold:  maxVal * lowNodePct,
    },
  };
}
