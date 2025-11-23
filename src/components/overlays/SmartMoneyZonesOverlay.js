// src/components/overlays/SmartMoneyZonesOverlay.js
// Canvas overlay for Smart-Money Zones (simple bands from zones.json)

export default function createSmartMoneyZonesOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZOverlay] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  let zones = [];
  let canvas = null;

  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;
    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 12,
    });
    chartContainer.appendChild(cnv);
    canvas = cnv;
    return canvas;
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }

  function draw() {
    if (!zones || zones.length === 0) {
      const cnv = ensureCanvas();
      const ctx = cnv.getContext("2d");
      ctx.clearRect(0, 0, cnv.width, cnv.height);
      return;
    }

    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    zones.forEach((z) => {
      if (z.top == null || z.bottom == null) return;
      const yTop = priceToY(z.top);
      const yBot = priceToY(z.bottom);
      if (yTop == null || yBot == null) return;

      const y = Math.min(yTop, yBot);
      const hBand = Math.max(2, Math.abs(yBot - yTop));

      // ------------------------------------
      // YELLOW ZONE COLOR (updated)
      // ------------------------------------
      const fill = "rgba(255, 215, 0, 0.22)";  // yellow soft fill
      const stroke = "rgba(255, 215, 0, 0.95)"; // yellow strong outline

      // Draw band fill
      ctx.fillStyle = fill;
      ctx.fillRect(0, y, w, hBand);

      // Outline
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, hBand - 1);
      ctx.stroke();

      // ------------------------------------
      // LABEL — moved to TOP RIGHT (updated)
      // ------------------------------------
      const label =
        z.label || `${z.side === "bear" ? "Dist" : "Accum"} ${z.bottom}–${z.top}`;

      ctx.font = "11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.fillStyle = "#e5e7eb"; // light grey text
      ctx.textBaseline = "top";

      // right edge padding = 6px
      const textWidth = ctx.measureText(label).width;
      const xRight = w - textWidth - 6;

      ctx.fillText(label, xRight, y + 2);
    });
  }

  function seed(payload) {
    if (!payload || !Array.isArray(payload.zones)) {
      zones = [];
    } else {
      zones = payload.zones;
    }
    draw();
  }

  function update() {
    draw();
  }

  function destroy() {
    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch (e) {}
    canvas = null;
    zones = [];
  }

  const unsubVisible =
    ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  return {
    seed,
    update,
    destroy() {
      unsubVisible();
      destroy();
    },
  };
}
