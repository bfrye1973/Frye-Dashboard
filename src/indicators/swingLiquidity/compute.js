// src/indicators/swingLiquidity/compute.js
// Swing Liquidity (pivot-based) for equities:
// - Finds swing highs/lows (left/right bars)
// - Keeps swings where bar volume >= percentile (adaptive gate)
// - Extends each level "until filled" (price trades through it)
// - Returns compact zones for rendering as short horizontal segments

/**
 * @typedef {Object} Candle
 * @property {number|string} time
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef {Object} SwingZone
 * @property {'res'|'sup'} type
 * @property {number} price
 * @property {number|string} fromTime
 * @property {number|string} toTime
 * @property {boolean} filled
 * @property {number} volPct    // 0..1 volume percentile at pivot bar
 * @property {number} idxFrom   // internal
 * @property {number} idxTo     // internal
 */

/** Utility */
const isNum = (x) => Number.isFinite(x);
const isCandle = (c) =>
  c && typeof c.time !== "undefined" &&
  isNum(c.open) && isNum(c.high) && isNum(c.low) && isNum(c.close);

/** Percentile threshold from numeric array (0..1) */
function percentileThreshold(values, pct) {
  if (!values?.length) return Infinity;
  const a = [...values].sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, Math.floor(pct * (a.length - 1))));
  return a[i];
}

/** Pivot detectors (inclusive window) */
function pivotHigh(bars, i, L, R) {
  if (i < L || i + R >= bars.length) return false;
  const x = bars[i].high;
  for (let k = i - L; k <= i + R; k++) if (k !== i && bars[k].high >= x) return false;
  return true;
}
function pivotLow(bars, i, L, R) {
  if (i < L || i + R >= bars.length) return false;
  const x = bars[i].low;
  for (let k = i - L; k <= i + R; k++) if (k !== i && bars[k].low <= x) return false;
  return true;
}

/**
 * Compute swing liquidity zones.
 * @param {Candle[]} candles
 * @param {{
 *  leftBars?:number, rightBars?:number,
 *  volPctGate?:number,         // 0..1 (e.g. 0.65 keeps top 35% vol bars)
 *  extendUntilFilled?:boolean,
 *  hideFilled?:boolean,
 *  lookbackBars?:number,
 *  maxOnScreen?:number
 * }} opts
 * @returns {{ zones: SwingZone[] }}
 */
export function computeSwingLiquidity(candles, opts = {}) {
  const L = Math.max(1, Math.floor(opts.leftBars ?? 15));
  const R = Math.max(1, Math.floor(opts.rightBars ?? 10));
  const volPctGate = Math.min(0.95, Math.max(0, opts.volPctGate ?? 0.65));
  const extendUntilFilled = opts.extendUntilFilled !== false; // default true
  const hideFilled = !!opts.hideFilled;
  const lookback = Math.max(200, Math.floor(opts.lookbackBars ?? 800));
  const maxOnScreen = Math.max(10, Math.floor(opts.maxOnScreen ?? 80));

  if (!Array.isArray(candles) || candles.length === 0 || !isCandle(candles[0])) {
    return { zones: [] };
  }

  const n = candles.length;
  const start = Math.max(0, n - lookback);
  const scope = candles.slice(start);
  const vols = scope.map(c => Number(c.volume ?? 0));
  const gate = percentileThreshold(vols, volPctGate);

  /** Stage 1: find pivot bars that pass volume gate (shift index to actual bar) */
  const raw = /** @type {SwingZone[]} */([]);
  for (let i = start; i < n; i++) {
    if (i < L || i + R >= n) continue;

    const pivotHi = pivotHigh(candles, i, L, R);
    const pivotLo = pivotLow(candles, i, L, R);
    if (!pivotHi && !pivotLo) continue;

    const v = Number(candles[i].volume ?? 0);
    if (!(v >= gate)) continue; // adaptive volume filter

    if (pivotHi) {
      raw.push({
        type: 'res',
        price: candles[i].high,
        fromTime: candles[i + R].time, // active after confirmation
        toTime: candles[i + R].time,
        filled: false,
        volPct: v / (vols[vols.length - 1] || 1),
        idxFrom: i + R,
        idxTo: i + R,
      });
    }
    if (pivotLo) {
      raw.push({
        type: 'sup',
        price: candles[i].low,
        fromTime: candles[i + R].time,
        toTime: candles[i + R].time,
        filled: false,
        volPct: v / (vols[vols.length - 1] || 1),
        idxFrom: i + R,
        idxTo: i + R,
      });
    }
  }

  if (!raw.length) return { zones: [] };

  /** Stage 2: extend each level until it's filled or we hit the end */
  const zones = /** @type {SwingZone[]} */([]);
  for (const z of raw) {
    let filled = false;
    let lastIdx = z.idxFrom;

    for (let i = z.idxFrom; i < n; i++) {
      const c = candles[i];
      const crosses = (c.high >= z.price && c.low <= z.price);
      lastIdx = i;

      if (crosses) {
        filled = true;
        if (!extendUntilFilled) { lastIdx = Math.min(i + 4, n - 1); }
        break;
      }
    }

    const finalIdx = filled ? (hideFilled ? -1 : lastIdx) : lastIdx;
    if (finalIdx >= 0) {
      zones.push({
        ...z,
        filled,
        idxTo: finalIdx,
        toTime: candles[finalIdx].time,
      });
    }
  }

  // Prefer recent, unfilled swings first; cap count for clarity
  zones.sort((a, b) => {
    // Unfilled first
    if (a.filled !== b.filled) return a.filled ? 1 : -1;
    // Newer first by idxFrom
    return b.idxFrom - a.idxFrom;
  });

  return { zones: zones.slice(0, maxOnScreen) };
}
