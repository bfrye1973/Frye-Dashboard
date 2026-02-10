// src/pages/rows/RowChart/overlays/SMZLevelsOverlay.jsx
// Engine 1 Overlay — INSTITUTIONAL PARENTS ONLY (yellow)
//
// ✅ LOCKED:
// - Manual institutional parents ALWAYS show (from structures_sticky)
// - Live institutional zones show (from levels[]), but are secondary to stickies
// - Negotiated zones (|NEG| or isNegotiated true) are NOT drawn here
// - No dashed lines, no midlines, no micro tier
//
// ✅ NEW:
// - Big readable institutional labels with strength
// - Uses displayPriceRange if present (tight acceptance core)
// - Fill limited to avoid yellow blob; outlines for the rest

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

  // Institutional threshold for "strong" label emphasis (not required to draw)
  const INSTITUTIONAL_MIN = 85;

  // Visual tuning (no blob)
  const PAD = 0.06;
  const MAX_FILLED_TOTAL = 3;   // total filled across manual+auto
  const MAX_FILLED_MANUAL = 2;
  const MAX_FILLED_AUTO = 1;

  // Styles
  const FILL = "rgba(255,215,0,0.06)";
  const STROKE = "rgba(255,215,0,0.80)";
  const OUTLINE = "rgba(255,215,0,0.55)";
  const STROKE_W = 1;

  // Label styles (big + readable)
  const LABEL_FONT = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const LABEL_BG = "rgba(0,0,0,0.55)";
  const LABEL_PAD_X = 14;
  const LABEL_PAD_Y = 10;

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
    return cnv;
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  }

  function zoneId(z) {
    return String(z?.details?.id ?? z?.structureKey ?? z?.id ?? "");
  }

  function isNegotiated(z) {
    if (z?.isNegotiated === true) return true;
    const id = zoneId(z);
    return id.includes("|NEG|");
  }

  function isManualInstitutionalParent(z) {
    const id = zoneId(z);
    if (!id.startsWith("MANUAL|")) return false;
    if (isNegotiated(z)) return false;
    return true;
  }

  function getStrength(z) {
    const raw = safeNum(z?.strength_raw);
    if (raw != null) return raw;
    const s = safeNum(z?.strength);
    return s != null ? s : 0;
  }

  function getRange(z) {
    const range = z?.displayPriceRange ?? z?.priceRange;
    if (!Array.isArray(range) || range.length !== 2) return null;
    const a = safeNum(range[0]);
    const b = safeNum(range[1]);
    if (a == null || b == null) return null;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    if (!(hi > lo)) return null;
    return { hi, lo, mid: (hi + lo) / 2, width: hi - lo };
  }

  function getCurrentPrice() {
    try {
      const vr = ts?.getVisibleLogicalRange?.();
      const idx = vr?.to ?? null;
      if (idx == null) return null;
      const bar = priceSeries?.dataByIndex?.(idx, -1);
      const c = bar?.value ?? bar?.close ?? null;
      const n = Number(c);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
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
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, hBand - 1));
      ctx.stroke();
    }
  }

  function drawLabel(ctx, w, h, yCenter, text, color) {
    ctx.save();
    ctx.font = LABEL_FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const metrics = ctx.measureText(text);
    const tw = Math.ceil(metrics.width);
    const th = 22;

    const boxW = tw + LABEL_PAD_X * 2;
    const boxH = th + LABEL_PAD_Y * 2;

    // center in chart, clamp so it stays visible
    let x = Math.round(w / 2);
    let y = Math.round(yCenter);

    const minX = Math.ceil(boxW / 2) + 2;
    const maxX = w - Math.ceil(boxW / 2) - 2;
    const minY = Math.ceil(boxH / 2) + 2;
    const maxY = h - Math.ceil(boxH / 2) - 2;

    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));

    ctx.fillStyle = LABEL_BG;
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

    const currentPrice = getCurrentPrice();

    // --- Build manual zones list (always show) ---
    const manualZones = (Array.isArray(sticky) ? sticky : [])
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => isManualInstitutionalParent(z))
      .map((z) => {
        const r = getRange(z);
        if (!r) return null;
        const strength = getStrength(z);
        const dist = Number.isFinite(currentPrice) ? Math.abs(r.mid - currentPrice) : r.width;
        return { z, r, strength, dist, isManual: true };
      })
      .filter(Boolean)
      .sort((a, b) => a.dist - b.dist);

    // --- Build auto institutional list (from structures_sticky non-manual) ---
    const autoZones = (Array.isArray(sticky) ? sticky : [])
      .filter((z) => z && String(z?.tier ?? "") === "structure_sticky")
      .filter((z) => !isManualInstitutionalParent(z))
      .filter((z) => !isNegotiated(z))
      .map((z) => {
        const r = getRange(z);
        if (!r) return null;
        const strength = getStrength(z);
        const dist = Number.isFinite(currentPrice) ? Math.abs(r.mid - currentPrice) : r.width;
        return { z, r, strength, dist, isManual: false };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // closer first, then stronger, then tighter
        if (a.dist !== b.dist) return a.dist - b.dist;
        if (b.strength !== a.strength) return b.strength - a.strength;
        return a.r.width - b.r.width;
      });

    // Decide which to fill (to avoid blob)
    const fillManual = manualZones.slice(0, MAX_FILLED_MANUAL);
    const fillAuto = autoZones.slice(0, MAX_FILLED_AUTO);
    const filled = [...fillManual, ...fillAuto].slice(0, MAX_FILLED_TOTAL);

    // --- Draw manual bands + labels ---
    for (const item of manualZones) {
      const { r, strength } = item;
      const isFilled = filled.includes(item);

      drawBand(ctx, w, r.hi + PAD, r.lo - PAD, isFilled);

      // label manual institutional always
      const yMid = priceToY(r.mid);
      if (yMid != null) {
        drawLabel(ctx, w, h, yMid, `Institutional ${Math.round(strength)}`, STROKE);
      }
    }

    // --- Draw auto bands + labels (only if strong enough OR close to price) ---
    for (const item of autoZones) {
      const { r, strength } = item;
      const isFilled = filled.includes(item);

      drawBand(ctx, w, r.hi + PAD, r.lo - PAD, isFilled);

      // label only if strength >= 85 (keeps chart clean)
      if (strength >= INSTITUTIONAL_MIN) {
        const yMid = priceToY(r.mid);
        if (yMid != null) {
          drawLabel(ctx, w, h, yMid, `Institutional ${Math.round(strength)}`, STROKE);
        }
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
      levels = [];
      sticky = [];
      draw();
    }
  }

  loadLevels();

  const unsubVisible = ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  function seed() { draw(); }
  function update() { draw(); }

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
