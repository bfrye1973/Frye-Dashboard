// OverlayManager.js
// Minimal manager to keep overlays in the same lifecycle as the chart.
// Each overlay implements: attach({ chart, priceSeries, bars, bucketSizeSec }),
//                          seed(bars), update(bar), destroy()

export class OverlayManager {
  #chart = null;
  #priceSeries = null;
  #bucketSizeSec = 60;
  #overlays = [];
  #seeded = false;

  init({ chart, priceSeries, bars, bucketSizeSec }) {
    this.#chart = chart;
    this.#priceSeries = priceSeries;
    this.#bucketSizeSec = bucketSizeSec;
    this.#seeded = false;
    this.#overlays.forEach(o => o.destroy()); // safety
    this.#overlays = [];
    // return a small API to register overlays before we attach/seed
    return {
      register: (overlay) => { this.#overlays.push(overlay); },
    };
  }

  attachAll({ bars }) {
    if (!this.#chart || !this.#priceSeries) return;
    for (const o of this.#overlays) {
      o.attach({
        chart: this.#chart,
        priceSeries: this.#priceSeries,
        bars,
        bucketSizeSec: this.#bucketSizeSec,
      });
    }
  }

  seedAll(bars) {
    for (const o of this.#overlays) o.seed?.(bars);
    this.#seeded = true;
  }

  updateAll(latestBar) {
    if (!this.#seeded) return;
    for (const o of this.#overlays) o.update?.(latestBar);
  }

  destroyAll() {
    for (const o of this.#overlays) o.destroy?.();
    this.#overlays = [];
    this.#chart = null;
    this.#priceSeries = null;
  }
}
