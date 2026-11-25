// src/pages/rows/RowChart/overlays/VolumeProfileOverlay.jsx
//
// Volume profile (volume-at-price) for the LIVE chart. Read-only display.
//
// Draws, anchored at the right edge of the price area:
// - histogram of volume at price (value-area rows brighter)
// - POC (dotted), VAH / VAL (dashed)
// - shelf edges: where a heavy-volume shelf drops into a thin area
// - a warning badge when price is ACCEPTED beyond a shelf edge
//   (warning only, never an order)
//
// Profile range:
// - mode "visible": bars currently on screen (like TradingView VPVR)
// - mode "lookback": last `lookback` closed bars
// The shelf-break warning always uses the fixed lookback, so zooming the
// chart never changes the warning.
//
// Calculations live in ./helpers/volumeProfileCore.js (pure, tested).

import { computeVolumeProfile, selectProfileBars, detectShelfBreak } from "./helpers/volumeProfileCore";

const FONT = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

export default function VolumeProfileOverlay({
  chart,
  priceSeries,
  chartContainer,
  getBars,
  mode = "visible",
  lookback = 500,
  rows = 120,
  widthPct = 0.28,
  warnMarginPts = 2,
  warnClosesRequired = 2,
}) {
  if (!chart || !priceSeries || !chartContainer || typeof getBars !== "function") {
    return { seed() {}, update() {}, destroy() {} };
  }

  const ts = chart.timeScale();
  let canvas = null;
  let destroyed = false;
  let raf = 0;

  function ensureCanvas() {
    if (canvas) return canvas;
    const cnv = document.createElement("canvas");
    cnv.className = "overlay-canvas volume-profile";
    Object.assign(cnv.style, {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 13,
    });
    chartContainer.appendChild(cnv);
    canvas = cnv;
    return canvas;
  }

  function resizeCanvas(cnv) {
    const dpr = window.devicePixelRatio || 1;
    const rect = chartContainer.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width || chartContainer.clientWidth || 1));
    const h = Math.max(1, Math.floor(rect.height || chartContainer.clientHeight || 1));
    if (cnv.width !== Math.floor(w * dpr)) cnv.width = Math.floor(w * dpr);
    if (cnv.height !== Math.floor(h * dpr)) cnv.height = Math.floor(h * dpr);
    cnv.style.width = `${w}px`;
    cnv.style.height = `${h}px`;
    return { w, h, dpr };
  }

  const y = (p) => {
    const v = priceSeries.priceToCoordinate(Number(p));
    return Number.isFinite(v) ? v : null;
  };

  function profileBars() {
    const bars = getBars() || [];
    if (mode !== "visible") return selectProfileBars(bars, { lookback });
    const range = ts.getVisibleLogicalRange?.();
    if (!range) return selectProfileBars(bars, { lookback });
    const closed = bars.slice(0, -1); // forming bar excluded
    const from = Math.max(0, Math.floor(range.from));
    const to = Math.min(closed.length - 1, Math.ceil(range.to));
    return to > from ? closed.slice(from, to + 1) : [];
  }

  function hLine(ctx, x0, x1, yy, color, dash, width = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x0, Math.round(yy) + 0.5);
    ctx.lineTo(x1, Math.round(yy) + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  let usedLabelYs = [];
  function label(ctx, x, yy, text, color) {
    // Nudge labels that would overlap one already drawn on the same side.
    let yl = yy;
    for (let i = 0; i < 6; i++) {
      const hit = usedLabelYs.find((u) => Math.abs(u.x - x) < 120 && Math.abs(u.y - yl) < 16);
      if (!hit) break;
      yl = hit.y + (yl >= hit.y ? 16 : -16);
    }
    usedLabelYs.push({ x, y: yl });
    yy = yl;
    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = "rgba(10, 14, 20, 0.75)";
    ctx.fillRect(x, yy - 8, w, 16);
    ctx.fillStyle = color;
    ctx.fillText(text, x + 4, yy);
    ctx.restore();
  }

  function draw() {
    raf = 0;
    if (destroyed) return;
    const cnv = ensureCanvas();
    const { w, h, dpr } = resizeCanvas(cnv);
    const ctx = cnv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    usedLabelYs = [];

    const used = profileBars();
    const vp = computeVolumeProfile(used, { rows, preselected: true });
    if (!vp) return;

    const plotW = Math.max(1, Math.min(w, ts.width?.() || w));
    const maxLen = plotW * widthPct;

    // Histogram
    for (const r of vp.rows) {
      if (r.volume <= 0) continue;
      const yTop = y(r.hi);
      const yBot = y(r.lo);
      if (yTop == null || yBot == null) continue;
      const top = Math.min(yTop, yBot);
      const hh = Math.max(1, Math.abs(yBot - yTop) - 1);
      if (top > h || top + hh < 0) continue;
      const len = Math.max(1, r.norm * maxLen);
      ctx.fillStyle = r.inValueArea
        ? `rgba(38, 166, 154, ${0.25 + 0.5 * r.norm})`
        : `rgba(120, 144, 156, ${0.12 + 0.35 * r.norm})`;
      ctx.fillRect(plotW - len, top, len, hh);
    }

    // POC, VAH, VAL
    const yPoc = y(vp.poc);
    if (yPoc != null) {
      hLine(ctx, 0, plotW, yPoc, "rgba(255, 145, 0, 0.95)", [2, 3], 1.5);
      label(ctx, 6, yPoc, `POC ${vp.poc.toFixed(2)}`, "#ff9100");
    }
    const yVah = y(vp.vah);
    if (yVah != null) {
      hLine(ctx, 0, plotW, yVah, "rgba(38, 166, 154, 0.9)", [6, 4]);
      label(ctx, 6, yVah, `VAH ${vp.vah.toFixed(2)}`, "#26a69a");
    }
    const yVal = y(vp.val);
    if (yVal != null) {
      hLine(ctx, 0, plotW, yVal, "rgba(38, 166, 154, 0.9)", [6, 4]);
      label(ctx, 6, yVal, `VAL ${vp.val.toFixed(2)}`, "#26a69a");
    }

    // Shelf edges
    for (const e of vp.shelfEdges) {
      const ye = y(e.price);
      if (ye == null || ye < 0 || ye > h) continue;
      hLine(ctx, plotW - maxLen - 40, plotW, ye, "rgba(255, 214, 0, 0.9)", [], 1.5);
      const txt = `${e.side === "LOWER" ? "Shelf bottom" : "Shelf top"} ${e.price.toFixed(2)}`;
      ctx.save();
      ctx.font = FONT;
      const tw = ctx.measureText(txt).width + 8;
      ctx.restore();
      label(ctx, Math.max(6, plotW - maxLen - 48 - tw), ye, txt, "#ffd600");
    }

    // Shelf-break warning (fixed lookback, independent of zoom)
    const warn = detectShelfBreak(getBars() || [], {
      lookback,
      rows,
      marginPts: warnMarginPts,
      closesRequired: warnClosesRequired,
    });
    if (warn.status === "ACCEPTED_BELOW_SHELF" || warn.status === "ACCEPTED_ABOVE_SHELF") {
      const below = warn.status === "ACCEPTED_BELOW_SHELF";
      // If the warning's reference window does not reach the next shelf,
      // fall back to the displayed profile's next shelf in that direction.
      let nextNode = warn.nextNode;
      if (nextNode == null) {
        const c = vp.shelfEdges
          .filter((e) => (below ? e.side === "UPPER" && e.price < warn.price : e.side === "LOWER" && e.price > warn.price))
          .map((e) => e.price);
        if (c.length) nextNode = below ? Math.max(...c) : Math.min(...c);
      }
      const next = nextNode != null ? ` · thin until ~${nextNode.toFixed(2)}` : "";
      const txt = `${below ? "▼ Accepted BELOW" : "▲ Accepted ABOVE"} shelf ${warn.edge.toFixed(2)}${next} (warning only)`;
      ctx.save();
      ctx.font = "bold 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const tw = ctx.measureText(txt).width + 16;
      ctx.fillStyle = below ? "rgba(183, 28, 28, 0.9)" : "rgba(27, 94, 32, 0.9)";
      ctx.fillRect(8, 8, tw, 24);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, 16, 20);
      ctx.restore();
    }
  }

  function schedule() {
    if (destroyed || raf) return;
    raf = window.requestAnimationFrame(draw);
  }

  const onRange = () => schedule();
  ts.subscribeVisibleLogicalRangeChange?.(onRange);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
  try {
    ro?.observe(chartContainer);
  } catch {}

  return {
    seed() {
      schedule();
    },
    update() {
      schedule();
    },
    destroy() {
      destroyed = true;
      if (raf) window.cancelAnimationFrame(raf);
      try {
        ts.unsubscribeVisibleLogicalRangeChange?.(onRange);
      } catch {}
      try {
        ro?.disconnect();
      } catch {}
      try {
        if (canvas && canvas.parentNode === chartContainer) chartContainer.removeChild(canvas);
      } catch {}
      canvas = null;
    },
  };
}
