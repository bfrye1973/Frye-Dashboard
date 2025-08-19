// src/indicators/moneyFlow/mfi/pane.js

export function mfiAttach(chartApi, seriesMap, values, inputs) {
  // CLEAR, OBVIOUS STYLE so we can verify deploy
  const pane = chartApi.addLineSeries({
    color: "#00E5FF",       // bright cyan (changed)
    lineWidth: 3,           // thicker (changed)
    priceLineVisible: false,
    // lock scale to 0..100
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  });
  seriesMap.set("mfi", pane);

  const candles = chartApi._candles || [];
  const data = values
    .map((v, i) => (v == null ? null : ({ time: candles[i].time, value: v })))
    .filter(Boolean);
  pane.setData(data);

  // Horizontal guides with DISTINCT labels so you can see them changed
  const guides = [];
  guides.push(pane.createPriceLine({
    price: 20, title: "Z20", lineStyle: 2, lineWidth: 1, color: "#FF3B3B"
  }));
  guides.push(pane.createPriceLine({
    price: 40, title: "Z40", lineStyle: 3, lineWidth: 1, color: "#FFDD57"
  }));
  guides.push(pane.createPriceLine({
    price: 50, title: "Z50", lineStyle: 3, lineWidth: 1, color: "#A0AEC0"
  }));
  guides.push(pane.createPriceLine({
    price: 60, title: "Z60", lineStyle: 3, lineWidth: 1, color: "#7BDFF2"
  }));
  guides.push(pane.createPriceLine({
    price: 80, title: "Z80", lineStyle: 2, lineWidth: 1, color: "#00C853"
  }));

  // cleanup
  return () => {
    try {
      for (const g of guides) pane.removePriceLine(g);
      chartApi.removeSeries(pane);
    } catch {}
    seriesMap.delete("mfi");
  };
}
