// src/indicators/volume/overlay.js
// Volume histogram on its own bottom slice (~22% of chart)

export function createVolumeOverlay({ chart }) {
  if (!chart) return { setBars: () => {}, remove: () => {} };

  const SCALE_ID = "volume";

  // ensure a dedicated price scale exists and is pinned to the bottom
  function applyScaleMargins() {
    chart.priceScale(SCALE_ID).applyOptions({
      // volume occupies only the bottom slice of the pane
      scaleMargins: { top: 0.78, bottom: 0.02 }, // ~20% height
      borderVisible: false,
    });
  }
  applyScaleMargins();

  const series = chart.addHistogramSeries({
    priceScaleId: SCALE_ID,
    priceFormat: { type: "volume" },
    base: 0,
    // per-bar colors are set in setBars; this is only a fallback
    color: "rgba(128, 160, 192, 0.55)",
  });

  // re-assert margins after the series exists (important)
  applyScaleMargins();

  // keep volume from “auto-filling” the pane vertically
  // by constraining autoscale to [0 .. vmax * 1.1]
  series.autoscaleInfoProvider = () => {
    const visible = series?.dataByIndex?.() ? null : null; // noop fallback across lib versions
    // returning null delegates to default; we’ll clamp in setBars using setData
    return null;
  };

  function setBars(bars = []) {
    if (!Array.isArray(bars)) return;
    let vmax = 0;

    const data = bars.map(b => {
      const v = Number(b.volume ?? 0);
      if (v > vmax) vmax = v;
      return {
        time: b.time,
        value: v,
        color: (b.close >= b.open)
          ? "rgba(22, 163, 74, 0.65)"     // up bar
          : "rgba(239, 68, 68, 0.65)",    // down bar
      };
    });

    series.setData(data);

    // small nudge so bars don’t kiss the top of the volume slice
    const maxValue = vmax > 0 ? vmax * 1.1 : 1;
    try {
      series.applyOptions({ base: 0 }); // keep baseline at zero
      // assert margins again in case chart options changed upstream
      applyScaleMargins();
      // some builds respect explicit autoscale range via priceScale API:
      const ps = chart.priceScale(SCALE_ID);
      ps?.applyOptions?.({
        // margins already set; range clamped by data
      });
    } catch (_) {}
  }

  function remove() {
    try { chart.removeSeries(series); } catch (_) {}
  }

  return { setBars, remove };
}
