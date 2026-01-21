// src/pages/rows/RowChart/overlays/SMZNegotiatedOverlay.jsx
// Negotiated-only overlay (turquoise) drawn on a separate canvas ABOVE institutional.

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels?symbol=SPY";

export default function SMZNegotiatedOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeframe,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZNegotiatedOverlay] missing deps");
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let stickyStructures = [];
  let canvas = null;

  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;
    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-negotiated";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      // ABOVE institutional (12), BELOW shelves (14)
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
    if (yTop == null || yBot == null) return { y: null, hBand: null };

    const y = Math.min(yTop, yBot);
    const hBand = Math.max(2, Math.abs(yBot - yTop));

    ctx.fillStyle = fill;
    ctx.fillRect(0, y, w, hBand);

    return { y, hBand };
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

  function isStickyZone(z) {
    return (z?.tier ?? "") === "structure_sticky";
  }

  function isNegotiatedZone(lvl) {
    const id = String(lvl?.details?.id ?? lvl?.structureKey ?? lvl?.id ?? "");
    const sticky = lvl?.details?.facts?.sticky ?? {};
    const note = String(sticky?.notes ?? lvl?.notes ?? "");
    return id.includes("|NEG|") || note.toUpperCase().includes("NEGOTIATED");
  }

  function mergeStickyOverLive(structuresLive, structuresSticky) {
    const out = (structuresLive || []).slice();

    const sticky = (structuresSticky || [])
      .filter(isStickyZone)
      .map((z) => ({ ...z, tier: "structure" }));

    sticky.forEach((sz) => {
      const sr = getHiLo(effectiveRange(sz));
      if (!sr) return;

      for (let i = out.length - 1; i >= 0; i--) {
        const lr = getHiLo(effectiveRange(out[i]));
        if (!lr) continue;
        if (lr.hi >= sr.lo && lr.lo <= sr.hi) out.splice(i, 1);
      }
      out.push(sz);
    });

    return out;
  }

  function draw() {
    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    const structuresLive = (levels || []).filter((l) => (l?.tier ?? "") === "structure");
    const structuresEffective = mergeStickyOverLive(structuresLive, stickyStructures);

    const negs = structuresEffective.filter(isNegotiatedZone);

    negs.forEach((lvl) => {
      const r = getHiLo(effectiveRange(lvl));
      if (!r) return;

      const pad = 0.12;
      const hi = r.hi + pad;
      const lo = r.lo - pad;

      // Semi-transparent so yellow shows underneath
      drawFill(ctx, w, hi, lo, "rgba(0,220,200,0.12)");
      drawDashedBox(ctx, w, hi, lo, "rgba(0,220,200,0.85)", 1);
      drawDashedMid(ctx, w, r.mid, "rgba(0,220,200,0.35)", 1);
    });
  }

  async function loadLevels() {
    try {
      const res = await fetch(`${SMZ_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      levels = Array.isArray(json?.levels) ? json.levels : [];
      stickyStructures = Array.isArray(json?.structures_sticky) ? json.structures_sticky : [];

      draw();
    } catch (e) {
      console.warn("[SMZNegotiatedOverlay] failed to load smz-levels:", e);
      levels = [];
      stickyStructures = [];
      draw();
    }
  }

  loadLevels();

  function seed() { draw(); }
  function update() { draw(); }

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
    try { unsubVisible(); } catch {}
  }

  return { seed, update, destroy };
}
