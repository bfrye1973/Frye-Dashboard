// src/indicators/volume/index.js
// Volume histogram pane

const DEF = {
  upColor:  "#22c55e",
  downColor:"#ef4444",
  neutral:  "#94a3b8",
  lineWidth: 1,
};

function volCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const n = candles?.length ?? 0;
  if (n === 0) return { bars: [], opts: o };
  const bars = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const up = c.close >= c.open;
    bars[i] = { time: c.time, value: c.volume ?? 0, color: up ? o.upColor : o.downColor };
  }
  return { bars, opts: o };
}

function volAttach(chartApi, seriesMap, result, inputs) {
  const hist = chartApi.addHistogramSeries({
    priceLineVisible: false,
    color: "#94a3b8",
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: null } }),
  });
  seriesMap.set("volume", hist);
  hist.setData(result.bars || []);

  return () => { try { chartApi.removeSeries(hist); } catch {}; seriesMap.delete("volume"); };
}

const VOL = {
  id: "vol",
  label: "Volume (Pane)",
  kind: "SEPARATE",
  defaults: DEF,
  compute: volCompute,
  attach: volAttach,
};

export default VOL;
