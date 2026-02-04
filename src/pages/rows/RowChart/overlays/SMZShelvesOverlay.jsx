// src/pages/rows/RowChart/overlays/SMZShelvesOverlay.jsx
// Overlay for Accumulation / Distribution shelves (blue/red)
// Reads /api/v1/smz-shelves?symbol=SPY -> { ok:true, meta:{...}, levels:[...] }
//
// ✅ LOCKED NOW:
// - Shelves are NEVER yellow. Ever.
// - accumulation = blue
// - distribution = red
//
// ✅ Beta:
// - Prefer strength_raw + confidence if present
// - Label shows: Type + strength + confidence
//
// ✅ Fix:
// - If backend type looks wrong, apply a trader-safe fallback:
//   - Zone ABOVE current price => Distribution (red)
//   - Zone BELOW current price => Accumulation (blue)

const SMZ_SHELVES_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/smz-shelves?symbol=SPY";

function clipText(s, max = 28) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

// Prefer strength_raw for truth; fallback to strength
function getStrengthRaw(lvl) {
  const raw = Number(lvl?.strength_raw);
  if (Number.isFinite(raw)) return raw;
  const s = Number(lvl?.strength);
  return Number.isFinite(s) ? s : NaN;
}

function getConfidence(lvl) {
  const c = Number(lvl?.confidence);
  return Number.isFinite(c) ? c : null;
}

export default function SMZShelvesOverlay({
  chart,
  priceSeries,
  chartContainer,
  onSelect,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  let levels = [];
  let canvas = null;
  let destroyed = false;

  let hitBoxes = []; // { y0, y1, lvl }

  const ts = chart.timeScale();

  // Colors (never yellow)
  const ACC_FILL = "rgba(0, 128, 255, 0.22)";
  const ACC_STROKE = "rgba(0, 128, 255, 0.95)";

  const DIST_FILL = "rgba(255, 0, 0, 0.20)";
  const DIST_STROKE = "rgba(255, 0, 0, 0.95)";

  // Keep shelves visually secondary to SMZ
  const STROKE_W = 2;

  function ensureCanvas() {
    if (canvas) return canvas;

    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas smz-shelves";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 14,
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
    if (cnv.width !== w) cnv.width = w;
    if (cnv.height !== h) cnv.height = h;
    return { w, h };
  }

  function drawCenteredLabel(ctx, xMid, yMid, text, stroke, boundsW, boundsH) {
    ctx.save();
    ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
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

    ctx.fillStyle = stroke;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function getCurrentPrice() {
    // Best-effort: use latest visible bar close if possible
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

  // Trader-safe type fallback:
  // - If zone is above current price => distribution
  // - If zone is below current price => accumulation
  function resolveType(lvl, hi, lo, currentPrice) {
    const t = String(lvl?.type || "").toLowerCase();
    const isAccum = t === "accumulation";
    const isDist = t === "distribution";

    // If backend gives a clean type, we still allow fallback correction by position.
    if (Number.isFinite(currentPrice)) {
      if (lo > currentPrice) return "distribution"; // overhead supply
      if (hi < currentPrice) return "accumulation"; // under support
    }

    if (isAccum) return "accumulation";
    if (isDist) return "distribution";

    // If unknown, default based on position if possible
    if (Number.isFinite(currentPrice)) {
      return lo > currentPrice ? "distribution" : "accumulation";
    }
    return "accumulation";
  }

  function draw() {
    if (destroyed) return;

    const cnv = ensureCanvas();
    const { w, h } = resizeCanvas(cnv);

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    hitBoxes = [];
    if (!Array.isArray(levels) || levels.length === 0) return;

    const currentPrice = getCurrentPrice();

    for (const lvl of levels) {
      if (!lvl) continue;

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

      hitBoxes.push({ y0: y, y1: y + bandH, lvl });

      const type = resolveType(lvl, hi, lo, currentPrice);
      const isAccum = type === "accumulation";
      const fill = isAccum ? ACC_FILL : DIST_FILL;
      const stroke = isAccum ? ACC_STROKE : DIST_STROKE;

      ctx.fillStyle = fill;
      ctx.fillRect(0, y, w, bandH);

      ctx.strokeStyle = stroke;
      ctx.lineWidth = STROKE_W;
      ctx.beginPath();
      ctx.rect(0.5, y + 0.5, w - 1, Math.max(1, bandH - 1));
      ctx.stroke();

      // Label (beta)
      const strengthRaw = getStrengthRaw(lvl);
      const conf = getConfidence(lvl);

      const baseLabel = isAccum ? "Accumulation" : "Distribution";
      const sTxt = Number.isFinite(strengthRaw) ? ` ${Math.round(strengthRaw)}` : "";
      const cTxt = conf != null ? ` (${conf.toFixed(2)})` : "";
      const comment = clipText(lvl.comment, 26);
      const commentText = comment ? ` — ${comment}` : "";

      const label = `${baseLabel}${sTxt}${cTxt}${commentText}`;
      drawCenteredLabel(ctx, w / 2, y + bandH / 2, label, stroke, w, h);
    }
  }

  function handleClick(evt) {
    if (destroyed) return;
    if (!hitBoxes.length) return;

    const rect = chartContainer.getBoundingClientRect();
    const y = evt.clientY - rect.top;

    const hits = hitBoxes.filter((hb) => y >= hb.y0 && y <= hb.y1);
    if (!hits.length) return;

    hits.sort((a, b) => Number(getStrengthRaw(b?.lvl) ?? 0) - Number(getStrengthRaw(a?.lvl) ?? 0));
    const selected = hits[0].lvl;

    const payload = { kind: "shelf", selected };

    if (typeof onSelect === "function") {
      onSelect(payload);
    } else {
      window.dispatchEvent(new CustomEvent("smz:shelfSelected", { detail: payload }));
    }
  }

  async function loadShelves() {
    try {
      const res = await fetch(`${SMZ_SHELVES_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      levels = Array.isArray(json.levels) ? json.levels : [];
      draw();
    } catch (e) {
      levels = [];
      draw();
    }
  }

  loadShelves();

  document.addEventListener("click", handleClick, true);

  const unsubVisible =
    ts.subscribeVisibleLogicalRangeChange?.(() => draw()) || (() => {});

  const ro = new ResizeObserver(() => draw());
  try { ro.observe(chartContainer); } catch {}

  function seed() { draw(); }
  function update() { draw(); }

  function destroy() {
    destroyed = true;
    try { document.removeEventListener("click", handleClick, true); } catch {}
    try { unsubVisible(); } catch {}
    try { ro.disconnect(); } catch {}
    try {
      if (canvas && canvas.parentNode === chartContainer) {
        chartContainer.removeChild(canvas);
      }
    } catch {}
    canvas = null;
    levels = [];
    hitBoxes = [];
  }

  return { seed, update, destroy };
}
