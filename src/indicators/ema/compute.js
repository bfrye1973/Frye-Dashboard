// Exponential Moving Average for lightweight-charts bars
// bars: [{time, open, high, low, close, volume}]
// returns [{time, value}] compatible with lineSeries.setData

export function computeEMA(bars, period = 20, src = "close") {
  if (!Array.isArray(bars) || bars.length === 0) return [];
  const p = Math.max(1, Number(period));
  const k = 2 / (p + 1); // smoothing
  const out = [];

  let ema = null;
  for (let i = 0; i < bars.length; i++) {
    const price = Number(bars[i]?.[src] ?? NaN);
    if (!Number.isFinite(price)) continue;

    ema = (ema == null)
      ? price // seed on first valid price
      : (price - ema) * k + ema;

    // Only start emitting once we have "period" samples (optional)
    if (i >= p - 1) {
      out.push({ time: Number(bars[i].time), value: ema });
    }
  }
  return out;
}
