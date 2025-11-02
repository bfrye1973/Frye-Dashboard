// src/indicators/smz/wickCandleZones.js
// Smart Money Zones — Wick & Candle (Step A)  |  Pure engine (no UI)
// Inputs: ascending OHLCV bars: [{time, open, high, low, close, volume}, ...]
// Output: { events: [...], zones: [...] }  — PA-only zones (no indicators yet).

export function computeWickCandleZones(barsAsc, opts = {}) {
  if (!Array.isArray(barsAsc) || barsAsc.length < 5) {
    return { events: [], zones: [] };
  }

  const p = {
    // thresholds (safe defaults; can be tuned later)
    bandPct: opts.bandPct ?? 0.0006,           // wick cluster band width as % of price (e.g., 0.06%)
    winClust: opts.winClust ?? 25,             // window for wick hits
    minHits: opts.minHits ?? 2,                // minimum wick hits in band
    pinWickPct: opts.pinWickPct ?? 0.50,       // pin wick >= % of range
    pinBodyPct: opts.pinBodyPct ?? 0.35,       // pin body <= % of range
    absBodyPct: opts.absBodyPct ?? 0.35,       // absorption body <= % of range
    absVolRatio: opts.absVolRatio ?? 1.20,     // absorption volume / SMA20 >=
    volLen: opts.volLen ?? 20,                 // relative volume length
    pvtLen: opts.pvtLen ?? 5,                  // pivot length for swings
    sfpBars: opts.sfpBars ?? 3                 // reclaim within <= bars
  };

  // --- helpers
  const rng  = (b) => b.high - b.low;
  const body = (b) => Math.abs(b.close - b.open);
  const wickTop = (b) => b.high - Math.max(b.open, b.close);
  const wickBot = (b) => Math.min(b.open, b.close) - b.low;
  const pct = (x, base) => (base !== 0 ? x / base : 0);

  // simple SMA for volume
  function smaVol(i, len) {
    const from = Math.max(0, i - len + 1);
    let s = 0, n = 0;
    for (let k = from; k <= i; k++) { s += barsAsc[k].volume || 0; n++; }
    return n > 0 ? s / n : 0;
  }

  // pivots (highest/lowest in window looking back)
  function priorSwingHigh(i, lookback) {
    let h = -Infinity;
    for (let k = Math.max(0, i - lookback); k < i; k++) h = Math.max(h, barsAsc[k].high);
    return h;
  }
  function priorSwingLow(i, lookback) {
    let l = +Infinity;
    for (let k = Math.max(0, i - lookback); k < i; k++) l = Math.min(l, barsAsc[k].low);
    return l;
  }

  // wick cluster hit counter around center price
  const priceBand = (price) => price * p.bandPct;
  function countHits(iCenter, center, win) {
    const lo = center - priceBand(center);
    const hi = center + priceBand(center);
    let hits = 0;
    for (let k = Math.max(0, iCenter - win + 1); k <= iCenter; k++) {
      const b = barsAsc[k];
      if (b.low <= hi && b.high >= lo) hits++;
    }
    return hits;
  }

  const events = [];
  const zones  = [];

  // Build a zone object
  function pushZone(side, i, floor, ceil, origin) {
    const b = barsAsc[i];
    zones.push({
      id: `${side === "bull" ? "ACCUM" : "DIST"}_${b.time}`,
      side,
      time: b.time,
      index: i,
      top: ceil,
      bottom: floor,
      origin,           // e.g., "PIN", "ABS", "SFP", "CLUSTER"
      status: "fresh",
      touches: 0
    });
  }

  // Main pass
  for (let i = 0; i < barsAsc.length; i++) {
    const b = barsAsc[i];
    const r = rng(b);

    // --- Pins
    const bullPin =
      r > 0 &&
      pct(wickBot(b), r) >= p.pinWickPct &&
      pct(body(b), r)   <= p.pinBodyPct &&
      (b.close >= b.open || b.close >= (b.low + 0.6 * r));

    const bearPin =
      r > 0 &&
      pct(wickTop(b), r) >= p.pinWickPct &&
      pct(body(b), r)   <= p.pinBodyPct &&
      (b.close <= b.open || b.close <= (b.low + 0.4 * r));

    if (bullPin) events.push({ type: "PIN_BULL", time: b.time, price: b.low, index: i });
    if (bearPin) events.push({ type: "PIN_BEAR", time: b.time, price: b.high, index: i });

    // --- Absorption (Effort ≠ Result)
    const vavg = smaVol(i, p.volLen);
    const bullAbs =
      vavg > 0 &&
      (b.volume / vavg) >= p.absVolRatio &&
      r > 0 &&
      pct(body(b), r) <= p.absBodyPct &&
      wickBot(b) >= wickTop(b) &&
      b.close >= (b.low + 0.5 * r);

    const bearAbs =
      vavg > 0 &&
      (b.volume / vavg) >= p.absVolRatio &&
      r > 0 &&
      pct(body(b), r) <= p.absBodyPct &&
      wickTop(b) >= wickBot(b) &&
      b.close <= (b.low + 0.5 * r);

    if (bullAbs) events.push({ type: "ABSORB_BULL", time: b.time, price: b.low, index: i });
    if (bearAbs) events.push({ type: "ABSORB_BEAR", time: b.time, price: b.high, index: i });

    // --- SFP (liquidity sweep + quick reclaim)
    const ph = priorSwingHigh(i, p.pvtLen);
    const pl = priorSwingLow(i, p.pvtLen);

    let sfpBull = false, sfpBear = false;
    // sweep low then reclaim within p.sfpBars bars
    if (b.low < pl) {
      for (let j = i + 1; j <= Math.min(i + p.sfpBars, barsAsc.length - 1); j++) {
        if (barsAsc[j].close >= pl) { sfpBull = true; break; }
      }
      if (sfpBull) events.push({ type: "SFP_BULL", time: b.time, level: pl, index: i });
    }
    // sweep high then reclaim
    if (b.high > ph) {
      for (let j = i + 1; j <= Math.min(i + p.sfpBars, barsAsc.length - 1); j++) {
        if (barsAsc[j].close <= ph) { sfpBear = true; break; }
      }
      if (sfpBear) events.push({ type: "SFP_BEAR", time: b.time, level: ph, index: i });
    }

    // --- Wick cluster (defense band) around current wick extremities
    const hitsBull = countHits(i, b.high, p.winClust); // defense overhead
    const hitsBear = countHits(i, b.low,  p.winClust); // defense underfoot

    const makeBull =
      hitsBear >= p.minHits || sfpBull || bullPin || bullAbs;

    const makeBear =
      hitsBull >= p.minHits || sfpBear || bearPin || bearAbs;

    // --- Build zones (PA-only) from wick envelope
    if (makeBull) {
      const mid = (b.open + b.close) / 2;
      const floor = b.low;
      const ceil = Math.max(mid, floor + 1e-8);
      pushZone("bull", i, floor, ceil, sfpBull ? "SFP" : bullPin ? "PIN" : bullAbs ? "ABS" : hitsBear >= p.minHits ? "CLUSTER" : "PA");
    }
    if (makeBear) {
      const mid = (b.open + b.close) / 2;
      const ceil = b.high;
      const floor = Math.min(mid, ceil - 1e-8);
      pushZone("bear", i, floor, ceil, sfpBear ? "SFP" : bearPin ? "PIN" : bearAbs ? "ABS" : hitsBull >= p.minHits ? "CLUSTER" : "PA");
    }
  }

  return { events, zones };
}
