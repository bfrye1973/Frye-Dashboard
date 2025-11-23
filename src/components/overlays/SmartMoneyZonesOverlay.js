// src/components/overlays/SmartMoneyZonesOverlay.js
// Canvas overlay for Smart-Money Zones (simple bands from zones.json)
// This version only uses the zones passed into seed({ zones: [...] })

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

    // Draw each zone as a horizontal band across full visible width
    zones.forEach((z) => {
      if (z.top == null || z.bottom == null) return;
      const yTop = priceToY(z.top);
      const yBot = priceToY(z.bottom);
      if (yTop == null || yBot == null) return;

      const y = Math.min(yTop, yBot);
      const hBand = Math.max(2, Math.abs(yBot - yTop));

      // Color scheme:
      //  - bear  (distribution): red
      //  - bull  (accumulation): teal/green
      //  - smart_money type could be highlighted if needed
      let fill = "rgba(239, 83, 80, 0.18)";
      let stroke = "rgba(239, 83, 80, 0.9)";
      if (z.side === "bull") {
        fill = "rgba(16, 185, 129, 0.20)";
        stroke = "rgba(16, 185, 129, 0.95)";
      }

      // Draw band fill
      ctx.fillStyle = fill;
      ctx.fillRect(0, y, w, hBand);

      // Outline
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, hBand - 1);
      ctx.stroke();

      // Label text in the top-left of band
      const label = z.label || `${z.side === "bear" ? "Dist" : "Accum"} ${z.bottom}–${z.top}`;
      ctx.font = "11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.fillStyle = "#e5e7eb";
      ctx.textBaseline = "top";
      ctx.fillText(label, 6, y + 2);
    });
  }

  function seed(payload) {
    // Expect payload to be the JSON object from zones.json
    if (!payload || !Array.isArray(payload.zones)) {
      zones = [];
    } else {
      zones = payload.zones;
    }
    draw();
  }

  function update() {
    // For now, just re-draw on updates (resize/move)
    draw();
  }

  function destroy() {
    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch (e) {
      // ignore
    }
    canvas = null;
    zones = [];
  }

  // Re-draw when time range changes
  const unsubVisible = ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  return {
    seed,
    update,
    destroy() {
      unsubVisible();
      destroy();
    },
  };
}
