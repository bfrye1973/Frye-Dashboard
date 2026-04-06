// src/pages/rows/RowChart/overlays/PremarketFibOverlay.jsx
// Raw Engine 16 / morning-fib overlay
// Purpose:
// - optional debug/reference overlay
// - separate from Engine 17 composed truth
// - draws morning fib anchors + retracement lines + pullback zones
//
// IMPORTANT:
// - This is NOT the primary decision layer
// - This is intentionally separate from Engine 17 snapshot truth

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) ||
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://frye-market-backend-1.onrender.com";

export default function PremarketFibOverlay({
  chart,
  priceSeries,
  chartContainer,
  symbol = "SPY",
  tf = "10m",
  enabled = false,
}) {
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  let canvas = null;
  let raf = null;
  let disposed = false;
  let fibData = null;
  let lastFetchMs = 0;

  const ts = chart.timeScale();

  function ensureCanvas() {
    if (canvas) return canvas;

    canvas = document.createElement("canvas");
    canvas.className = "overlay-canvas premarket-fib-overlay";
    Object.assign(canvas.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 79,
    });

    chartContainer.appendChild(canvas);
    resizeCanvas();
    return canvas;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  function removeCanvas() {
    if (!canvas) return;
    try {
      canvas.remove();
    } catch {}
    canvas = null;
  }

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
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

  function fmt(x) {
    return Number.isFinite(Number(x)) ? Number(x).toFixed(2) : "—";
  }

  async function fetchMorningFib(force = false) {
    const now = Date.now();
    if (!force && now - lastFetchMs < 1500) return;
    lastFetchMs = now;

    try {
      const url =
        `${API_BASE.replace(/\/+$/, "")}/api/v1/morning-fib?symbol=` +
        `${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;

      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`morning-fib ${r.status}`);

      fibData = await r.json();
    } catch {
      fibData = null;
    }
  }

  function drawBand(ctx, w, lo, hi, fill, stroke, label) {
    const y1 = priceToY(lo);
    const y2 = priceToY(hi);
    if (y1 == null || y2 == null) return;

    const top = Math.min(y1, y2);
    const h = Math.max(2, Math.abs(y2 - y1));

    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(0, top, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(1, top + 1, Math.max(1, w - 2), Math.max(1, h - 2));
    ctx.restore();

    if (label) {
      ctx.save();
      ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const tw = ctx.measureText(label).width;
      const bw = tw + 18;
      const bh = 26;
      const bx = Math.max(18, Math.floor(w * 0.14));
      const by = top + 6;

      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#e5e7eb";
      ctx.fillText(label, bx + 9, by + 18);
      ctx.restore();
    }
  }

  function drawHLine(ctx, w, price, color, label, dash = [], lineWidth = 1.5) {
    const y = priceToY(price);
    if (y == null) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();

    if (label) {
      ctx.save();
      ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const text = `${label}  ${fmt(price)}`;
      const tw = ctx.measureText(text).width;
      const bw = tw + 20;
      const bh = 28;
      const bx = Math.max(18, Math.floor(w * 0.52));
      const by = y - bh / 2;

      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      roundRect(ctx, bx, by, bw, bh, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.fillText(text, bx + 10, by + 19);
      ctx.restore();
    }
  }

  function drawMarker(ctx, w, price, text, color, align = "left") {
    const y = priceToY(price);
    if (y == null) return;

    ctx.save();
    ctx.font = "18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const tw = ctx.measureText(text).width;
    const bw = tw + 20;
    const bh = 30;
    const bx = align === "left" ? 22 : Math.max(22, w - bw - 16);
    const by = y - bh / 2;

    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(text, bx + 10, by + 20);
    ctx.restore();
  }

  function draw() {
    if (disposed) return;

    if (!enabled) {
      removeCanvas();
      return;
    }

    if (!fibData?.ok) {
      const cnv = ensureCanvas();
      const ctx = cnv.getContext("2d");
      ctx.clearRect(0, 0, cnv.width, cnv.height);
      return;
    }

    const cnv = ensureCanvas();
    resizeCanvas();

    const rect = chartContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const ctx = cnv.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const anchors = fibData?.anchors || {};
    const fib = fibData?.fib || {};

    // zones
    if (
      Number.isFinite(fibData?.pullbackZone?.lo) &&
      Number.isFinite(fibData?.pullbackZone?.hi)
    ) {
      drawBand(
        ctx,
        w,
        fibData.pullbackZone.lo,
        fibData.pullbackZone.hi,
        "rgba(59,130,246,0.08)",
        "rgba(59,130,246,0.65)",
        "PM Fib Primary"
      );
    }

    if (
      Number.isFinite(fibData?.secondaryZone?.lo) &&
      Number.isFinite(fibData?.secondaryZone?.hi)
    ) {
      drawBand(
        ctx,
        w,
        fibData.secondaryZone.lo,
        fibData.secondaryZone.hi,
        "rgba(245,158,11,0.08)",
        "rgba(245,158,11,0.70)",
        "PM Fib Secondary"
      );
    }

    // fib levels
    if (Number.isFinite(fib?.r382)) {
      drawHLine(ctx, w, fib.r382, "#7dd3fc", "PM Fib 38.2");
    }
    if (Number.isFinite(fib?.r500)) {
      drawHLine(ctx, w, fib.r500, "#93c5fd", "PM Fib 50.0");
    }
    if (Number.isFinite(fib?.r618)) {
      drawHLine(ctx, w, fib.r618, "#60a5fa", "PM Fib 61.8");
    }
    if (Number.isFinite(fib?.r786)) {
      drawHLine(ctx, w, fib.r786, "#ef4444", "PM Fib 78.6", [12, 8], 2);
    }

    // anchors
    if (Number.isFinite(anchors?.anchorA)) {
      drawMarker(
        ctx,
        w,
        anchors.anchorA,
        `PM Fib A ${fmt(anchors.anchorA)}`,
        "#f8fafc",
        "left"
      );
    }

    if (Number.isFinite(anchors?.anchorB)) {
      drawMarker(
        ctx,
        w,
        anchors.anchorB,
        `PM Fib B ${fmt(anchors.anchorB)}`,
        "#f8fafc",
        "left"
      );
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
    fetchMorningFib(true).then(scheduleDraw);
  }

  function update() {
    if (!enabled) {
      removeCanvas();
      return;
    }
    fetchMorningFib(false).then(scheduleDraw);
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
  ts.subscribeVisibleTimeRangeChange?.(cb);

  return {
    seed,
    update,
    destroy: () => {
      try {
        ts.unsubscribeVisibleTimeRangeChange?.(cb);
      } catch {}
      destroy();
    },
  };
}
