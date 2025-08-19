// Money Flow Profile: bucketized MFV across price levels.
// MFV per bar uses Money Flow Multiplier (MFM) * volume.
// MFM = ((C-L) - (H-C)) / (H-L). Edge cases handled.

export function mfpCompute(candles, inputs) {
  const {
    lookback = 250,
    bins = 24,
  } = inputs || {};

  const n = candles?.length ?? 0;
  if (n === 0) return { bins: [] };

  const start = Math.max(0, n - lookback);
  const slice = candles.slice(start);

  // price range
  let minP = Infinity, maxP = -Infinity;
  for (const c of slice) {
    if (c.low < minP) minP = c.low;
    if (c.high > maxP) maxP = c.high;
  }
  if (!isFinite(minP) || !isFinite(maxP) || minP >= maxP) {
    return { bins: [] };
  }

  const step = (maxP - minP) / bins;
  const acc = new Array(bins).fill(0).map(() => ({ pos: 0, neg: 0 }));

  for (const c of slice) {
    const range = Math.max(c.high - c.low, 1e-6);
    const mfm = ((c.close - c.low) - (c.high - c.close)) / range; // ∈[-1,1]
    const mfv = mfm * (c.volume ?? 0);

    // place by mid-price; you can switch to VWAP-ish if desired
    const mid = (c.high + c.low + c.close) / 3;
    let idx = Math.floor((mid - minP) / step);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;

    if (mfv >= 0) acc[idx].pos += mfv;
    else acc[idx].neg += -mfv; // store positive magnitude
  }

  // normalize for rendering
  let maxAbs = 0;
  const rows = [];
  for (let i = 0; i < bins; i++) {
    const p1 = minP + i * step;
    const p2 = p1 + step;
    const net = acc[i].pos - acc[i].neg;
    const abs = Math.max(acc[i].pos, acc[i].neg, Math.abs(net));
    if (abs > maxAbs) maxAbs = abs;
    rows.push({ i, p1, p2, pos: acc[i].pos, neg: acc[i].neg, net, abs });
  }
  return { bins: rows, minP, maxP, maxAbs, step };
}
