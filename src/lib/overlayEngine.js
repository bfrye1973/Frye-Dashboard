// src/lib/overlayEngine.js
// Minimal overlay engine: manages a canvas layer & dataset.
// Tomorrow we’ll register Money Flow, SMI, S/R, Liquidity overlays here.

export class OverlayEngine {
  constructor(chart) {
    this.chart = chart;
    this.dataset = [];
    this.overlays = {};
    this._initCanvasLayer();
  }

  _initCanvasLayer() {
    const container =
      this.chart?._container ||
      this.chart?._internal__container ||
      this.chart?.chartElement?.parentElement;
    if (!container) return;

    container.style.position = "relative";
    const layer = document.createElement("canvas");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    container.appendChild(layer);

    this.canvas = layer;
    this.ctx = layer.getContext("2d");

    // auto-resize + redraw hooks
    const draw = () => this.draw();
    this.ro = new ResizeObserver(draw);
    this.ro.observe(container);
    this.unsubA = this.chart.timeScale().subscribeVisibleTimeRangeChange(draw);
    this.unsubB = this.chart.timeScale().subscribeVisibleLogicalRangeChange(draw);
    setTimeout(draw, 50);
  }

  setDataset(candles) {
    this.dataset = Array.isArray(candles) ? candles : [];
    this.draw();
  }

  register(name, renderer) {
    this.overlays[name] = renderer; // renderer(ctx, chart, dataset)
    this.draw();
  }

  unregister(name) {
    delete this.overlays[name];
    this.draw();
  }

  clear() {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    if (this.canvas.width !== Math.floor(W * dpr) || this.canvas.height !== Math.floor(H * dpr)) {
      this.canvas.width = Math.floor(W * dpr);
      this.canvas.height = Math.floor(H * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, W, H);
  }

  draw() {
    if (!this.chart || !this.canvas || !this.ctx) return;
    this.clear();
    for (const key of Object.keys(this.overlays)) {
      try {
        this.overlays[key](this.ctx, this.chart, this.dataset);
      } catch (e) {
        // fail-safe: keep chart alive even if an overlay throws
        // console.error("overlay error:", key, e);
      }
    }
  }

  destroy() {
    try { this.ro?.disconnect(); } catch {}
    try { this.chart?.timeScale()?.unsubscribeVisibleTimeRangeChange(this.draw); } catch {}
    try { this.chart?.timeScale()?.unsubscribeVisibleLogicalRangeChange(this.draw); } catch {}
    try { this.canvas?.remove(); } catch {}
  }
}
