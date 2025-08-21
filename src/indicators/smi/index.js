// src/indicators/smi/index.js
// Stochastic Momentum Index (SMI) + signal — pane 0..100

const DEF = {
  length: 14,
  smooth: 3,
  signal: 3,
};

function emaVec(src, len) {
  const out = new Array(src.length).fill(null);
  if (len <= 1) return src.slice();
  const k = 2 / (len + 1);
  let v = 0, inited = false;
  for (let i = 0; i < src.length; i++) {
    const x = src[i];
    if (x == null) { out[i] = null; continue; }
    if (!inited) { v = x; inited = true; out[i] = v; continue; }
    v = x * k + v * (1 - k);
    out[i] = v;
  }
  return out;
}
function highest(arr, from, len) {
  let m = -Infinity;
  for (let i = from - len + 1; i <= from; i++) m = Math.max(m, arr[i]);
  return m;
}
function lowest(arr, from, len) {
  let m = Infinity;
  for (let i = from - len + 1; i <= from; i++) m = Math.min(m, arr[i]);
  return m;
}

function smiCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const n = candles?.length ?? 0;
  if (n === 0) return { smi: [], sig: [], opts: o };

  const H = candles.map(c => c.high);
  const L = candles.map(c => c.low);
  const C = candles.map(c => c.close);

  const D = new Array(n).fill(null);
  const HL = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < o.length - 1) continue;
    const hh = highest(H, i, o.length);
    const ll = lowest(L, i, o.length);
    const mid = (hh + ll) / 2;
    D[i] = C[i] - mid;
    HL[i] = (hh - ll) / 2;
  }

  const Ds1 = emaVec(D, o.smooth);
  const Ds2 = emaVec(Ds1, o.smooth);
  const Hs1 = emaVec(HL, o.smooth);
  const Hs2 = emaVec(Hs1, o.smooth);

  const smi = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (Ds2[i] == null || Hs2[i] == null || Hs2[i] === 0) continue;
    smi[i] = 100 * (Ds2[i] / Hs2[i]);
  }
  const sig = emaVec(smi, o.signal);

  return { smi, sig, opts: o };
}

function smiAttach(chartApi, seriesMap, result, inputs) {
  const pane = chartApi.addLineSeries({
    color: "#22d3ee",
    lineWidth: 2,
    priceLineVisible: false,
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  });
  const sig = chartApi.addLineSeries({
    color: "#f59e0b",
    lineWidth: 1,
    priceLineVisible: false,
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  });

  seriesMap.set("smi", pane);
  seriesMap.set("smi_sig", sig);

  const candles = chartApi._candles || [];
  const smiData = result.smi.map((v, i) => (v == null ? null : { time: candles[i].time, value: v })).filter(Boolean);
  const sigData = result.sig.map((v, i) => (v == null ? null : { time: candles[i].time, value: v })).filter(Boolean);
  pane.setData(smiData);
  sig.setData(sigData);

  const g20 = pane.createPriceLine({ price: 20, color: "#94a3b8", lineStyle: 3, lineWidth: 1, title: "20" });
  const g80 = pane.createPriceLine({ price: 80, color: "#94a3b8", lineStyle: 3, lineWidth: 1, title: "80" });

  return () => {
    try { pane.removePriceLine(g20); pane.removePriceLine(g80); chartApi.removeSeries(pane); chartApi.removeSeries(sig); } catch {}
    seriesMap.delete("smi"); seriesMap.delete("smi_sig");
  };
}

const SMI = {
  id: "smi",
  label: "Stochastic Momentum Index",
  kind: "SEPARATE",
  defaults: DEF,
  compute: smiCompute,
  attach: smiAttach,
};

export default SMI;
