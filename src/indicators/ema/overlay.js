// Lightweight-charts overlay helper for EMA
// Usage: const ema20 = createEmaOverlay({ chart, period:20, color:'#22c55e' });
//        ema20.setBars(bars);  ema20.remove();

import { computeEMA } from "./compute";

export function createEmaOverlay({
  chart,
  period = 20,
  color = "#22c55e",
  src = "close",
  lineWidth = 2,
}) {
  if (!chart) throw new Error("createEmaOverlay: chart is required");

  const series = chart.addLineSeries({
    priceScaleId: "right",
    color,
    lineWidth,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: true,
  });

  function setBars(bars) {
    const data = computeEMA(bars || [], period, src);
    series.setData(data);
  }

  function remove() {
    try { chart.removeSeries(series); } catch {}
  }

  return { setBars, remove, series, period };
}
