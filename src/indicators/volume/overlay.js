export function volumeAttach(chartApi, seriesMap, values) {
  // Histogram on main pane (under candles)
  const vol = chartApi.addHistogramSeries({
    priceFormat: { type: "volume" },
    priceScaleId: "",
  });
  seriesMap.set("volume", vol);

  vol.setData(values);

  return () => {
    try { chartApi.removeSeries(vol); } catch {}
    seriesMap.delete("volume");
  };
}
