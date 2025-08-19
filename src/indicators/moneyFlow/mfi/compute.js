// src/indicators/moneyFlow/mfi/compute.js
// Proper Money Flow Index (MFI)

export function mfiCompute(candles, inputs) {
  const { length = 14 } = inputs || {};
  if (!candles || candles.length < length + 1) {
    return new Array(candles.length).fill(null);
  }

  const out = new Array(candles.length).fill(null);

  for (let i = length; i < candles.length; i++) {
    let pos = 0;
    let neg = 0;

    for (let j = i - length + 1; j <= i; j++) {
      const c = candles[j];
      const prev = candles[j - 1];
      if (!c || !prev) continue;

      // typical price
      const tp = (c.high + c.low + c.close) / 3;
      const prevTp = (prev.high + prev.low + prev.close) / 3;
      const mf = tp * (c.volume ?? 0);

      if (tp > prevTp) {
        pos += mf;
      } else if (tp < prevTp) {
        neg += mf;
      }
    }

    if (neg === 0) {
      out[i] = 100; // strong buying
    } else {
      const mr = pos / neg;
      out[i] = 100 - 100 / (1 + mr);
    }
  }

  return out;
}
