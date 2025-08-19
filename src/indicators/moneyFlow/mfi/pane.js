// src/indicators/moneyFlow/mfi/pane.js

// Toggle any guides here (true/false)
const SHOW_20 = true;
const SHOW_40 = true;
const SHOW_50 = true;
const SHOW_60 = true;
const SHOW_80 = true;

export function mfiAttach(chartApi, seriesMap, values, inputs) {
  // Main MFI line
  const pane = chartApi.addLineSeries({
    priceLineVisible: false,
    lineWidth: 2,
    // lock MFI scale to 0..100 so it doesn't autoscale weirdly
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  });
  seriesMap.set("mfi", pane);

  const candles = chartApi._candles || [];
  const data = values
    .map((v, i) => (v == null ? null : ({ time: candles[i].time, value: v })))
    .filter(Boolean);
  pane.setData(data);

  // Horizontal “boxes” (guide lines with labels)
  const guides = [];

  if (SHOW_20) guides.push(pane.createPriceLine({
    price: 20,
    title: "20",
    lineStyle: 2,         // dashed
    lineWidth: 1,
    color: "#db3a34",     // red-ish
  }));

  if (SHOW_40) guides.push(pane.createPriceLine({
    price: 40,
    title: "40",
    lineStyle: 3,         // dotted
    lineWidth: 1,
    color: "#7f8ea3",
  }));

  if (SHOW_50) guides.push(pane.createPriceLine({
    price: 50,
    title: "50",
    lineStyle: 3,
    lineWidth: 1,
    color: "#7f8ea3",
  }));

  if (SHOW_60) guides.push(pane.createPriceLine({
    price: 60,
    title: "60",
    lineStyle: 3,
    lineWidth: 1,
    color: "#7f8ea3",
  }));

  if (SHOW_80) guides.push(pane.createPriceLine({
    price: 80,
    title: "80",
    lineStyle: 2,         // dashed
    lineWidth: 1,
    color: "#12b886",     // green-ish
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
