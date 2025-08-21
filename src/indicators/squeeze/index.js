// src/indicators/squeeze/index.js
// Squeeze Index [LuxAlgo] — single-file pane indicator (0..100)

const DEF = {
  conv: 50,      // Convergence factor
  length: 20,    // correlation window
  src: "close",  // source: "close" | "hlc3" etc. (we use close here)
};

function getSrc(c) { return c.close; }

// rolling correlation corr(x,y,len)
function rollingCorrelation(x, y, len) {
  const n = x.length;
  const out = new Array(n).fill(null);
  let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;

  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i];
    sumX += xi; sumY += yi; sumXX += xi * xi; sumYY += yi * yi; sumXY += xi * yi;

    if (i >= len) {
      const xo = x[i - len], yo = y[i - len];
      sumX -= xo; sumY -= yo; sumXX -= xo * xo; sumYY -= yo * yo; sumXY -= xo * yo;
    }
    if (i >= len - 1) {
      const L = len;
      const cov = sumXY / L - (sumX / L) * (sumY / L);
      const varX = sumXX / L - (sumX / L) * (sumX / L);
      const varY = sumYY / L - (sumY / L) * (sumY / L);
      const denom = Math.sqrt(Math.max(varX, 0)) * Math.sqrt(Math.max(varY, 0));
      out[i] = denom > 0 ? cov / denom : 0;
    }
  }
  return out;
}

function squeezeCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const n = candles?.length ?? 0;
  if (n === 0) return { psi: [], opts: o };

  // max/min recursion per Pine
  const src = candles.map(getSrc);
  const max = new Array(n).fill(0);
  const min = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const s = src[i];
    if (i === 0) { max[i] = s; min[i] = s; continue; }
    const prevMax = max[i - 1], prevMin = min[i - 1];
    max[i] = Math.max(s, prevMax - (prevMax - s) / o.conv);
    min[i] = Math.min(s, prevMin + (s - prevMin) / o.conv);
  }

  // diff = log(max - min), clamp to avoid <=0
  const diff = new Array(n);
  for (let i = 0; i < n; i++) {
    const d = Math.max(1e-10, max[i] - min[i]);
    diff[i] = Math.log(d);
  }

  // correlation(diff, bar_index, length)
  const barIndex = Array.from({ length: n }, (_, i) => i);
  const corr = rollingCorrelation(diff, barIndex, Math.max(2, o.length));

  // psi = -50 * corr + 50   (0..100 scale)
  const psi = corr.map(c => -50 * (c ?? 0) + 50);

  return { psi, opts: o };
}

function squeezeAttach(chartApi, seriesMap, result, inputs) {
  const pane = chartApi.addLineSeries({
    color: "#7dd3fc", // cyan-ish
    lineWidth: 2,
    priceLineVisible: false,
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  });
  seriesMap.set("squeeze", pane);

  const candles = chartApi._candles || [];
  const data = result.psi.map((v, i) => (v == null ? null : { time: candles[i].time, value: v })).filter(Boolean);
  pane.setData(data);

  // Cross markers when psi > 80
  const markers = [];
  for (let i = 0; i < data.length; i++) {
    const v = data[i].value;
    if (v > 80) {
      markers.push({
        time: data[i].time,
        position: "aboveBar",
        color: "#ef4444",
        shape: "cross",
        size: 0,
      });
    }
  }
  try { pane.setMarkers(markers); } catch {}

  // Horizontal guide at 80
  const g80 = pane.createPriceLine({ price: 80, color: "#ef4444", lineStyle: 2, lineWidth: 1, title: "80" });

  return () => {
    try { pane.removePriceLine(g80); chartApi.removeSeries(pane); } catch {}
    seriesMap.delete("squeeze");
  };
}

const SQUEEZE = {
  id: "squeeze",
  label: "Squeeze Index (LuxAlgo)",
  kind: "SEPARATE",
  defaults: DEF,
  compute: squeezeCompute,
  attach: squeezeAttach,
};

export default SQUEEZE;
