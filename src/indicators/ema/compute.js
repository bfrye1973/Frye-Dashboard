// Exponential Moving Average
export function emaCompute(candles, inputs) {
  const { length = 20, source = "close" } = inputs || {};
  if (!candles?.length || length <= 1) return new Array(candles.length).fill(null);

  const out = new Array(candles.length).fill(null);
  const k = 2 / (length + 1);

  // seed with SMA of first N
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const c = candles[i];
    const v = c?.[source] ?? c?.close ?? 0;
    sum += v;
  }
  let ema = sum / length;
  out[length - 1] = ema;

  for (let i = length; i < candles.length; i++) {
    const c = candles[i];
    const v = c?.[source] ?? c?.close ?? 0;
    ema = v * k + ema * (1 - k);
    out[i] = ema;
  }

  return out;
}
