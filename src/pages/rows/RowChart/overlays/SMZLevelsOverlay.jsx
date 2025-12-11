// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Module-style overlay for Accumulation / Distribution / Institutional levels
// Used via attachOverlay(SMZLevelsOverlay, { chart, priceSeries, chartContainer, timeframe })

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels";

export default function SMZLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn(
      "[SMZLevelsOverlay] missing chart/priceSeries/chartContainer"
    );
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
      zIndex: 13,
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
    if (!canvas && (!levels || levels.length === 0)) return;

    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    if (!levels || levels.length === 0) return;

    levels.forEach((lvl) => {
      if (!lvl) return;

      // --- Color by zone type ---
      const isInst = lvl.type === "institutional";
      const isAccum = lvl.type === "accumulation";
      const isDist =
        lvl.type === "distribution" || (!isInst && !isAccum);

      let fill, stroke;
      if (isInst) {
        // Institutional = YELLOW
        fill = "rgba(255, 215, 0, 0.35)";
        stroke = "rgba(255, 215, 0, 0.9)";
      } else if (isAccum) {
        // Accumulation = BLUE
        fill = "rgba(0, 128, 255, 0.6)";
        stroke = "rgba(0, 128, 255, 1)";
      } else if (isDist) {
        // Distribution = RED
        fill = "rgba(255, 0, 0, 0.6)";
        stroke = "rgba(255, 0, 0, 1)";
      } else {
        // Fallback (shouldn't happen)
        fill = "rgba(128, 128, 128, 0.4)";
        stroke = "rgba(128, 128, 128, 0.9)";
      }

      // --- 1) Price RANGE → use [hi, lo] if present ---
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
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(0.5, y + 0.5, w - 1, hBand - 1);
        ctx.stroke();
        return;
      }

      // --- 2) Single price → fallback $1 band ---
      if (typeof lvl.price === "number") {
        const hi = lvl.price + 0.5;
        const lo = lvl.price - 0.5;
        const yTop = priceToY(hi);
        const yBot = priceToY(lo);
        if (yTop == null || yBot == null) return;

        const y = Math.min(yTop, yBot);
        const hBand = Math.max(2, Math.abs(yBot - yTop));

        ctx.fillStyle = fill;
        ctx.fillRect(0, y, w, hBand);

        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(0.5, y + 0.5, w - 1, hBand - 1);
        ctx.stroke();
      }
    });
  }

  async function loadLevels() {
    try {
      const res = await fetch(SMZ_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const arr = Array.isArray(json.levels) ? json.levels : [];
      levels = arr;
      draw();
    } catch (e) {
      console.warn("[SMZLevelsOverlay] failed to load smz-levels:", e);
    }
  }

  // Initial load
  loadLevels();

  function seed() {
    draw();
  }

  function update() {
    draw();
  }

  const unsubVisible =
    ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  function destroy() {
    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}
    canvas = null;
    levels = [];
    unsubVisible();
  }

  return {
    seed,
    update,
    destroy,
  };
}
