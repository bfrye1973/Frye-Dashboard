// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — INSTITUTIONAL PARENTS ONLY (yellow)
//
// ✅ LOCKED:
// - Manual institutional parents ALWAYS show (from structures_sticky)
// - Live institutional zones show ONLY if strength >= 85 (from levels[])
// - NO dashed yellow lines, NO midlines, NO micro, NO sticky outlines
// - Negotiated (|NEG|) is NOT drawn here (handled by SMZNegotiatedOverlay)
//
// ✅ FIX (this rewrite):
// - Prevent "big yellow blob" by filling only a limited number of key bands.
// - All other institutionals are outline-only (still visible, no carpet).

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels?symbol=SPY";

export default function SMZLevelsOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let sticky = [];
  let canvas = null;

  const ts = chart.timeScale();

  // Institutional threshold (live only)
  const INSTITUTIONAL_MIN = 85;

  // Visual tuning to avoid blob
  const PAD = 0.06;                 // smaller padding than before
  const MAX_FILLED_TOTAL = 3;       // total number of filled bands (manual+live)
  const MAX_FILLED_MANUAL = 2;      // how many manual zones get filled
  const MAX_FILLED_LIVE = 1;        // how many live >=85 zones get filled

  // Styles
  const FILL = "rgba(255,215,0,0.06)";       // much lighter fill
  const STROKE = "rgba(255,215,0,0.75)";
  const OUTLINE = "rgba(255,215,0,0.55)";
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
    return { hi, lo, width: hi - lo, mid: (hi + lo) / 2 };
  }

  function zoneId(z) {
    return String(z?.details?.id ?? z?.structureKey ?? z?.id ?? "");
  }

  function isNegotiated(z) {
    // Prefer explicit flag if present; fallback to id
    if (z?.isNegotiated === true) return true;
    const id = zoneId(z);
    return id.includes("|NEG|");
  }

  function isManualInstitutionalParent(z) {
    const id = zoneId(z);
    if (!id.startsWith("MANUAL|")) return false;
    if (id.includes("|NEG|")) return false;
    if (z?.isNegotiated === true) return false;
    return true;
  }

  function drawBand(ctx, w, hi, lo, filled) {
    const yTop = priceToY(hi);
    const yBot = priceToY(lo);
    if (yTop == null || yBot == null) return;

    const y = Math.min(yTop, yBot);
    const hBand = Math.max(2, Math.abs(yBot - yTop));

    if (filled) {
      ctx.fillStyle = FILL;
      ctx.fillRect(0, y, w, hBand);

      ctx.strokeStyle = STROKE;
      ctx.lineWidth = STROKE_W;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
      ctx.stroke();
    } else {
      // Outline-only (no fill) to avoid blob
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
      ctx.stroke();
    }
  }

  function getCurrentPrice() {
    // Try to read last close from priceSeries (best effort)
    try {
      const last = priceSeries?.dataByIndex?.(ts?.getVisibleLogicalRange?.()?.to ?? 0, -1);
      const c = last?.value ?? last?.close ?? null;
      const n = safeNum(c);
      return n;
    } catch {
      return null;
    }
  }

  function draw() {
    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    const currentPrice = getCurrentPrice();

    // Collect manual institutional parents
    const manualZones = (Array.isArray(sticky) ? sticky : [])
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => isManualInstitutionalParent(z))
      .map((z) => {
        const r = getHiLo(z?.priceRange);
        if (!r) return null;
        // rank by closeness to current price if available, else by width (tighter first)
        const dist = Number.isFinite(currentPrice)
          ? Math.abs(r.mid - currentPrice)
          : r.width;
        return { z, r, dist };
      })
      .filter(Boolean)
      .sort((a, b) => a.dist - b.dist);

    // Collect live institutional structures (>=85 only)
    const liveZones = (Array.isArray(levels) ? levels : [])
      .filter((lvl) => lvl && String(lvl?.tier ?? "") === "structure")
      .filter((lvl) => String(lvl?.type ?? "") === "institutional")
      .filter((lvl) => {
        if (isNegotiated(lvl)) return false;
        const s = safeNum(lvl?.strength) ?? 0;
        return s >= INSTITUTIONAL_MIN;
      })
      .map((lvl) => {
        const r = getHiLo(lvl?.priceRange);
        if (!r) return null;
        const dist = Number.isFinite(currentPrice)
          ? Math.abs(r.mid - currentPrice)
          : r.width;
        const strength = safeNum(lvl?.strength) ?? 0;
        return { lvl, r, dist, strength };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // closer first, then stronger, then tighter
        if (a.dist !== b.dist) return a.dist - b.dist;
        if (b.strength !== a.strength) return b.strength - a.strength;
        return a.r.width - b.r.width;
      });

    // Decide which to FILL
    const fillManual = manualZones.slice(0, MAX_FILLED_MANUAL);
    const fillLive = liveZones.slice(0, MAX_FILLED_LIVE);

    // Combined filled cap
    const filled = [...fillManual, ...fillLive].slice(0, MAX_FILLED_TOTAL);

    // Draw manual first (so outlines don’t cover fills weirdly)
    for (const item of manualZones) {
      const { r } = item;
      const isFilled = filled.some((x) => x === item);
      drawBand(ctx, w, r.hi + PAD, r.lo - PAD, isFilled);
    }

    // Draw live next
    for (const item of liveZones) {
      const { r } = item;
      const isFilled = filled.some((x) => x === item);
      drawBand(ctx, w, r.hi + PAD, r.lo - PAD, isFilled);
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
