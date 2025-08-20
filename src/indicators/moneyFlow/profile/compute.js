// Money Flow Profile: bucketized money-flow volume across price levels.
export function mfpCompute(candles, inputs) {
  const { lookback = 250, bins = 24 } = inputs || {};
  const n = candles?.length ?? 0;
  if (n === 0 || bins <= 0) return { bins: [] };

  const start = Math.max(0, n - lookback);
  const slice = candles.slice(start);

  // find price range
  let minP = Infinity, maxP = -Infinity;
  for (const c of slice) {
    if (c.low < minP) minP = c.low;
    if (c.high > maxP) maxP = c.high;
  }
  if (!Number.isFinite(minP) || !Number.isFinite(maxP) || minP >= maxP) return { bins: [] };

  const step = (maxP - minP) / bins;
  const acc = Array.from({ length: bins }, () => ({ pos: 0, neg: 0 }));

  for (const c of slice) {
    const range = Math.max(c.high - c.low, 1e-6);
    const mfm = ((c.close - c.low) - (c.high - c.close)) / range; // [-1,1]
    const mfv = mfm * (c.volume ?? 0);

    const mid = (c.high + c.low + c.close) / 3;
    let i = Math.floor((mid - minP) / step);
    if (i < 0) i = 0;
    if (i >= bins) i = bins - 1;

    if (mfv >= 0) acc[i].pos += mfv;
    else acc[i].neg += -mfv; // store positive magnitude for red side
  }

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
