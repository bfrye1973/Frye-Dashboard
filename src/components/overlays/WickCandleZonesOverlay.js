// src/components/overlays/WickCandleZonesOverlay.js
// Canvas overlay for "Smart Money Zones — Wick & Candle (Step A)"
// Factory signature matches your attachOverlay(...) pattern.

import { computeWickCandleZones } from "../../indicators/smz/wickCandleZones";

export default function createWickCandleZonesOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,   // unused for now; thresholds live in engine defaults
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[WickCandleZonesOverlay] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  let zones = [];
  let events = [];
  let rafId = null;

  const ts = chart.timeScale();

  function yFor(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }
  function xFor(timeSec) {
    const x = ts.timeToCoordinate(timeSec);
    return Number.isFinite(x) ? x : null;
  }

  function draw() {
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;

    let cnv = chartContainer.querySelector("canvas.overlay-canvas.smz-wick");
    if (!cnv) {
      cnv = document.createElement("canvas");
      cnv.className = "overlay-canvas smz-wick";
      Object.assign(cnv.style, {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 12,
      });
      chartContainer.appendChild(cnv);
    }
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    // Draw zones as horizontal rectangles spanning current visible range
    const vis = ts.getVisibleRange?.();
    const xLeft = 0;
    const xRight = w;

    zones.forEach((z) => {
      const yTop = yFor(z.top);
      const yBot = yFor(z.bottom);
      if (yTop == null || yBot == null) return;

      const yMin = Math.min(yTop, yBot);
      const yMax = Math.max(yTop, yBot);
      const col = z.side === "bull" ? "rgba(52, 152, 219, 0.28)" : "rgba(231, 76, 60, 0.28)";
      const bor = z.side === "bull" ? "rgba(41, 128, 185, 0.35)" : "rgba(192, 57, 43, 0.35)";

      ctx.fillStyle = col;
      ctx.fillRect(xLeft, yMin, xRight - xLeft, Math.max(2, yMax - yMin));

      ctx.lineWidth = 1;
      ctx.strokeStyle = bor;
      ctx.strokeRect(xLeft + 0.5, yMin + 0.5, (xRight - xLeft) - 1, Math.max(1, (yMax - yMin) - 1));

      // Label
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const tag = z.side === "bull" ? "ACCUM — PA" : "DIST — PA";
      ctx.fillText(tag, xLeft + 6, yMin + 12);
      ctx.fillText(z.origin, xLeft + 6, yMin + 24);
    });
  }

  function scheduleDraw() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      draw();
    });
  }

  const onVisible = () => scheduleDraw();
  ts.subscribeVisibleTimeRangeChange?.(onVisible);

  return {
    seed(barsAsc) {
      try {
        const { events: ev, zones: zn } = computeWickCandleZones(barsAsc);
        zones = zn;
        events = ev;
        draw();
      } catch (e) {
        console.error("[WickCandleZonesOverlay] seed error:", e);
        zones = [];
        events = [];
      }
    },
    update(lastBar) {
      // For Step A, recompute occasionally to keep logic simple.
      // If you want full streaming, swap to an incremental update later.
      scheduleDraw();
    },
    destroy() {
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisible); } catch {}
      const cnv = chartContainer.querySelector("canvas.overlay-canvas.smz-wick");
      if (cnv && cnv.parentNode === chartContainer) chartContainer.removeChild(cnv);
    },
  };
}
