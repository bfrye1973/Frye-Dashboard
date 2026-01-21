// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — STRUCTURE (yellow) + NEGOTIATED/VALUE (turquoise)
// Pockets are deprecated and replaced by Shelves.
//
// Contract:
// - priceRange is [HIGH, LOW]
// - sticky may include manualRange; if so, manualRange must be used for rendering.
//
// GOAL (Option A):
// - Make INSTITUTIONAL (parent) clearly bright yellow
// - Keep NEGOTIATED (turquoise) clearly bright, but with a more transparent fill
//   so the yellow parent still shows through.
// - Bright outlines for both.

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

  // === STYLE (Option A) ===
  // Parent (Institutional) = BRIGHTER yellow
  const INST_FILL = "rgba(255,215,0,0.22)";     // brighter than before
  const INST_STROKE = "rgba(255,215,0,0.95)";   // bright border
  const INST_STROKE_W = 2;                      // thicker border
  const INST_LABEL = "rgba(255,215,0,0.98)";

  // Negotiated (Turquoise) = BRIGHT border/label, but MORE transparent fill
  // so yellow parent remains visible underneath.
  const NEG_FILL = "rgba(0,220,200,0.10)";      // reduced fill alpha
  const NEG_STROKE = "rgba(0,220,200,0.95)";    // bright border
  const NEG_STROKE_W = 2;                       // thicker border
  const NEG_LABEL = "rgba(0,220,200,0.98)";

  // Midlines (kept subtle)
  const MID_INST = "rgba(255,215,0,0.35)";
  const MID_NEG = "rgba(0,220,200,0.35)";

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

    if (fill && fill !== "rgba(0,0,0,0)" && fill !== "transparent") {
      ctx.fillStyle = fill;
      ctx.fillRect(0, y, w, hBand);
    }

    if (stroke && stroke !== "rgba(0,0,0,0)" && stroke !== "transparent" && strokeWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
      ctx.stroke();
    }

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

    if (
      (!levels || levels.length === 0) &&
      (!stickyStructures || stickyStructures.length === 0)
    ) {
      return;
    }

    const structuresLive = (levels || []).filter(
      (l) => (l?.tier ?? "") === "structure"
    );
    const micros = (levels || []).filter((l) => (l?.tier ?? "") === "micro");

    const structuresEffective = mergeStickyOverLive(
      structuresLive,
      stickyStructures
    );

    // 0) Sticky outline (optional)
    if (SHOW_STICKY && Array.isArray(stickyStructures) && stickyStructures.length) {
      stickyStructures
        .filter(isStickyZone)
        .forEach((lvl) => {
          const r = getHiLo(effectiveRange(lvl));
          if (!r) return;

          const isNEG = isNegotiatedZone(lvl);
          const stroke = isNEG ? "rgba(0, 220, 200, 0.75)" : "rgba(255,215,0,0.55)";
          drawDashedBox(ctx, w, r.hi, r.lo, stroke, 1.5);
        });
    }

    // 1) Micro proto-structure dashed (optional)
    if (SHOW_MICRO) {
      micros
        .filter((m) => (safeNum(m?.strength) ?? 0) >= MICRO_MIN_STRENGTH)
        .forEach((lvl) => {
          const r = getHiLo(effectiveRange(lvl));
          if (!r) return;
          drawBand(ctx, w, r.hi, r.lo, "rgba(255,215,0,0.05)", "rgba(0,0,0,0)", 0);
          drawDashedBox(ctx, w, r.hi, r.lo, "rgba(255,215,0,0.35)", 1);
        });
    }

    // 2) Structures (effective): parents first then negotiated LAST so turquoise stays on top
    // We intentionally draw parents first, negotiated second.
    const parents = structuresEffective.filter((z) => !isNegotiatedZone(z));
    const negs = structuresEffective.filter((z) => isNegotiatedZone(z));

    parents.forEach((lvl) => {
      const r = getHiLo(effectiveRange(lvl));
      if (!r) return;

      const pad = 0.12;
      const hi = r.hi + pad;
      const lo = r.lo - pad;

      const { y, hBand } = drawBand(ctx, w, hi, lo, INST_FILL, INST_STROKE, INST_STROKE_W);
      if (y == null || hBand == null) return;

      const strength = safeNum(lvl?.strength);
      const scoreText = strength != null ? ` ${Math.round(strength)}` : "";

      const facts = lvl?.details?.facts ?? {};
      const sticky = facts?.sticky ?? null;

      const note = clipText(sticky?.notes ?? lvl?.notes ?? "", 26);
      const noteText = note ? ` — ${note}` : "";

      const label = `Institutional${scoreText}${noteText}`;

      drawCenteredLabel(ctx, w / 2, y + hBand / 2, label, INST_LABEL, w, h);
      drawDashedMid(ctx, w, r.mid, MID_INST, 1.5);
    });

    negs.forEach((lvl) => {
      const r = getHiLo(effectiveRange(lvl));
      if (!r) return;

      const pad = 0.12;
      const hi = r.hi + pad;
      const lo = r.lo - pad;

      const { y, hBand } = drawBand(ctx, w, hi, lo, NEG_FILL, NEG_STROKE, NEG_STROKE_W);
      if (y == null || hBand == null) return;

      const strength = safeNum(lvl?.strength);
      const scoreText = strength != null ? ` ${Math.round(strength)}` : "";

      const facts = lvl?.details?.facts ?? {};
      const sticky = facts?.sticky ?? null;

      const note = clipText(sticky?.notes ?? lvl?.notes ?? "", 26);
      const noteText = note ? ` — ${note}` : "";

      const label = `Negotiated${scoreText}${noteText}`;

      drawCenteredLabel(ctx, w / 2, y + hBand / 2, label, NEG_LABEL, w, h);
      drawDashedMid(ctx, w, r.mid, MID_NEG, 1.5);
    });

    // ✅ No pockets drawn (deprecated)
  }

  async function loadLevels() {
    try {
      const res = await fetch(`${SMZ_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      levels = Array.isArray(json?.levels) ? json.levels : [];
      stickyStructures = Array.isArray(json?.structures_sticky)
        ? json.structures_sticky
        : [];

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
