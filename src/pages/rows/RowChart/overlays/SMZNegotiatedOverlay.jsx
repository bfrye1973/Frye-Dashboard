// src/pages/rows/RowChart/overlays/SMZNegotiatedOverlay.jsx
// Engine 1 — NEGOTIATED/VALUE zones ONLY (turquoise)
// Reads from /api/v1/smz-levels?symbol=SPY
// ✅ IMPORTANT: Uses structures_sticky as the primary source, because that contains manual parents + manual NEG.
//
// This overlay is a second canvas layer placed ABOVE institutional zones (zIndex 13).
// It does NOT touch institutional rendering. It only draws negotiated zones.

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels?symbol=SPY";

export default function SMZNegotiatedOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZNegotiatedOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let stickyStructures = [];
  let canvas = null;

  const ts = chart.timeScale();

  // --- Style (turquoise) ---
  // Keep fill semi-transparent so yellow shows underneath
  const NEG_FILL = "rgba(0, 220, 200, 0.12)";
  const NEG_BORDER = "rgba(0, 220, 200, 0.85)";
  const NEG_BORDER_W = 1;

  const MID_COLOR = "rgba(0, 220, 200, 0.35)";
  const MID_W = 1;

  function ensureCanvas() {
    if (canvas) return canvas;
    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-negotiated";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      // Above institutional (12), below shelves (14)
      zIndex: 13,
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

  // Prefer manualRange when present (sticky/manual zones)
  function effectiveRange(z) {
    const mr = z?.manualRange;
    if (Array.isArray(mr) && mr.length === 2) return mr;

    const pr = z?.priceRange;
    return Array.isArray(pr) && pr.length === 2 ? pr : null;
  }

  function getHiLo(range) {
    if (!Array.isArray(range) || range.length < 2) return null;

    let hi = safeNum(range[0]);
    let lo = safeNum(range[1]);
    if (hi == null || lo == null) return null;

    if (lo > hi) [hi, lo] = [lo, hi];
    if (!(hi > lo)) return null;

    return { hi, lo, mid: (hi + lo) / 2 };
  }

  function drawFill(ctx, w, hi, lo, fill) {
    const yTop = priceToY(hi);
    const yBot = priceToY(lo);
    if (yTop == null || yBot == null) return;

    const y = Math.min(yTop, yBot);
    const hBand = Math.max(2, Math.abs(yBot - yTop));

    ctx.fillStyle = fill;
    ctx.fillRect(0, y, w, hBand);
  }

  function drawDashedBox(ctx, w, hi, lo, stroke, strokeWidth = 1) {
    const yTop = priceToY(hi);
    const yBot = priceToY(lo);
    if (yTop == null || yBot == null) return;

    const y = Math.min(yTop, yBot);
    const hBand = Math.max(2, Math.abs(yBot - yTop));

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.rect(1, y + 1, w - 2, Math.max(1, hBand - 2));
    ctx.stroke();
    ctx.restore();
  }

  function drawDashedMid(ctx, w, midPrice, color, lineWidth = 1) {
    const y = priceToY(midPrice);
    if (y == null) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();
  }

  // Negotiated detection
  function isNegotiatedZone(z) {
    const id = String(z?.details?.id ?? z?.structureKey ?? z?.id ?? "");
    const factsSticky = z?.details?.facts?.sticky ?? {};
    const note = String(factsSticky?.notes ?? z?.notes ?? "");
    return id.includes("|NEG|") || note.toUpperCase().includes("NEGOTIATED");
  }

  function draw() {
    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    // ✅ PRIMARY SOURCE: structures_sticky (contains manual parents + manual NEG)
    // Fallback: levels (live)
    const pool =
      Array.isArray(stickyStructures) && stickyStructures.length
        ? stickyStructures
        : (levels || []);

    // Only negotiated
    const negs = pool.filter(isNegotiatedZone);

    negs.forEach((z) => {
      const r = getHiLo(effectiveRange(z));
      if (!r) return;

      const pad = 0.12;
      const hi = r.hi + pad;
      const lo = r.lo - pad;

      drawFill(ctx, w, hi, lo, NEG_FILL);
      drawDashedBox(ctx, w, hi, lo, NEG_BORDER, NEG_BORDER_W);
      drawDashedMid(ctx, w, r.mid, MID_COLOR, MID_W);
    });
  }

  async function loadLevels() {
    try {
      const res = await fetch(`${SMZ_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Keep both for fallback; negotiated primarily uses structures_sticky
      levels = Array.isArray(json?.levels) ? json.levels : [];
      stickyStructures = Array.isArray(json?.structures_sticky)
        ? json.structures_sticky
        : [];

      draw();
    } catch (e) {
      console.warn("[SMZNegotiatedOverlay] failed to load smz-levels:", e);
      levels = [];
      stickyStructures = [];
      draw();
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
    stickyStructures = [];
    try {
      unsubVisible();
    } catch {}
  }

  return { seed, update, destroy };
}
