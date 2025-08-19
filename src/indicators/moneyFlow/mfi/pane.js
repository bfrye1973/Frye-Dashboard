// src/indicators/moneyFlow/mfi/pane.js

export function mfiAttach(chartApi, seriesMap, values, inputs) {
  const pane = chartApi.addLineSeries({
    priceLineVisible: false,
    lineWidth: 2,
    color: "#00E5FF",
    // 🔒 Lock Y-axis to 0–100 so the pane doesn’t stretch
    autoscaleInfoProvider: () => ({
      priceRange: { minValue: 0, maxValue: 100 },
    }),
  });
  seriesMap.set("mfi", pane);

  const candles = chartApi._candles || [];
  const data = values
    .map((v, i) => (v == null ? null : { time: candles[i].time, value: v }))
    .filter(Boolean);
  pane.setData(data);

  // horizontal guides at common levels
  const guides = [];
  guides.push(pane.createPriceLine({ price: 20, title: "20", color: "#FF3B3B", lineStyle: 2, lineWidth: 1 }));
  guides.push(pane.createPriceLine({ price: 40, title: "40", color: "#999999", lineStyle: 3, lineWidth: 1 }));
  guides.push(pane.createPriceLine({ price: 50, title: "50", color: "#999999", lineStyle: 3, lineWidth: 1 }));
  guides.push(pane.createPriceLine({ price: 60, title: "60", color: "#999999", lineStyle: 3, lineWidth: 1 }));
  guides.push(pane.createPriceLine({ price: 80, title: "80", color: "#12b886", lineStyle: 2, lineWidth: 1 }));

  return () => {
    try { guides.forEach((g) => pane.removePriceLine(g)); chartApi.removeSeries(pane); } catch {}
    seriesMap.delete("mfi");
  };
}
