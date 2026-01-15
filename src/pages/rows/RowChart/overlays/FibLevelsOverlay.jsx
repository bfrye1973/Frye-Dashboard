// src/pages/rows/RowChart/overlays/FibLevelsOverlay.jsx
// Engine 2 Overlay — Fib levels + Anchor lines (minimal clutter)
// Draws on the same chart canvas system as SMZ overlay (Lightweight Charts).

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

  let fibData = null; // latest API payload

  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;
    canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "6"; // above candles, below tooltips if any
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

  function draw() {
    if (disposed) return;
    if (!enabled) {
      removeCanvas();
      return;
    }
    if (!fibData || fibData.ok !== true) {
      // Nothing to draw (keep silent)
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

    const levels = [
      { key: "A_LOW", price: anchors.low, label: `A Low ${fmt(anchors.low)}`, kind: "anchor" },
      { key: "A_HIGH", price: anchors.high, label: `A High ${fmt(anchors.high)}`, kind: "anchor" },
      { key: "R382", price: fib.r382, label: `0.382 ${fmt(fib.r382)}`, kind: "fib" },
      { key: "R500", price: fib.r500, label: `0.500 ${fmt(fib.r500)}`, kind: "fib" },
      { key: "R618", price: fib.r618, label: `0.618 ${fmt(fib.r618)}`, kind: "fib" },
      { key: "INV", price: fib.invalidation, label: `INV(74) ${fmt(fib.invalidation)}`, kind: "gate" },
    ].filter((x) => Number.isFinite(x.price));

    // Header (top-right)
    const header = anchors.context || signals.tag ? `FIB ${anchors.context || signals.tag}` : "FIB";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    const headerW = ctx.measureText(header).width;
    ctx.fillText(header, rect.width - headerW - 10, 16);

    // Draw each level
    for (const lv of levels) {
      const y = priceSeries.priceToCoordinate(lv.price);
      if (y == null || !Number.isFinite(y)) continue;

      const isGate = lv.kind === "gate";
      const isAnchor = lv.kind === "anchor";

      const stroke =
        isGate ? "rgba(255,90,90,0.95)" :
        isAnchor ? "rgba(255,255,255,0.80)" :
        "rgba(120,210,255,0.85)";

      // line
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = isGate ? 1.6 : 1.1;

      if (isGate) {
        ctx.setLineDash([6, 3]);
      } else if (isAnchor) {
        ctx.setLineDash([2, 4]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
      ctx.restore();

      // right label box
      const label = lv.label;
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const tw = ctx.measureText(label).width;
      const boxW = Math.max(92, tw + 14);
      const boxH = 18;
      const bx = rect.width - boxW - 8;
      const by = y - boxH / 2;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      roundRect(ctx, bx, by, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = stroke;
      ctx.fillText(label, bx + 7, by + 13);
      ctx.restore();

      // anchor dot left side
      if (isAnchor) {
        ctx.save();
        ctx.fillStyle = stroke;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(10, y, 3.4, 0, Math.PI * 2);
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
    } catch (e) {
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

  // Hook chart events similar to other overlays
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

  // Init
  window.addEventListener("resize", onResize);

  // Also redraw when visible range changes (scroll/zoom)
  const unsub = ts.subscribeVisibleTimeRangeChange(() => scheduleDraw());

  return {
    seed,
    update,
    destroy: () => {
      try {
        ts.unsubscribeVisibleTimeRangeChange(unsub);
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
