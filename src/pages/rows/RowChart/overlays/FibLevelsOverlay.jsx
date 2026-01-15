// src/pages/rows/RowChart/overlays/FibLevelsOverlay.jsx
// Engine 2 Overlay — BIG + CENTER labels + THICK lines + EXTENSIONS
//
// User requirements (LOCKED):
// - Font 3x bigger
// - Labels in middle of chart (not on right axis)
// - Lines 4x thicker
// - Show extensions: 1.168, 1.618, 2.0, 2.618
// - Keep: anchors, 0.382/0.5/0.618, INV(74)

const FIB_URL =
  "https://frye-market-backend-1.onrender.com/api/v1/fib-levels?symbol=SPY&tf=1h";

export default function FibLevelsOverlay({
  chart,
  priceSeries,
  chartContainer,
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

  // ===== BIG STYLE (3x text, 4x lines) =====
  const FONT = "42px system-ui, -apple-system, Segoe UI, Roboto, Arial"; // ~3x
  const HEADER_FONT = "44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const LINE_BASE = 4.8; // ~4x thicker than before
  const LINE_EXT = 5.5;
  const LINE_GATE = 6.0;

  const LABEL_BG = "rgba(0,0,0,0.72)";
  const LABEL_STROKE = "rgba(255,255,255,0.22)";
  const LABEL_PAD_X = 18;
  const LABEL_H = 54;
  const LABEL_RADIUS = 10;

  function ensureCanvas() {
    if (canvas) return canvas;
    canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "50"; // ensure above other overlays
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

    // Extensions above Wave-1 high:
    return {
      span,
      ext1168: high + 1.168 * span,
      ext1618: high + 1.618 * span,
      ext2000: high + 2.0 * span,
      ext2618: high + 2.618 * span,
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

    // clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);

    // DPR scale
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const anchors = fibData.anchors || {};
    const fib = fibData.fib || {};
    const signals = fibData.signals || {};

    const low = Number(anchors.low);
    const high = Number(anchors.high);
    const exts = computeExtensions(low, high);

    const levels = [
      // anchors
      { key: "A_LOW", price: low, label: `A LOW  ${fmt(low)}`, kind: "anchor" },
      { key: "A_HIGH", price: high, label: `A HIGH ${fmt(high)}`, kind: "anchor" },

      // retrace
      { key: "R382", price: fib.r382, label: `0.382  ${fmt(fib.r382)}`, kind: "fib" },
      { key: "R500", price: fib.r500, label: `0.500  ${fmt(fib.r500)}`, kind: "fib" },
      { key: "R618", price: fib.r618, label: `0.618  ${fmt(fib.r618)}`, kind: "fib" },

      // invalidation
      { key: "INV", price: fib.invalidation, label: `INV 74%  ${fmt(fib.invalidation)}`, kind: "gate" },
    ].filter((x) => Number.isFinite(x.price));

    if (exts) {
      levels.push(
        { key: "EXT1168", price: exts.ext1168, label: `1.168  ${fmt(exts.ext1168)}`, kind: "ext" },
        { key: "EXT1618", price: exts.ext1618, label: `1.618  ${fmt(exts.ext1618)}`, kind: "ext" },
        { key: "EXT2000", price: exts.ext2000, label: `2.000  ${fmt(exts.ext2000)}`, kind: "ext" },
        { key: "EXT2618", price: exts.ext2618, label: `2.618  ${fmt(exts.ext2618)}`, kind: "ext" }
      );
    }

    // === header (top middle) ===
    const tag = anchors.context || signals.tag;
    const header = tag ? `FIB ${tag} (ENGINE 2)` : "FIB (ENGINE 2)";
    ctx.font = HEADER_FONT;
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    const hw = ctx.measureText(header).width;
    ctx.fillText(header, (rect.width - hw) / 2, 54);

    // Label X position: center-ish (middle of chart)
    const labelX = Math.round(rect.width * 0.52);

    for (const lv of levels) {
      const y = priceSeries.priceToCoordinate(lv.price);
      if (y == null || !Number.isFinite(y)) continue;

      const isGate = lv.kind === "gate";
      const isAnchor = lv.kind === "anchor";
      const isExt = lv.kind === "ext";

      const stroke =
        isGate ? "rgba(255,60,60,0.98)" :
        isAnchor ? "rgba(255,255,255,0.98)" :
        isExt ? "rgba(255,210,90,0.98)" :
        "rgba(120,220,255,0.98)";

      // line (VERY THICK)
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = isGate ? LINE_GATE : isExt ? LINE_EXT : LINE_BASE;

      if (isGate) ctx.setLineDash([14, 10]);
      else if (isExt) ctx.setLineDash([22, 14]);
      else if (isAnchor) ctx.setLineDash([10, 10]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
      ctx.restore();

      // center label box
      ctx.save();
      ctx.font = FONT;
      const label = lv.label;
      const tw = ctx.measureText(label).width;
      const boxW = Math.max(260, tw + LABEL_PAD_X * 2);
      const bx = Math.min(Math.max(12, labelX - boxW / 2), rect.width - boxW - 12);
      const by = y - LABEL_H / 2;

      ctx.fillStyle = LABEL_BG;
      ctx.strokeStyle = LABEL_STROKE;
      ctx.lineWidth = 2;

      roundRect(ctx, bx, by, boxW, LABEL_H, LABEL_RADIUS);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = stroke;
      ctx.fillText(label, bx + LABEL_PAD_X, by + 40);
      ctx.restore();

      // anchor dots left side (bigger)
      if (isAnchor) {
        ctx.save();
        ctx.fillStyle = stroke;
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(22, y, 9, 0, Math.PI * 2);
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
