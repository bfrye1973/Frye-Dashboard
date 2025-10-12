// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity overlay (factory):
// - draws simple pivot high/low markers as colored squares
// - uses the Lightweight-Charts chart instance to add a temp host series if needed
// - returns { update(candles), destroy() }

import { LineStyle } from "lightweight-charts";

export default function SwingLiquidityOverlay({
  chart,          // Lightweight-Charts chart instance
}) {
  if (!chart) return { update() {}, destroy() {} };

  // host “ghost” lineSeries (to own markers if you want later)
  let hostSeries = chart.addLineSeries({
    color: "rgba(0,0,0,0)",
    lineWidth: 1,
    visible: true,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    priceLineVisible: false,
  });

  // For drawing simple markers without thousands of series,
  // we’ll render into our own canvas on top of the chart container.
  // Find pane container from chart; fallback to document layering if needed.
  const container = chart._container || chart._chartWidget?._tableElement || chart.chartElement || null;
  // If we can’t find an internal container, we require RowChart to set position:relative on parent and pass us that instead.
  // But in our RowChart we use our own top-level container for other overlays, so we keep it simple:
  // create absolutely positioned canvas sibling on top of chart DOM.

  let overlayCanvas = document.createElement("canvas");
  Object.assign(overlayCanvas.style, {
    position: "absolute",
    left: 0, top: 0, right: 0, bottom: 0,
    pointerEvents: "none",
    zIndex: 9995,
  });

  // Attach to the same DOM parent as hostSeries container if possible,
  // otherwise the user must put position:relative on container and append overlay there.
  // Here we attempt to append to chart’s container node if present:
  let attachNode = chart._chartWidget?._paneWidgets?.[0]?._canvas?.parentElement
                || chart._chartWidget?._tableElement
                || overlayCanvas.parentElement;
  if (!attachNode) {
    // As a fallback, attach to document body (not ideal). RowChart sets container position:relative,
    // but for this factory, RowChart will not pass chartContainer here; so we try chart’s widget parent:
    attachNode = chart._container || document.body;
  }
  attachNode.appendChild(overlayCanvas);

  const syncSize = () => {
    const rect = attachNode.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    overlayCanvas.style.width  = `${rect.width}px`;
    overlayCanvas.style.height = `${rect.height}px`;
    overlayCanvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
    overlayCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = overlayCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const ro = new ResizeObserver(syncSize);
  ro.observe(attachNode);
  syncSize();

  function draw(candles) {
    const ctx = overlayCanvas.getContext("2d");
    const w = overlayCanvas.clientWidth;
    const h = overlayCanvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    if (!candles?.length) return;

    // screen-space mapping (approx): x by index, y by price
    const N = candles.length;
    const px = (i) => Math.round((i / Math.max(1, N - 1)) * w);

    let pMin = Infinity, pMax = -Infinity;
    for (const c of candles) {
      if (c.low  < pMin) pMin = c.low;
      if (c.high > pMax) pMax = c.high;
    }
    const yOf = (p) => {
      const t = (p - pMin) / Math.max(1e-9, (pMax - pMin));
      return h - Math.round(t * h);
    };

    const isPivotHigh = (i) =>
      i > 0 && i < N - 1 &&
      candles[i].high > candles[i - 1].high &&
      candles[i].high > candles[i + 1].high;

    const isPivotLow = (i) =>
      i > 0 && i < N - 1 &&
      candles[i].low < candles[i - 1].low &&
      candles[i].low < candles[i + 1].low;

    ctx.save();
    ctx.globalAlpha = 0.28;

    for (let i = 1; i < N - 1; i++) {
      if (isPivotHigh(i)) {
        const x = px(i);
        const y = yOf(candles[i].high);
        ctx.fillStyle = "rgba(255,80,80,0.45)"; // resistance
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
      if (isPivotLow(i)) {
        const x = px(i);
        const y = yOf(candles[i].low);
        ctx.fillStyle = "rgba(80,200,120,0.45)"; // support
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    ctx.restore();
  }

  return {
    update(candles) {
      syncSize();
      draw(candles);
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      try { overlayCanvas.remove(); } catch {}
      try { chart.removeSeries(hostSeries); } catch {}
      hostSeries = null;
    }
  };
}
