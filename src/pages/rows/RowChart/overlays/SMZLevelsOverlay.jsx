// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Canvas overlay for Accumulation / Distribution levels
// Reads /data/smz-levels.json and draws:
//  - thin red bands for accumulation
//  - thin blue bands for distribution

export default function createSMZLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZLevelsOverlay] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let canvas = null;

  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;
    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-levels";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 13, // just above zones
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
    if (!levels || levels.length === 0) {
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

    levels.forEach((lvl) => {
      const isAccum = lvl.type === "accumulation";
      const fill =
        isAccum ? "rgba(255, 51, 85, 0.25)" : "rgba(51, 128, 255, 0.25)";
      const stroke =
        isAccum ? "rgba(255, 51, 85, 0.9)" : "rgba(51, 128, 255, 0.9)";

      // 1) Single price level → thin horizontal band
      if (typeof lvl.price === "number") {
        const y = priceToY(lvl.price);
        if (y == null) return;
        const bandH = 4; // pixels

        const top = y - bandH / 2;
        const height = bandH;

        ctx.fillStyle = fill;
        ctx.fillRect(0, top, w, height);

        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }

      // 2) Price range → filled band
      if (Array.isArray(lvl.priceRange) && lvl.priceRange.length === 2) {
        const [hi, lo] = lvl.priceRange;
        const yTop = priceToY(hi);
        const yBot = priceToY(lo);
        if (yTop == null || yBot == null) return;

        const y = Math.min(yTop, yBot);
        const hBand = Math.max(2, Math.abs(yBot - yTop));

        ctx.fillStyle = fill;
        ctx.fillRect(0, y, w, hBand);

        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(0.5, y + 0.5, w - 1, hBand - 1);
        ctx.stroke();
      }
    });
  }

  async function loadLevels() {
    try {
      const res = await fetch("/smz-levels.json");
      if (!res.ok) return;
      const json = await res.json();
      levels = Array.isArray(json.levels) ? json.levels : [];
      draw();
    } catch (e) {
      console.warn("[SMZLevelsOverlay] failed to load smz-levels.json", e);
    }
  }

  // Initial load
  loadLevels();

  function seed() {
    // We don't need bar data here, but keep the method for API compatibility.
    draw();
  }

  function update() {
    draw();
  }

  function destroyCanvas() {
    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}
    canvas = null;
  }

  const unsubVisible =
    ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  return {
    seed,
    update,
    destroy() {
      unsubVisible();
      destroyCanvas();
      levels = [];
    },
  };
}
