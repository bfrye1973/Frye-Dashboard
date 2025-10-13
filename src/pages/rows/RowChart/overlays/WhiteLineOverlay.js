// WhiteLineOverlay.js
// A simple line-series overlay to prove pane/time alignment.
// Uses the same price pane; no priceScaleId specified.

export function WhiteLineOverlay() {
  let lineSeries = null;
  let last = null;

  return {
    attach({ chart, priceSeries }) {
      // mirror price scale so the line sits on the same pane/scale
      const priceScaleId = priceSeries.priceScale().id();
      lineSeries = chart.addLineSeries({
        priceLineVisible: false,
        lastValueVisible: false,
        lineWidth: 2,
        // do NOT set priceScaleId to "" — we want the main price scale
        priceScaleId,
      });
      // Expose for quick dev inspection if desired
      if (typeof window !== "undefined") window.__refLine = lineSeries;
    },

    seed(bars) {
      if (!lineSeries || !bars?.length) return;
      last = bars[bars.length - 1];
      const prev = bars[Math.max(0, bars.length - 2)];
      // draw a 2-point horizontal-ish segment near last close
      const val = last.close;
      lineSeries.setData([
        { time: prev.time, value: val },
        { time: last.time, value: val },
      ]);
    },

    update(bar) {
      if (!lineSeries || !bar) return;
      last = bar;
      const data = lineSeries._series?._data || lineSeries._data || []; // guard for LWC internals
      const lastPoint = Array.isArray(data) ? data[data.length - 1] : null;

      // replace or append by time (aligns with candles)
      if (lastPoint && lastPoint.time === bar.time) {
        lineSeries.update({ time: bar.time, value: bar.close });
      } else {
        lineSeries.update({ time: bar.time, value: bar.close });
      }
    },

    destroy() {
      if (lineSeries) {
        lineSeries.priceScale().mode && lineSeries.priceScale().mode(); // no-op guard
        lineSeries = null;
      }
    },
  };
}
