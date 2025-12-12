// src/pages/rows/RowChart/overlays/SMZShelvesOverlay.jsx
// Overlay for Accumulation / Distribution shelves (blue/red)
// Reads /api/v1/smz-shelves -> { ok:true, shelves:[...] }

const SMZ_SHELVES_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-shelves";

export default function SMZShelvesOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZShelvesOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  let shelves = [];
  let canvas = null;

  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;
    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-shelves";
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
    if (!canvas && (!shelves || shelves.length === 0)) return;

    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    if (!shelves || shelves.length === 0) return;

    shelves.forEach((lvl) => {
      if (!lvl) return;

      const isAccum = lvl.type === "accumulation";
      const isDist = lvl.type === "distribution" || !isAccum;

      let fill, stroke;
      if (isAccum) {
        fill = "rgba(0, 128, 255, 0.55)";
        stroke = "rgba(0, 128, 255, 1)";
      } else {
        fill = "rgba(255, 0, 0, 0.55)";
        stroke = "rgba(255, 0, 0, 1)";
      }

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
      }
    });
  }

  async function loadShelves() {
    try {
      const res = await fetch(SMZ_SHELVES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const arr = Array.isArray(json.shelves) ? json.shelves : [];
      shelves = arr;
      draw();
    } catch (e) {
      console.warn("[SMZShelvesOverlay] failed to load smz shelves:", e);
    }
  }

  loadShelves();

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
    shelves = [];
    unsubVisible();
  }

  return { seed, update, destroy };
}
