export function mfiAttach(chartApi, seriesMap, values) {
  const pane = chartApi.addLineSeries({
    priceLineVisible: false,
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  });
  seriesMap.set("mfi", pane);

  const candles = chartApi._candles || [];
  const data = values.map((v, i) => (v == null ? null : { time: candles[i].time, value: v })).filter(Boolean);
  pane.setData(data);

  const lower = pane.createPriceLine({ price: 20, lineStyle: 2, lineWidth: 1 });
  const upper = pane.createPriceLine({ price: 80, lineStyle: 2, lineWidth: 1 });

  return () => {
    try { pane.removePriceLine(lower); pane.removePriceLine(upper); } catch {}
    chartApi.removeSeries(pane);
    seriesMap.delete("mfi");
  };
}

