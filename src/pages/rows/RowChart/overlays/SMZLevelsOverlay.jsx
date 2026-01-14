// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — STRUCTURE (yellow) + POCKET (blue) + ACTIVE POCKETS (execution-only)
//
// ✅ RULES (LOCKED BY YOU):
// 1) Institutional STRUCTURES always win visually.
//    If a POCKET overlaps any STRUCTURE range, the POCKET is NOT drawn.
// 2) Active pockets draw ONLY the narrow execution band (no full-range halo)
//    AND only in "no man’s land" (NOT inside any STRUCTURE).
// 3) Optional: show high-score MICRO zones as faint dashed yellow "proto-structure".
// 4) Sticky registry zones MUST render as STRUCTURES and override live if overlapping.
//    (You manually edit sticky ranges; they must appear on map.)
//
// Contract:
// - priceRange is [HIGH, LOW]
// - sticky may include manualRange; if so, manualRange must be used for rendering.

const SMZ_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-levels?symbol=SPY";

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
  let pocketsActive = [];
  let stickyStructures = [];
  let canvas = null;

  const ts = chart.timeScale();

  // === ACTIVE POCKET EXECUTION BAND SETTINGS ===
  // 0.40 = tight, 0.30 = very tight, 0.50 = wider
  const EXEC_BAND_PCT = 0.4;

  // === MICRO DISPLAY SETTINGS ===
  const SHOW_MICRO = true;
  const MICRO_MIN_STRENGTH = 85;

  // === STICKY DISPLAY SETTINGS ===
  const SHOW_STICKY = true;

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

  // Prefer manualRange for sticky zones if present.
  // Contract: ranges are [HIGH, LOW]
  function effectiveRange(z) {
    const mr = z?.manualRange;
    if (Array.isArray(mr) && mr.length === 2) return mr;
    const pr = z?.priceRange;
    return Array.isArray(pr) && pr.length === 2 ? pr : null;
  }

  // Contract: range is [HIGH, LOW]
  function getHiLo(range) {
    if (!Array.isArray(range) || range.length < 2) return null;

    let hi = safeNum(range[0]);
    let lo = safeNum(range[1]);
    if (hi == null || lo == null) return null;

    if (lo > hi) {
      const t = hi;
      hi = lo;
      lo = t;
    }
    if (!(hi > lo)) return null;

    return { hi, lo, mid: (hi + lo) / 2 };
  }

  function overlapRatio(aHi, aLo, bHi, bLo) {
    const lo = Math.max(aLo, bLo);
    const hi = Math.min(aHi, bHi);
    const inter = hi - lo;
    if (inter <= 0) return 0;
    const denom = Math.min(aHi - aLo, bHi - bLo);
    return denom > 0 ? inter / denom : 0;
  }

  function rangesOverlap(a, b, minOv = 0.01) {
    if (!a || !b) return false;
    const ov = overlapRatio(a.hi, a.lo, b.hi, b.lo);
    return ov >= minOv;
  }

  function drawBand(ctx, w, hi, lo, fill, stroke, strokeWidth = 2) {
    const yTop = priceToY(hi);
    const yBot = priceToY(lo);
    if (yTop == null || yBot == null) return;

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
    ctx.rect(1, y + 1, w - 2, hBand - 2);
    ctx.stroke();
    ctx.restore();
  }

  function buildStructureRanges(structuresArr) {
    return (structuresArr || [])
      .map((s) => getHiLo(effectiveRange(s)))
      .filter(Boolean);
  }

  function pocketOverlapsAnyStructure(pocketRange, structureRanges) {
    if (!pocketRange) return false;
    for (const sr of structureRanges || []) {
      // Suppress if any modest overlap
      if (rangesOverlap(pocketRange, sr, 0.10)) return true;
      // Also suppress if pocket fully inside structure
      if (pocketRange.hi <= sr.hi && pocketRange.lo >= sr.lo) return true;
    }
    return false;
  }

  // ✅ Sticky must appear as STRUCTURE and override live if overlapping.
  // We do this by:
  // - taking live structures
  // - removing any live structure that overlaps a sticky zone
  // - adding sticky as tier:"structure"
  function mergeStickyOverLive(structuresLive, structuresSticky) {
    const out = (structuresLive || []).slice();

    const sticky = (structuresSticky || [])
      .filter((z) => (z?.tier ?? "") === "structure_sticky")
      .map((z) => ({ ...z, tier: "structure" })); // draw as structure

    sticky.forEach((sz) => {
      const sr = getHiLo(effectiveRange(sz));
      if (!sr) return;

      // Remove any live structure that overlaps sticky (sticky wins)
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
    if (
      (!levels || levels.length === 0) &&
      (!pocketsActive || pocketsActive.length === 0) &&
      (!stickyStructures || stickyStructures.length === 0)
    ) {
      return;
    }

    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    // Raw lists from API
    const structuresLive = (levels || []).filter(
      (l) => (l?.tier ?? "") === "structure"
    );
    const micros = (levels || []).filter((l) => (l?.tier ?? "") === "micro");
    const completedPocketsAll = (levels || []).filter(
      (l) => (l?.tier ?? "") === "pocket"
    );

    // ✅ Effective structures = live with sticky overrides applied
    const structuresEffective = mergeStickyOverLive(
      structuresLive,
      stickyStructures
    );

    // Structure ranges used to suppress completed pockets AND active pockets
    const structureRanges = buildStructureRanges(structuresEffective);

    // 0) STICKY STRUCTURES (optional) — subtle memory lane (outline only)
    // Note: They are ALSO drawn as full yellow structures below (because sticky becomes tier:"structure").
    if (SHOW_STICKY && Array.isArray(stickyStructures) && stickyStructures.length) {
      stickyStructures
        .filter((z) => (z?.tier ?? "") === "structure_sticky")
        .forEach((lvl) => {
          const r = getHiLo(effectiveRange(lvl));
          if (!r) return;
          drawDashedBox(ctx, w, r.hi, r.lo, "rgba(255,215,0,0.55)", 1);
        });
    }

    // 1) MICRO (proto-structure) — faint dashed yellow (only strong ones)
    if (SHOW_MICRO) {
      micros
        .filter((m) => (safeNum(m?.strength) ?? 0) >= MICRO_MIN_STRENGTH)
        .forEach((lvl) => {
          const r = getHiLo(effectiveRange(lvl));
          if (!r) return;
          drawBand(ctx, w, r.hi, r.lo, "rgba(255,215,0,0.04)", "rgba(0,0,0,0)", 0);
          drawDashedBox(ctx, w, r.hi, r.lo, "rgba(255,215,0,0.35)", 1);
        });
    }

    // 2) STRUCTURES — yellow (effective structures, sticky wins)
    structuresEffective.forEach((lvl) => {
      const r = getHiLo(effectiveRange(lvl));
      if (!r) return;

      const pad = 0.12;
      const hi = r.hi + pad;
      const lo = r.lo - pad;

      drawBand(ctx, w, hi, lo, "rgba(255,215,0,0.10)", "rgba(255,215,0,0.55)", 1);
    });

    // 3) COMPLETED POCKETS — blue, BUT suppressed if overlapping any STRUCTURE
    const completedPockets = completedPocketsAll.filter((lvl) => {
      const r = getHiLo(effectiveRange(lvl));
      if (!r) return false;
      return !pocketOverlapsAnyStructure(r, structureRanges);
    });

    completedPockets.forEach((lvl) => {
      const r = getHiLo(effectiveRange(lvl));
      if (!r) return;

      drawBand(ctx, w, r.hi, r.lo, "rgba(80,170,255,0.22)", "rgba(80,170,255,0.95)", 2);

      const facts = lvl?.details?.facts ?? {};
      const mid = safeNum(facts?.negotiationMid);
      if (mid != null) {
        drawDashedMid(ctx, w, mid, "rgba(255,55,200,0.95)", 2);
      }
    });

    // 4) ACTIVE POCKETS — execution band ONLY (no halo) AND NO-MAN’S-LAND ONLY
    const activeSorted = (pocketsActive || [])
      .slice()
      .filter(
        (p) =>
          (p?.tier ?? "") === "pocket_active" &&
          (p?.status ?? "building") === "building"
      )
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
      const r = getHiLo(effectiveRange(p));
      if (!r) return;

      // ✅ NO MAN’S LAND RULE: do NOT draw inside any structure range
      if (pocketOverlapsAnyStructure(r, structureRanges)) return;

      const mid = safeNum(p?.negotiationMid);
      if (mid == null) return;

      const st = safeNum(p?.strengthTotal) ?? 0;
      const isAPlus = st >= 90;

      const fullWidth = r.hi - r.lo;
      const halfBand = Math.max(0.05, fullWidth * 0.5 * EXEC_BAND_PCT);

      let execHi = mid + halfBand;
      let execLo = mid - halfBand;

      execHi = Math.min(execHi, r.hi);
      execLo = Math.max(execLo, r.lo);

      if (!(execHi > execLo)) return;

      const fillExec = isAPlus ? "rgba(255,50,50,0.22)" : "rgba(0,220,200,0.18)";
      const stroke = isAPlus ? "rgba(255,50,50,1.0)" : "rgba(0,220,200,1.0)";
      const borderW = isAPlus ? 3 : 2;

      drawBand(ctx, w, execHi, execLo, fillExec, stroke, borderW);
      drawDashedMid(ctx, w, mid, stroke, 2);
    });
  }

  async function loadLevels() {
    try {
      const res = await fetch(`${SMZ_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      levels = Array.isArray(json?.levels) ? json.levels : [];
      pocketsActive = Array.isArray(json?.pockets_active) ? json.pockets_active : [];
      stickyStructures = Array.isArray(json?.structures_sticky) ? json.structures_sticky : [];

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
    pocketsActive = [];
    stickyStructures = [];
    try {
      unsubVisible();
    } catch {}
  }

  return { seed, update, destroy };
}
