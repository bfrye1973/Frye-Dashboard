// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — STRUCTURE (yellow) + POCKET (blue) + ACTIVE POCKETS (teal / red if 90+)
//
// - STRUCTURE: tier:"structure"  (yellow faint)
// - POCKET: tier:"pocket"        (blue + pink dashed mid)
// - ACTIVE: pockets_active[]     (teal, but red if strengthTotal >= 90)
//
// NOTE: This overlay reads from backend-1 /api/v1/smz-levels?symbol=SPY

const SMZ_URL = "https://frye-market-backend-1.onrender.com/api/v1/smz-levels?symbol=SPY";

export default function SMZLevelsOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZLevelsOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let pocketsActive = [];
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

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }

  // Contract: priceRange is [HIGH, LOW]
  function getHiLo(priceRange) {
    if (!Array.isArray(priceRange) || priceRange.length < 2) return null;
    let hi = safeNum(priceRange[0]);
    let lo = safeNum(priceRange[1]);
    if (hi == null || lo == null) return null;
    if (lo > hi) {
      const t = hi;
      hi = lo;
      lo = t;
    }
    if (!(hi > lo)) return null;
    return { hi, lo };
  }

  drawBand(ctx, w, hi, lo,
    "rgba(255,215,0,0.10)",  // fill
    "rgba(255,215,0,0.55)",  // border
    1
  );


    const y = Math.min(yTop, yBot);
    const hBand = Math.max(2, Math.abs(yBot - yTop));

    ctx.fillStyle = fill;
    ctx.fillRect(0, y, w, hBand);

    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.rect(0.5, y + 0.5, w - 1, hBand - 1);
    ctx.stroke();
  }

  function drawDashedMid(ctx, w, midPrice, color, lineWidth = 2) {
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

  function draw() {
    if ((!levels || levels.length === 0) && (!pocketsActive || pocketsActive.length === 0)) return;

    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    const structures = (levels || []).filter((l) => (l?.tier ?? "") === "structure");
    const completedPockets = (levels || []).filter((l) => (l?.tier ?? "") === "pocket");

    // 1) STRUCTURES — yellow faint
    structures.forEach((lvl) => {
      const r = getHiLo(lvl?.priceRange);
      if (!r) return;

      const pad = 0.12;
      const hi = r.hi + pad;
      const lo = r.lo - pad;

      drawBand(ctx, w, hi, lo, "rgba(255,215,0,0.06)", "rgba(255,215,0,0.35)", 1);
    });

    // 2) COMPLETED POCKETS — blue + pink dashed midline
    completedPockets.forEach((lvl) => {
      const r = getHiLo(lvl?.priceRange);
      if (!r) return;

      drawBand(ctx, w, r.hi, r.lo, "rgba(80,170,255,0.22)", "rgba(80,170,255,0.95)", 2);

      const facts = lvl?.details?.facts ?? {};
      const mid = safeNum(facts?.negotiationMid);
      if (mid != null) {
        drawDashedMid(ctx, w, mid, "rgba(255,55,200,0.95)", 2);
      }
    });

    // 3) ACTIVE POCKETS — teal, BUT red if strengthTotal >= 90
    const activeSorted = (pocketsActive || [])
      .slice()
      .filter((p) => (p?.tier ?? "") === "pocket_active" && (p?.status ?? "building") === "building")
      .sort((a, b) => {
        const ra = safeNum(a?.relevanceScore) ?? 0;
        const rb = safeNum(b?.relevanceScore) ?? 0;
        if (rb !== ra) return rb - ra;
        const sa = safeNum(a?.strengthTotal) ?? 0;
        const sb = safeNum(b?.strengthTotal) ?? 0;
        return sb - sa;
      })
      .slice(0, 12);

    activeSorted.forEach((p) => {
      const r = getHiLo(p?.priceRange);
      if (!r) return;

      const mid = safeNum(p?.negotiationMid);
      const st = safeNum(p?.strengthTotal) ?? 0;

      const isAPlus = st >= 90;
      const fill = isAPlus ? "rgba(255,50,50,0.20)" : "rgba(0,220,200,0.16)";
      const stroke = isAPlus ? "rgba(255,50,50,1.0)" : "rgba(0,220,200,1.0)";
      const borderW = isAPlus ? 3 : 2;

      drawBand(ctx, w, r.hi, r.lo, fill, stroke, borderW);

      if (mid != null) {
        drawDashedMid(ctx, w, mid, stroke, 2);
      }
    });
  }

  async function loadLevels() {
    try {
      const res = await fetch(`${SMZ_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      levels = Array.isArray(json?.levels) ? json.levels : [];
      pocketsActive = Array.isArray(json?.pockets_active) ? json.pockets_active : [];

      draw();
    } catch (e) {
      console.warn("[SMZLevelsOverlay] failed to load smz-levels:", e);
    }
  }

  loadLevels();

  function seed() {
    draw();
  }

  function update() {
    draw();
  }

  const unsubVisible = ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  function destroy() {
    try {
      if (canvas && canvas.parentNode === chartContainer) chartContainer.removeChild(canvas);
    } catch {}
    canvas = null;
    levels = [];
    pocketsActive = [];
    try {
      unsubVisible();
    } catch {}
  }

  return { seed, update, destroy };
}
