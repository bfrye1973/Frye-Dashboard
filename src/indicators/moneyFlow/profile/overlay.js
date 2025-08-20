// src/indicators/moneyFlow/profile/overlay.js
// Money Flow Profile — zones + side bars INSIDE the price pane, above chart canvases.

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

  // Ensure container stacks children (overlay on top)
  if (!container.style.position) container.style.position = "relative";

  // Create overlay canvas ABOVE the chart canvases
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9";                  // <-- force on top
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  const rgba = (hex, a) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const yOf = (p) => {
    const y = priceSeries.priceToCoordinate(p);
    return y == null ? -1 : y;
  };

  // Strongest contiguous zones by side
  function strongestZones(side) {
    const zones = [];
    let start = null, sum = 0;
    for (let i = 0; i < bins.length; i++) {
      const v = side === "pos" ? bins[i].pos : bins[i].neg;
      if (v > 0) { if (start == null) start = i; sum += v; }
      else if (start != null) { zones.push({ side, i1: start, i2: i - 1, strength: sum }); start = null; sum = 0; }
    }
    if (start != null) zones.push({ side, i1: start, i2: bins.length - 1, strength: sum });
    zones.sort((a, b) => b.strength - a.strength);
    return zones.slice(0, Math.max(0, zonesCount));
  }

  const posZones = showZones ? strongestZones("pos") : [];
  const negZones = showZones ? strongestZones("neg") : [];

  function draw() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);

    const leftX = innerMargin;
    const rightX = w - innerMargin;

    // A) Full‑width zones behind candles
    if (showZones) {
      ctx.fillStyle = rgba(posColor, zoneOpacity);
      for (const z of posZones) {
        const topY = yOf(bins[z.i2].p2), botY = yOf(bins[z.i1].p1);
        if (topY < 0 || botY < 0) continue;
        const y = Math.min(topY, botY), hPx = Math.max(1, Math.abs(botY - topY));
        ctx.fillRect(leftX, y, rightX - leftX, hPx);
      }
      ctx.fillStyle = rgba(negColor, zoneOpacity);
      for (const z of negZones) {
        const topY = yOf(bins[z.i2].p2), botY = yOf(bins[z.i1].p1);
        if (topY < 0 || botY < 0) continue;
        const y = Math.min(topY, botY), hPx = Math.max(1, Math.abs(botY - topY));
        ctx.fillRect(leftX, y, rightX - leftX, hPx);
      }
    }

    // B) Side bars inside pane edges
    if (showSides) {
      const maxW = Math.floor(w * Math.max(0, Math.min(1, sideWidthPct)));
      for (const b of bins) {
        const y1 = yOf(b.p1), y2 = yOf(b.p2);
        if (y1 < 0 || y2 < 0) continue;
        const yTop = Math.min(y1, y2), yBot = Math.max(y1, y2), hPx = Math.max(1, yBot - yTop);
        const scale = result.maxAbs ? (b.abs / result.maxAbs) : 0;

        // right (green)
        if (b.pos > 0) {
          const wPos = Math.round(scale * maxW);
          if (wPos > 0) { ctx.fillStyle = rgba(posColor, sideOpacity); ctx.fillRect(rightX - wPos, yTop, wPos, hPx); }
        }
        // left (red)
        if (b.neg > 0) {
          const wNeg = Math.round(scale * maxW);
          if (wNeg > 0) { ctx.fillStyle = rgba(negColor, sideOpacity); ctx.fillRect(leftX, yTop, wNeg, hPx); }
        }
      }
    }

    // visible tag to confirm overlay is ON TOP
    ctx.fillStyle = "rgba(147,163,184,0.85)";
    ctx.font = "12px system-ui,-apple-system,Segoe UI,Roboto,Arial";
    ctx.fillText("MFP v3", leftX, 14);
  }

  const ro = new ResizeObserver(draw);
  ro.observe(container);
  const ts = chartApi.timeScale();
  const unsub1 = ts.subscribeVisibleTimeRangeChange(draw);
  const unsub2 = ts.subscribeVisibleLogicalRangeChange?.(draw) || (() => {});
  const unsub3 = priceSeries.priceScale().subscribeSizeChange?.(draw) || (() => {});
  draw();

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(draw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange?.(draw); } catch {}
    try { unsub3 && priceSeries.priceScale().unsubscribeSizeChange?.(draw); } catch {}
    try { container.removeChild(canvas); } catch {}
  };
  seriesMap.set("mfp_canvas_cleanup", cleanup);
  return cleanup;
}
