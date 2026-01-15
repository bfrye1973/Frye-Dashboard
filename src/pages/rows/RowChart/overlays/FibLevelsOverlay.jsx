// src/pages/rows/RowChart/overlays/FibLevelsOverlay.jsx
// Engine 2 Overlay — Fib levels + Anchor lines + Extensions (Wave 3 targets)
// - Draws: Anchor Low/High, 0.382/0.5/0.618, INV(74), + extensions 1.168 and 2.618
// - Bigger, readable labels (Ferrari dashboard friendly)
// - Minimal clutter: thin lines, right-side tags, anchor dots

const FIB_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/fib-levels?symbol=SPY&tf=1h";

export default function FibLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
  timeFrame,
  enabled = false,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[FibLevelsOverlay] missing chart/priceSeries/chartContainer");
    return { seed() {}, update() {}, destroy() {} };
  }

  let canvas = null;
  let raf = null;
  let disposed = false;

  let fibData = null;

  const ts = chart.timeScale();

  // --- Style knobs (readability) ---
  const FONT = '14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  const HEADER_FONT = '15px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  const LABEL_PAD_X = 10;
  const LABEL_W_MIN = 130;
  const LABEL_H = 22;
  const LABEL_BG = "rgba(0,0,0,0.70)";
  const LABEL_STROKE = "rgba(255,255,255,0.16)";

  function ensureCanvas() {
    if (canvas) return canvas;
    canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "6";
    chartContainer.appendChild(canvas);
    resizeCanvas();
    return canvas;
  }

  function removeCanvas() {
    if (!canvas) return;
    try {
      canvas.remove();
    } catch {}
    canvas = null;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }

  function computeExtensions(low, high) {
    const span = high - low;
    if (!Number.isFinite(span) || span <= 0) return null;

    // Wave-3 style targets above the high:
    // 1.168 and 2.618 extensions from low->high impulse
    const ext1168 = high + 1.168 * span;
    const ext2618 = high + 2.618 * span;

    return {
      span,
      ext1168,
      ext2618,
    };
  }

  function draw() {
    if (disposed) return;
    if (!enabled) {
      removeCanvas();
      return;
    }
    if (!fibData || fibData.ok !== true) {
      removeCanvas();
      return;
    }

    const c = ensureCanvas();
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);

    // Scale for DPR
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const anchors = fibData.anchors || {};
    const fib = fibData.fib || {};
    const signals = fibData.signals || {};

    const low = Number(anchors.low);
    const high = Number(anchors.high);

    const exts = computeExtensions(low, high);

    const levels = [
      // Anchors
      { key: "A_LOW", price: low, label: `A Low  ${fmt(low)}`, kind: "anchor" },
      { key: "A_HIGH", price: high, label: `A High ${fmt(high)}`, kind: "anchor" },

      // Retrace
      { key: "R382", price: fib.r382, label: `0.382  ${fmt(fib.r382)}`, kind: "fib" },
      { key: "R500", price: fib.r500, label: `0.500  ${fmt(fib.r500)}`, kind: "fib" },
      { key: "R618", price: fib.r618, label: `0.618  ${fmt(fib.r618)}`, kind: "fib" },

      // Invalidation (gate)
      { key: "INV", price: fib.invalidation, label: `INV 74%  ${fmt(fib.invalidation)}`, kind: "gate" },
    ].filter((x) => Number.isFinite(x.price));

    // Extensions (Wave 3 targets) — only if anchors valid
    if (exts) {
      levels.push(
        { key: "EXT1168", price: exts.ext1168, label: `1.168  ${fmt(exts.ext1168)}`, kind: "ext" },
        { key: "EXT2618", price: exts.ext2618, label: `2.618  ${fmt(exts.ext2618)}`, kind: "ext" }
      );
    }

    // Header (top-right)
    const tag = anchors.context || signals.tag;
    const header = tag ? `FIB ${tag} (1h)` : "FIB (1h)";
    ctx.font = HEADER_FONT;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    const headerW = ctx.measureText(header).width;
    ctx.fillText(header, rect.width - headerW - 12, 18);

    // Draw each level
    for (const lv of levels) {
      const y = priceSeries.priceToCoordinate(lv.price);
      if (y == null || !Number.isFinite(y)) continue;

      const isGate = lv.kind === "gate";
      const isAnchor = lv.kind === "anchor";
      const isExt = lv.kind === "ext";

      const stroke =
        isGate ? "rgba(255,90,90,0.98)" :
        isAnchor ? "rgba(255,255,255,0.92)" :
        isExt ? "rgba(255,210,90,0.95)" :
        "rgba(120,210,255,0.92)";

      // line
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = isGate ? 1.8 : isExt ? 1.6 : 1.2;

      if (isGate) ctx.setLineDash([7, 4]);
      else if (isAnchor) ctx.setLineDash([2, 4]);
      else if (isExt) ctx.setLineDash([10, 6]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
      ctx.restore();

      // right label box
      ctx.font = FONT;
      const label = lv.label;
      const tw = ctx.measureText(label).width;
      const boxW = Math.max(LABEL_W_MIN, tw + LABEL_PAD_X * 2);
      const bx = rect.width - boxW - 10;
      const by = y - LABEL_H / 2;

      ctx.save();
      ctx.fillStyle = LABEL_BG;
      ctx.strokeStyle = LABEL_STROKE;
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, boxW, LABEL_H, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = stroke;
      ctx.fillText(label, bx + LABEL_PAD_X, by + 15);
      ctx.restore();

      // anchor dot left side
      if (isAnchor) {
        ctx.save();
        ctx.fillStyle = stroke;
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(12, y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  async function fetchFib() {
    try {
      const res = await fetch(FIB_URL, { headers: { accept: "application/json" } });
      fibData = await res.json();
    } catch {
      fibData = null;
    }
  }

  function scheduleDraw() {
    if (disposed) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  function onResize() {
    resizeCanvas();
    scheduleDraw();
  }

  function seed() {
    if (!enabled) return;
    fetchFib().then(scheduleDraw);
  }

  function update() {
    if (!enabled) {
      removeCanvas();
      return;
    }
    fetchFib().then(scheduleDraw);
  }

  function destroy() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    window.removeEventListener("resize", onResize);
    removeCanvas();
  }

  window.addEventListener("resize", onResize);

  // Redraw on scroll/zoom
  const cb = () => scheduleDraw();
  ts.subscribeVisibleTimeRangeChange(cb);

  return {
    seed,
    update,
    destroy: () => {
      try {
        ts.unsubscribeVisibleTimeRangeChange(cb);
      } catch {}
      destroy();
    },
  };
}

function fmt(x) {
  if (!Number.isFinite(x)) return "";
  return Number(x).toFixed(2);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
