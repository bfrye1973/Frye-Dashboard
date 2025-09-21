// src/indicators/smi/overlay.js
// Stochastic Momentum Index (separate bottom pane)
// Defaults: K=12, D=7, EMA=5  (matches your screenshot)

function ema(arr, len) {
  if (!Array.isArray(arr) || !arr.length) return [];
  if (len <= 1) return [...arr];
  const k = 2 / (len + 1);
  const out = new Array(arr.length);
  let prev = arr[0];
  out[0] = prev;
  for (let i = 1; i < arr.length; i++) { prev = arr[i] * k + prev * (1 - k); out[i] = prev; }
  return out;
}

export function createSmiOverlay({
  chart,
  kLen = 12,
  dLen = 7,
  emaLen = 5,             // smoothing on %K
  scaleTop = 40,          // visual top (K/D roughly within ±40/±60 scale)
} = {}) {
  if (!chart) return { setBars: () => {}, remove: () => {} };

  // Dedicated bottom pane
  const SCALE_ID = "smi";
  const ps = chart.priceScale(SCALE_ID);
  ps.applyOptions({
    scaleMargins: { top: 0.80, bottom: 0.02 },  // ~20% bottom pane
    borderVisible: false,
  });

  const seriesK = chart.addLineSeries({
    priceScaleId: SCALE_ID,
    color: "#60a5fa",   // blue
    lineWidth: 2,
    lastValueVisible: false,
  });
  const seriesD = chart.addLineSeries({
    priceScaleId: SCALE_ID,
    color: "#f59e0b",   // amber
    lineWidth: 2,
    lastValueVisible: false,
  });
  const seriesZero = chart.addLineSeries({
    priceScaleId: SCALE_ID,
    color: "rgba(149, 158, 172, 0.35)",
    lineWidth: 1,
    lastValueVisible: false,
  });

  function setBars(bars = []) {
    if (!Array.isArray(bars) || bars.length < Math.max(kLen, dLen) + 4) {
      seriesK.setData([]); seriesD.setData([]); seriesZero.setData([]);
      return;
    }

    const highs = bars.map(b => b.high);
    const lows  = bars.map(b => b.low);
    const close = bars.map(b => b.close);

    // %K SMI (Stochastic Momentum Index)
    // SMI uses double-smoothed median distance from midpoint and double-smoothed range.
    // Practical variant:
    //  mid = (HH+LL)/2, range = (HH-LL)
    //  m = close - mid
    //  dsM = EMA( EMA(m, kLen), emaLen )
    //  dsR = EMA( EMA(range, kLen), emaLen )
    //  SMI = 100 * (dsM / (dsR/2))  (guard div by 0)
    const HH = [], LL = [];
    for (let i = 0; i < bars.length; i++) {
      const i0 = Math.max(0, i - (kLen - 1));
      let h = -Infinity, l = Infinity;
      for (let j = i0; j <= i; j++) { if (highs[j] > h) h = highs[j]; if (lows[j] < l) l = lows[j]; }
      HH.push(h); LL.push(l);
    }
    const mid   = HH.map((h, i) => (h + LL[i]) / 2);
    const range = HH.map((h, i) => (h - LL[i]));

    const m = close.map((c, i) => c - mid[i]);
    const m1 = ema(m, kLen);   const m2 = ema(m1, emaLen);
    const r1 = ema(range, kLen); const r2 = ema(r1, emaLen);
    const smi = m2.map((v, i) => {
      const denom = (r2[i] || 0) / 2;
      return denom === 0 ? 0 : 100 * (v / denom);
    });

    // %D is EMA of %K over dLen
    const d = ema(smi, dLen);

    const dataK = smi.map((v, i) => ({ time: bars[i].time, value: v }));
    const dataD = d.map((v, i)   => ({ time: bars[i].time, value: v }));

    seriesK.setData(dataK);
    seriesD.setData(dataD);

    // zero-line for reference
    const zero = bars.map(b => ({ time: b.time, value: 0 }));
    seriesZero.setData(zero);

    // keep it visually centered (approx). Some builds ignore explicit autoscale,
    // so we rely on data range plus a soft margin implied by values.
    // If your lib supports autoscale provider, you could clamp here.
  }

  function remove() {
    try { chart.removeSeries(seriesK); } catch {}
    try { chart.removeSeries(seriesD); } catch {}
    try { chart.removeSeries(seriesZero); } catch {}
  }

  return { setBars, remove };
}
