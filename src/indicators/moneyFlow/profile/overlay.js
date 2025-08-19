// src/indicators/moneyFlow/profile/overlay.js
// Draw horizontal money-flow bars + dominant zones on the PRICE pane.

export function mfpAttach(chartApi, seriesMap, result, inputs) {
  const {
    showSides = true,
    sideWidthPct = 0.18,
    sideOpacity = 0.28,
    showZones = true,
    zonesCount = 1,
    zoneOpacity = 0.12,
    posColor = "#22c55e",
    negColor = "#ef4444",
    innerMargin = 10,
  } = inputs || {};

  const bins = result?.bins || [];
  if (!bins.length) return () => {};

  const container = chartApi._container;
  const priceSeries = chartApi._priceSeries;
  if (!container || !priceSeries) return () => {};

  // Canvas overlay (on top, but transparent)
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

  // Helpers
  function priceToY(price) {
    const y = priceSeries.priceToCoordinate(price);
    return y == null ? -1 : y;
  }
  function rgba(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // Build zone candidates by contiguous bin grouping per side (pos/neg)
  function buildZones(side /* "pos" | "neg" */) {
    const zones = [];
    let runStart = null, runEnd = null, runSum = 0;

    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const val = side === "pos" ? b.pos : b.neg;
      if (val > 0) {
        if (runStart == null) { runStart = i; runEnd = i; runSum = val; }
        else { runEnd = i; runSum += val; }
      } else if (runStart != null) {
        zones.push({ side, i1: runStart, i2: runEnd, strength: runSum });
        runStart = runEnd = null; runSum = 0;
      }
    }
    if (runStart != null) zones.push({ side, i1: runStart, i2: runEnd, strength: runSum });
    // strongest first
    zones.sort((a, b) => b.strength - a.strength);
    return zones.slice(0, Math.max(0, zonesCount));
  }

  const posZones = showZones ? buildZones("pos") : [];
  const negZones = showZones ? buildZones("neg") : [];

  function draw() {
    // Resize backing store to device px
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);

    // Plot area bounds (approx): keep a small inner margin
    const leftX = innerMargin;
    const rightX = w - innerMargin;

    // A) ZONES — full-width horizontal blocks
    if (showZones) {
      ctx.save();
      // Positive (green) zones
      ctx.fillStyle = rgba(posColor, zoneOpacity);
      for (const z of posZones) {
        const topY = priceToY(bins[z.i2].p2);
        const botY = priceToY(bins[z.i1].p1);
        if (topY < 0 || botY < 0) continue;
        const y = Math.min(topY, botY);
        const hPx = Math.max(1, Math.abs(botY - topY));
        ctx.fillRect(leftX, y, rightX - leftX, hPx);
      }
      // Negative (red) zones
      ctx.fillStyle = rgba(negColor, zoneOpacity);
      for (const z of negZones) {
        const topY = priceToY(bins[z.i2].p2);
        const botY = priceToY(bins[z.i1].p1);
        if (topY < 0 || botY < 0) continue;
        const y = Math.min(topY, botY);
        const hPx = Math.max(1, Math.abs(botY - topY));
        ctx.fillRect(leftX, y, rightX - leftX, hPx);
      }
      ctx.restore();
    }

    // B) SIDE BARS — inside the pane edges
    if (showSides) {
      const maxW = Math.floor(w * sideWidthPct);
      for (const b of bins) {
        const y1 = priceToY(b.p1);
        const y2 = priceToY(b.p2);
        if (y1 < 0 || y2 < 0) continue;
        const yTop = Math.min(y1, y2);
        const yBot = Math.max(y1, y2);
        const hPx = Math.max(1, yBot - yTop);

        const scale = result.maxAbs ? (b.abs / result.maxAbs) : 0;
        const posW = b.pos > 0 ? Math.round(scale * maxW) : 0;
        const negW = b.neg > 0 ? Math.round(scale * maxW) : 0;

        // Accumulation on RIGHT
        if (posW > 0) {
          ctx.fillStyle = rgba(posColor, sideOpacity);
          ctx.fillRect(rightX - posW, yTop, posW, hPx);
        }
        // Distribution on LEFT
        if (negW > 0) {
          ctx.fillStyle = rgba(negColor, sideOpacity);
          ctx.fillRect(leftX, yTop, negW, hPx);
        }
      }
    }
  }

  // Hook redraws
  const ro = new ResizeObserver(draw);
  ro.observe(container);
  const ts = chartApi.timeScale();
  const unsub1 = ts.subscribeVisibleTimeRangeChange(draw);
  const unsub2 = ts.subscribeVisibleLogicalRangeChange?.(draw) || (() => {});
  const unsub3 = priceSeries.priceScale().subscribeSizeChange?.(draw) || (() => {});

  draw(); // initial

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(draw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange?.(draw); } catch {}
    try { unsub3 && priceSeries.priceScale().unsubscribeSizeChange?.(draw); } catch {}
    try { container.removeChild(canvas); } catch {}
  };

  // register cleanup
  seriesMap.set("mfp_canvas_cleanup", cleanup);
  return cleanup;
}
