/**
 * CMF (Chaikin Money Flow)
 * CMF = (Σ AD over N) / (Σ Volume over N)
 * AD = ((Close - Low) - (High - Close)) / (High - Low) * Volume
 */
export function cmfCompute(candles, inputs) {
  const { length = 20 } = inputs || {};
  const ad = new Array(candles.length).fill(0);
  const vol = new Array(candles.length).fill(0);

  for (let i = 0; i < candles.length; i++) {
    const { high: h, low: l, close: c, volume: v = 0 } = candles[i];
    vol[i] = v;
    const denom = (h - l) || 1;
    const mfm = ((c - l) - (h - c)) / denom; // Money Flow Multiplier
    ad[i] = mfm * v;
  }

  const sum = (arr, start, end) => { let s = 0; for (let i = start; i <= end; i++) s += arr[i]; return s; };
  const out = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i++) {
    const start = i - length + 1;
    if (start < 0) continue;
    const sAD = sum(ad, start, i);
    const sV  = sum(vol, start, i) || 1;
    out[i] = sAD / sV; // typically between -1 and +1
  }
  return out;
}
