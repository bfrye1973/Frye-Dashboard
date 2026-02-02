// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — INSTITUTIONAL PARENTS ONLY (yellow)
//
// ✅ LOCKED:
// - Manual institutional parents ALWAYS show (from structures_sticky)
// - Live institutional zones show ONLY if strength >= 85 (from levels[])
// - NO dashed yellow lines, NO midlines, NO micro, NO sticky outlines
// - Negotiated (|NEG|) is NOT drawn here (handled by SMZNegotiatedOverlay)

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels?symbol=SPY";

export default function SMZLevelsOverlay({ chart, priceSeries, chartContainer, timeframe }) {
  console.log("[SMZLevelsOverlay] LIVE MARKER MANUAL+LIVE_INSTITUTIONAL");
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SMZLevelsOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let sticky = [];
  let canvas = null;

  const ts = chart.timeScale();

  // Institutional threshold (live only)
  const INSTITUTIONAL_MIN = 85;

  // Solid-only yellow style
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

  function getHiLo(range) {
    if (!Array.isArray(range) || range.length !== 2) return null;
    let a = safeNum(range[0]);
    let b = safeNum(range[1]);
    if (a == null || b == null) return null;
    let hi = Math.max(a, b);
    let lo = Math.min(a, b);
    if (!(hi > lo)) return null;
    return { hi, lo };
  }

  function zoneId(z) {
    return String(z?.details?.id ?? z?.structureKey ?? z?.id ?? "");
  }

  function isNegotiated(z) {
    const id = zoneId(z);
    return id.includes("|NEG|");
  }

  function isManualInstitutionalParent(z) {
    const id = zoneId(z);
    if (!id.startsWith("MANUAL|")) return false;
    if (id.includes("|NEG|")) return false;
    return true;
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

    // 1) Manual institutional parents ALWAYS (structures_sticky)
    if (Array.isArray(sticky) && sticky.length) {
      for (const z of sticky) {
        if (!z) continue;
        if (String(z?.tier ?? "") !== "structure_sticky") continue;
        if (!isManualInstitutionalParent(z)) continue;

        const r = getHiLo(z?.priceRange);
        if (!r) continue;

        const pad = 0.12;
        drawBand(ctx, w, r.hi + pad, r.lo - pad);
      }
    }

    // 2) Live institutional zones from levels[] ONLY if strength >= 85
    if (Array.isArray(levels) && levels.length) {
      for (const lvl of levels) {
        if (!lvl) continue;
        if (String(lvl?.tier ?? "") !== "structure") continue;
        if (String(lvl?.type ?? "") !== "institutional") continue;

        const strength = safeNum(lvl?.strength) ?? 0;
        if (strength < INSTITUTIONAL_MIN) continue;

        const r = getHiLo(lvl?.priceRange);
        if (!r) continue;

        const pad = 0.12;
        drawBand(ctx, w, r.hi + pad, r.lo - pad);
      }
    }
  }

  async function loadLevels() {
    try {
      const res = await fetch(`${SMZ_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      levels = Array.isArray(json?.levels) ? json.levels : [];
      sticky = Array.isArray(json?.structures_sticky) ? json.structures_sticky : [];

      draw();
    } catch (e) {
      console.warn("[SMZLevelsOverlay] failed to load smz-levels:", e);
      levels = [];
      sticky = [];
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
    sticky = [];
    try { unsubVisible(); } catch {}
  }

  return { seed, update, destroy };
}
