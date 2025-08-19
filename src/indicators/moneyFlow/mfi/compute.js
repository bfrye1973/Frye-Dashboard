import { typicalPrice, rollingSum } from "../shared";

/**
 * MFI (Money Flow Index)
 * candles: [{time, high, low, close, volume}, ...]
 * inputs: { length }
 */
export function mfiCompute(candles, inputs) {
  const { length = 14 } = inputs || {};
  const rawPos = new Array(candles.length).fill(0);
  const rawNeg = new Array(candles.length).fill(0);

  for (let i = 1; i < candles.length; i++) {
    const p0 = typicalPrice(candles[i - 1].high, candles[i - 1].low, candles[i - 1].close);
    const p1 = typicalPrice(candles[i].high, candles[i].low, candles[i].close);
    const mf = p1 * (candles[i].volume ?? 0);

    if (p1 > p0) rawPos[i] = mf;
    else if (p1 < p0) rawNeg[i] = mf;
  }

  const pos = rollingSum(rawPos, length);
  const neg = rollingSum(rawNeg, length);

  const out = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    const p = pos[i], n = neg[i];
    if (p == null || n == null) continue;
    const mr = n === 0 ? 100 : p / n;
    out[i] = 100 - (100 / (1 + mr));
  }
  return out;
}

