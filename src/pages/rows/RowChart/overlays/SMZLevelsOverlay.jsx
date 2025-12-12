// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Overlay for INSTITUTIONAL Smart Money Zones (YELLOW ONLY)

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels";

export default function SMZLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZLevelsOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let canvas = null;

  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;
    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-institutional";
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
      if (!lvl || !Array.isArray(lvl.priceRange)) return;

      const [hi, lo] = lvl.priceRange;
      const yTop = priceToY(hi);
      const yBot = priceToY(lo);
      if (yTop == null || yBot == null) return;

      const y = Math.min(yTop, yBot);
      const hBand = Math.max(2, Math.abs(yBot - yTop));

      // INSTITUTIONAL = YELLOW
      ctx.fillStyle = "rgba(255, 215, 0, 0.35)";
      ctx.fillRect(0, y, w, hBand);

      ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, hBand - 1);
      ctx.stroke();
    });
  }

  async function loadLevels() {
    try {
      const res = await fetch(SMZ_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      levels = Array.isArray(json.levels) ? json.levels : [];
      draw();
    } catch (e) {
      console.warn("[SMZLevelsOverlay] failed to load institutional levels:", e);
    }
  }

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

  return { seed, update, destroy };
}
