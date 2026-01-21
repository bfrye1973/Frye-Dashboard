// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — STRUCTURE (yellow) + NEGOTIATED/VALUE (turquoise)
// Pockets are deprecated and replaced by Shelves.
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
  let stickyStructures = [];
  let canvas = null;

  const ts = chart.timeScale();

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
      // Institutional fill below shelves (shelves zIndex = 14)
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

    if (lo > hi) {
      const t = hi;
      hi = lo;
      lo = t;
    }
    if (!(hi > lo)) return null;

    return { hi, lo, mid: (hi + lo) / 2 };
  }

  function drawBand(ctx, w, hi, lo, fill, stroke, strokeWidth = 1) {
    const yTop = priceToY(hi);
    const yBot = priceToY(lo);
    if (yTop == null || yBot == null) return { y: null, hBand: null };

    const y = Math.min(yTop, yBot);
    const hBand = Math.max(2, Math.abs(yBot - yTop));

    ctx.fillStyle = fill;
    ctx.fillRect(0, y, w, hBand);

    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
    ctx.stroke();

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

  function isStickyZone(z) {
    return (z?.tier ?? "") === "structure_sticky";
  }

  // ✅ Detect negotiated/value zones (turquoise)
  function isNegotiatedZone(lvl) {
    const id = String(lvl?.details?.id ?? lvl?.structureKey ?? lvl?.id ?? "");
    const sticky = lvl?.details?.facts?.sticky ?? {};
    const note = String(sticky?.notes ?? lvl?.notes ?? "");
    return id.includes("|NEG|") || note.toUpperCase().includes("NEGOTIATED");
  }

  // Sticky overrides live structures if overlapping
  function mergeStickyOverLive(structuresLive, structuresSticky) {
    const out = (structuresLive || []).slice();

    const sticky = (structuresSticky || [])
      .filter(isStickyZone)
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

  function clipText(s, max = 30) {
    const t = String(s || "").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "…";
  }

  function drawCenteredLabel(ctx, xMid, yMid, text, color, boundsW, boundsH) {
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const padX = 8;
    const padY = 5;
    const metrics = ctx.measureText(text);
    const tw = Math.ceil(metrics.width);
    const th = 14;

    let x = Math.round(xMid);
    let y = Math.round(yMid);

    const boxW = tw + padX * 2;
    const boxH = th + padY * 2;

    const minX = Math.ceil(boxW / 2) + 2;
    const maxX = boundsW - Math.ceil(boxW / 2) - 2;
    const minY = Math.ceil(boxH / 2) + 2;
    const maxY = boundsH - Math.ceil(boxH / 2) - 2;

    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function draw() {
    const cnv = ensureCanvas();
    const w = chartContainer.clientWidth || 1;
    const h = chartContainer.clientHeight || 1;
    cnv.width = w;
    cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    if ((!levels || levels.length === 0) && (!stickyStructures || stickyStructures.length === 0)) {
      return;
    }

    const structuresLive = (levels || []).filter((l) => (l?.tier ?? "") === "structure");
    const micros = (levels || []).filter((l) => (l?.tier ?? "") === "micro");

    const structuresEffective = mergeStickyOverLive(structuresLive, stickyStructures);

    // 0) Sticky outline (optional)
    if (SHOW_STICKY && Array.isArray(stickyStructures) && stickyStructures.length) {
      stickyStructures
        .filter(isStickyZone)
        .forEach((lvl) => {
          const r = getHiLo(effectiveRange(lvl));
          if (!r) return;

          // negotiated zones get turquoise dashed outline
          const isNEG = isNegotiatedZone(lvl);
          const stroke = isNEG ? "rgba(0, 220, 200, 0.65)" : "rgba(255,215,0,0.45)";
          drawDashedBox(ctx, w, r.hi, r.lo, stroke, 1);
        });
    }

    // 1) Micro proto-structure dashed (optional)
    if (SHOW_MICRO) {
      micros
        .filter((m) => (safeNum(m?.strength) ?? 0) >= MICRO_MIN_STRENGTH)
        .forEach((lvl) => {
          const r = getHiLo(effectiveRange(lvl));
          if (!r) return;
          drawBand(ctx, w, r.hi, r.lo, "rgba(255,215,0,0.03)", "rgba(0,0,0,0)", 0);
          drawDashedBox(ctx, w, r.hi, r.lo, "rgba(255,215,0,0.28)", 1);
        });
    }

    // 2) Structures (effective)
    structuresEffective.forEach((lvl) => {
      const r = getHiLo(effectiveRange(lvl));
      if (!r) return;

      const isNEG = isNegotiatedZone(lvl);

      // Slight pad for aesthetics
      const pad = 0.12;
      const hi = r.hi + pad;
      const lo = r.lo - pad;

      // ✅ Color scheme:
      // Institutional = yellow
      // Negotiated/value = turquoise
      const fill = isNEG ? "rgba(0, 220, 200, 0.14)" : "rgba(255,215,0,0.14)";
      const stroke = isNEG ? "rgba(0, 220, 200, 0.75)" : "rgba(255,215,0,0.9)";

      const { y, hBand } = drawBand(ctx, w, hi, lo, fill, stroke, 1);
      if (y == null || hBand == null) return;

      // Centered label
      const strength = safeNum(lvl?.strength);
      const scoreText = strength != null ? ` ${Math.round(strength)}` : "";

      const facts = lvl?.details?.facts ?? {};
      const sticky = facts?.sticky ?? null;

      const note = clipText(sticky?.notes ?? lvl?.notes ?? "", 26);
      const noteText = note ? ` — ${note}` : "";

      const label = isNEG
        ? `Negotiated${scoreText}${noteText}`
        : `Institutional${scoreText}${noteText}`;

      const xCenter = w / 2;
      const yCenter = y + hBand / 2;

      drawCenteredLabel(
        ctx,
        xCenter,
        yCenter,
        label,
        isNEG ? "rgba(0, 220, 200, 0.95)" : "rgba(255,215,0,0.95)",
        w,
        h
      );

      // dashed midline (helps visual)
      drawDashedMid(ctx, w, r.mid, isNEG ? "rgba(0,220,200,0.35)" : "rgba(255,215,0,0.35)", 1);
    });

    // ✅ No pockets drawn (deprecated)
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
      console.warn("[SMZLevelsOverlay] failed to load smz-levels:", e);
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
