// src/indicators/volume/overlay.js
// Lightweight Charts volume histogram overlay (bottom 20% pane)

export function createVolumeOverlay({ chart }) {
  if (!chart) return { setBars: () => {}, remove: () => {} };

  const SCALE_ID = "volume";

  const scale = chart.priceScale(SCALE_ID);
  scale.applyOptions({
    scaleMargins: { top: 0.80, bottom: 0.02 }, // bottom ~20%
    borderVisible: false,
  });

  const series = chart.addHistogramSeries({
    priceScaleId: SCALE_ID,
    priceFormat: { type: "volume" },
    base: 0,
    color: "rgba(128, 160, 192, 0.55)", // fallback
  });

  function setBars(bars = []) {
    if (!Array.isArray(bars)) return;
    const data = bars.map(b => ({
      time: b.time,
      value: Number(b.volume ?? 0),
      color: (b.close >= b.open)
        ? "rgba(22, 163, 74, 0.65)"   // green up bar
        : "rgba(239, 68, 68, 0.65)",  // red down bar
    }));
    series.setData(data);
  }

  function remove() {
    try { chart.removeSeries(series); } catch (_) {}
  }

  return { setBars, remove };
}
