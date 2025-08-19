// Overlay EMA line on the main price pane
export function emaAttach(chartApi, seriesMap, values, inputs) {
  const { color = "#f59e0b", lineWidth = 2, id = "ema" } = inputs || {};
  const line = chartApi.addLineSeries({
    color,
    lineWidth,
    priceLineVisible: false,
  });
  seriesMap.set(id, line);

  const candles = chartApi._candles || [];
  const data = values
    .map((v, i) => (v == null ? null : { time: candles[i].time, value: v }))
    .filter(Boolean);
  line.setData(data);

  return () => {
    try { chartApi.removeSeries(line); } catch {}
    seriesMap.delete(id);
  };
}
