// Draw horizontal money-flow bars on the PRICE pane using a canvas overlay.

export function mfpAttach(chartApi, seriesMap, result, inputs) {
  const {
    widthPct = 0.28,
    opacity = 0.28,
    posColor = "#22c55e",
    negColor = "#ef4444",
  } = inputs || {};

  const bins = result?.bins || [];
  if (!bins.length) return () => {};

  const container = chartApi._container;       // from LiveLWChart (NEW)
  const priceSeries = chartApi._priceSeries;   // from LiveLWChart (NEW)
  if (!container || !priceSeries) return () => {};

  // Create overlay canvas
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(price);
    return y == null ? -1 : y;
  }

  function draw() {
    // resize to actual pixels
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // compute max width in pixels
    const maxW = Math.floor(w * widthPct);

    // draw each bin
    for (const b of bins) {
      const y1 = priceToY(b.p1);
      const y2 = priceToY(b.p2);
      if (y1 < 0 || y2 < 0) continue;

      const yTop = Math.min(y1, y2);
      const yBot = Math.max(y1, y2);
      const hPx = Math.max(1, yBot - yTop);

      // scale widths
      const posW = b.abs > 0 ? Math.round((b.pos / b.abs) * (b.abs / result.maxAbs) * maxW) : 0;
      const negW = b.abs > 0 ? Math.round((b.neg / b.abs) * (b.abs / result.maxAbs) * maxW) : 0;

      // RIGHT side accumulation (green)
      if (posW > 0) {
        ctx.fillStyle = hexWithOpacity(posColor, opacity);
        ctx.fillRect(w - posW - 2, yTop, posW, hPx);
      }
      // LEFT side distribution (red)
      if (negW > 0) {
        ctx.fillStyle = hexWithOpacity(negColor, opacity);
        ctx.fillRect(2, yTop, negW, hPx);
      }
    }
  }

  function hexWithOpacity(hex, a) {
    // #rrggbb → rgba(...)
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${a})`;
    }

  // Redraw handlers
  const ro = new ResizeObserver(draw);
  ro.observe(container);
  const ts = chartApi.timeScale();
  const unsub1 = ts.subscribeVisibleTimeRangeChange(draw);
  const unsub2 = ts.subscribeVisibleLogicalRangeChange?.(draw) || (() => {});
  const unsub3 = priceSeries.priceScale().subscribeSizeChange?.(draw) || (() => {});

  // initial draw
  draw();

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(draw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange?.(draw); } catch {}
    try { unsub3 && priceSeries.priceScale().unsubscribeSizeChange?.(draw); } catch {}
    try { container.removeChild(canvas); } catch {}
  };

  // expose so we can remove from registry (no seriesMap entry since it's canvas)
  seriesMap.set("mfp_canvas_cleanup", cleanup);
  return cleanup;
}
