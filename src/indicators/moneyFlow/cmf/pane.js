export function cmfAttach(chartApi, seriesMap, values) {
  const pane = chartApi.addLineSeries({ priceLineVisible: false });
  seriesMap.set("cmf", pane);

  const candles = chartApi._candles || [];
  const data = values.map((v, i) => (v == null ? null : { time: candles[i].time, value: v })).filter(Boolean);
  pane.setData(data);

  const zero = pane.createPriceLine({ price: 0, lineStyle: 2, lineWidth: 1 });

  return () => {
    try { pane.removePriceLine(zero); } catch {}
    chartApi.removeSeries(pane);
    seriesMap.delete("cmf");
  };
}
