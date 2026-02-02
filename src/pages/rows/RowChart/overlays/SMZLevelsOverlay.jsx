// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — INSTITUTIONAL STRUCTURES ONLY (yellow)
//
// ✅ LOCKED (PER USER):
// - Institutional zones come from smz-levels.json -> levels[] ONLY (live truth)
// - Institutional threshold = 85–100
// - NO dashed yellow lines at all (no sticky outlines, no midlines, no micro)
// - Negotiated (|NEG|) is NOT drawn here (handled by SMZNegotiatedOverlay)

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels?symbol=SPY";

export default function SMZLevelsOverlay({ chart, priceSeries, chartContainer, timeframe }) {
  console.log("[SMZLevelsOverlay] LIVE MARKER INSTITUTIONAL_LEVELS_ONLY");
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZLevelsOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let canvas = null;

  const ts = chart.timeScale();

  // ✅ Institutional = 85–100
  const INSTITUTIONAL_MIN = 85;

  // Solid-only style (no dashed)
  const FILL = "rgba(255,215,0,0.14)";
  const STROKE = "rgba(255,215,0,0.90)";
  const STROKE_W = 1;

  function ensureCanvas() {
    if (canvas) return canvas;
    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-institutional";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 12, // below negotiated (13) and shelves (14)
    });
    chartContainer.appendChild(cnv);
    canvas = cnv;
    return canvas;
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }

  function getHiLo(range) {
    if (!Array.isArray(range) || range.length < 2) return null;

    let hi = safeNum(range[0]);
    let lo = safeNum(range[1]);
    if (hi == null || lo == null) return null;

    if (lo > hi) [hi, lo] = [lo, hi];
    if (!(hi > lo)) return null;

    return { hi, lo };
  }

  function drawBand(ctx, w, hi, lo) {
    const yTop = priceToY(hi);
    const yBot = priceToY(lo);
    if (yTop == null || yBot == null) return;

    const y = Math.min(yTop, yBot);
    const hBand = Math.max(2, Math.abs(yBot - yTop));

    ctx.fillStyle = FILL;
    ctx.fillRect(0, y, w, hBand);

    ctx.strokeStyle = STROKE;
    ctx.lineWidth = STROKE_W;
    ctx.beginPath();
    ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
    ctx.stroke();
  }

  function draw() {
    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    if (!Array.isArray(levels) || !levels.length) return;

    // ✅ LEVELS ONLY: tier=structure, type=institutional, strength>=85
    for (const lvl of levels) {
      if (!lvl) continue;
      if (String(lvl?.tier ?? "") !== "structure") continue;
      if (String(lvl?.type ?? "") !== "institutional") continue;

      const strength = safeNum(lvl?.strength) ?? 0;
      if (strength < INSTITUTIONAL_MIN) continue;

      const pr = lvl?.priceRange;
      const r = getHiLo(pr);
      if (!r) continue;

      const pad = 0.12;
      drawBand(ctx, w, r.hi + pad, r.lo - pad);
    }
  }

  async function loadLevels() {
    try {
      const res = await fetch(`${SMZ_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // ✅ Only use levels[] — ignore structures_sticky entirely
      levels = Array.isArray(json?.levels) ? json.levels : [];

      draw();
    } catch (e) {
      console.warn("[SMZLevelsOverlay] failed to load smz-levels:", e);
      levels = [];
      draw();
    }
  }

  loadLevels();

  function seed() { draw(); }
  function update() { draw(); }

  const unsubVisible = ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  function destroy() {
    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}
    canvas = null;
    levels = [];
    try { unsubVisible(); } catch {}
  }

  return { seed, update, destroy };
}
