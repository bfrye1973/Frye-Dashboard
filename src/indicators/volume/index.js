// src/indicators/volume/index.js
// Volume histogram pane (SEPARATE)

const DEF = {
  upColor:   "#22c55e",  // green
  downColor: "#ef4444",  // red
  neutral:   "#94a3b8",
};

function volCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const bars = (candles || []).map(c => ({
    time: c.time,
    value: Number(c.volume ?? 0),
    color: (c.close >= c.open) ? o.upColor : o.downColor,
  }));
  return { bars, opts: o };
}

function volAttach(chartApi, seriesMap, result, inputs) {
  const hist = chartApi.addHistogramSeries({
    priceLineVisible: false,
    priceFormat: { type: "volume" }, // important for proper axis formatting
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: null } }),
    // fallback color (per-point color overrides this)
    color: "#94a3b8",
  });
  seriesMap.set("vol", hist);

  // Per-bar colors supported by setData()
  hist.setData(result.bars || []);

  return () => { try { chartApi.removeSeries(hist); } catch {}; seriesMap.delete("vol"); };
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
