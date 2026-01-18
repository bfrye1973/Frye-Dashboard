// src/pages/rows/RowChart/overlays/SMZShelvesOverlay.jsx
// Overlay for Accumulation / Distribution shelves (blue/red)
// Reads /api/v1/smz-shelves -> { ok:true, meta:{...}, levels:[...] }

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

  let levels = [];
  let canvas = null;
  let destroyed = false;

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

  function resizeCanvas(cnv) {
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;

    // Only resize if changed (helps performance)
    if (cnv.width !== w) cnv.width = w;
    if (cnv.height !== h) cnv.height = h;

    return { w, h };
  }

  function drawMidline(ctx, x0, x1, y, stroke) {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]); // dashed
    ctx.beginPath();
    ctx.moveTo(x0, y + 0.5);
    ctx.lineTo(x1, y + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(ctx, x, y, text, stroke) {
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "top";
    ctx.fillStyle = stroke;

    // simple dark backing for readability
    const padX = 6;
    const padY = 3;
    const metrics = ctx.measureText(text);
    const tw = Math.ceil(metrics.width);
    const th = 14;

    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.fillRect(x, y, tw + padX * 2, th + padY * 2);

    ctx.fillStyle = stroke;
    ctx.fillText(text, x + padX, y + padY);
    ctx.restore();
  }

  function clipText(s, max = 28) {
    const t = String(s || "").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "…";
  }

  function draw() {
    if (destroyed) return;

    // Always ensure canvas exists once overlay is active
    const cnv = ensureCanvas();
    const { w, h } = resizeCanvas(cnv);

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    if (!Array.isArray(levels) || levels.length === 0) return;

    for (const lvl of levels) {
      if (!lvl) continue;

      const t = String(lvl.type || "").toLowerCase();
      const isAccum = t === "accumulation";
      const isDist = t === "distribution";

      // Only draw these two types
      if (!isAccum && !isDist) continue;

      const fill = isAccum
        ? "rgba(0, 128, 255, 0.30)"   // blue
        : "rgba(255, 0, 0, 0.28)";    // red

      const stroke = isAccum
        ? "rgba(0, 128, 255, 0.95)"
        : "rgba(255, 0, 0, 0.95)";

      const pr = lvl.priceRange;
      if (!Array.isArray(pr) || pr.length !== 2) continue;

      const hi = Number(pr[0]);
      const lo = Number(pr[1]);
      if (!Number.isFinite(hi) || !Number.isFinite(lo)) continue;

      const yTop = priceToY(hi);
      const yBot = priceToY(lo);
      if (yTop == null || yBot == null) continue;

      const y = Math.min(yTop, yBot);
      const bandH = Math.max(2, Math.abs(yBot - yTop));

      // --- band ---
      ctx.fillStyle = fill;
      ctx.fillRect(0, y, w, bandH);

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, bandH - 1));
      ctx.stroke();

      // --- midline ---
      const mid = (hi + lo) / 2;
      const yMid = priceToY(mid);
      if (yMid != null && yMid >= 0 && yMid <= h) {
        drawMidline(ctx, 0, w, yMid, stroke);
      }

      // --- label ---
      const labelBase = isAccum ? "Accumulation" : "Distribution";

      // show score if present
      const score = Number(lvl.scoreOverride ?? lvl.strength ?? NaN);
      const scoreText = Number.isFinite(score) ? ` ${Math.round(score)}` : "";

      // optional short comment
      const comment = clipText(lvl.comment, 26);
      const commentText = comment ? ` — ${comment}` : "";

      const label = `${labelBase}${scoreText}${commentText}`;

      // place label near top-left of band, with bounds guard
      const labelX = 10;
      const labelY = Math.max(6, Math.min(h - 26, y + 6));

      drawLabel(ctx, labelX, labelY, label, stroke);
    }
  }

  async function loadShelves() {
    try {
      const res = await fetch(SMZ_SHELVES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();

      // ✅ Correct field name is "levels"
      const arr = Array.isArray(json.levels) ? json.levels : [];

      levels = arr;
      draw();
    } catch (e) {
      console.warn("[SMZShelvesOverlay] failed to load smz shelves:", e);
      levels = [];
      draw(); // still creates canvas; just empty
    }
  }

  // Load immediately
  loadShelves();

  // Redraw hooks
  const unsubVisible =
    ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  // Resize observer so shelves stay aligned
  const ro = new ResizeObserver(() => draw());
  try {
    ro.observe(chartContainer);
  } catch {}

  function seed() {
    draw();
  }

  function update() {
    draw();
  }

  function destroy() {
    destroyed = true;
    try {
      unsubVisible();
    } catch {}
    try {
      ro.disconnect();
    } catch {}
    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}
    canvas = null;
    levels = [];
  }

  return { seed, update, destroy };
}
